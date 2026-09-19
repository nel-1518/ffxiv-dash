/**
 * 房屋售卖卡的配置字段与渲染。
 *
 * 卡面三段：标题行（服务器 + 数据新鲜度）→ 抽签时期（纯时钟推算）→ M / L / S 合计。
 * 房区与用途都只是**筛选条件**（数据是整服一次拿回来的），所以改它们不会重新请求，
 * 合计在渲染期用 `sumCounts` 现算。正文整块可点，跳到售楼中心。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Flex, Form, Select, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { formatRelativeTime } from '../../../../core/clock/format.ts'
import { findWorldByName, worldOptions } from '../../../../core/world.ts'
import {
  HOUSE_AREAS,
  HOUSE_SIZE_KEYS,
  HOUSE_SIZE_LABELS,
  HOUSE_SITE_URL,
  HOUSE_USES,
  HOUSE_USE_LABELS,
} from './constants.ts'
import { HOUSE_PHASE_LABELS, formatBoundary, formatRemaining, resolveHousePhase } from './phase.ts'
import { isFresh, readHouseCache, writeHouseCache } from './cache.ts'
import { fetchSales, sumCounts } from './sale.ts'
import type { HouseData } from './sale.ts'
import type { HouseConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

export function HouseFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item
        label="服务器"
        name={['config', 'server']}
        rules={[{ required: true, message: '请选择一个服务器' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="选择服务器"
          options={worldOptions()}
          listHeight={320}
        />
      </Form.Item>

      <Form.Item
        label="房区"
        name={['config', 'areas']}
        rules={[{ required: true, message: '请至少选择一个房区' }]}
        extra="可多选。"
      >
        <Select
          mode="multiple"
          placeholder="选择房区"
          options={HOUSE_AREAS.map((area) => ({ label: area.name, value: area.id }))}
        />
      </Form.Item>

      <Form.Item
        label="房屋用途"
        name={['config', 'use']}
      >
        <Select options={HOUSE_USES} />
      </Form.Item>
    </>
  )
}

/** 合计里的一格。没有数据时显示破折号 —— 不能拿 0 冒充"查过了，是 0 处"。 */
function TotalCell({ size, value }: { size: 'm' | 'l' | 's'; value: number | undefined }): React.ReactNode {
  return (
    <div className={`dash-house-total is-${size}`}>
      <span className="dash-house-total-label">{HOUSE_SIZE_LABELS[size]}</span>
      <span className={`dash-house-total-value${value === undefined ? ' is-blank' : ''}`}>
        {value === undefined ? '—' : String(value)}
      </span>
    </div>
  )
}

export function HouseRender({ config }: WidgetRenderProps<HouseConfig>): React.ReactNode {
  /*
   * 时钟取**分钟粒度**：时期条与「N 分钟前」都只准到分钟（换期时刻落在整点上）。
   */
  const now = useClockAt('minute')

  const serverName = config.server
  const serverId = findWorldByName(serverName)?.id

  /*
   * ⚠️ WidgetRenderer 每次渲染都会重新 normalizeConfig，config.areas 的引用不稳定，
   * 先拼成字符串再还原：数组因此有了稳定引用，可以安全地进依赖。
   */
  const areasKey = config.areas.join(',')
  const areas = useMemo(
    () => HOUSE_AREAS.filter((area) => areasKey.split(',').includes(String(area.id))).map((area) => area.id),
    [areasKey],
  )
  /** 当前请求的唯一标识：数据与错误都按它归档，切参数时旧数据自然失效。 */
  const requestKey = `${String(serverId ?? 0)}|${areasKey}`

  /*
   * 数据与错误都**连着自己那份请求标识一起存**，而不是在 effect 里手动清空：
   * 渲染期拿 key 一比就知道这条数据是不是当前参数的，不必"先置空再请求"。
   */
  const [entry, setEntry] = useState<{ key: string; data: HouseData } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示。
   *
   * ⚠️ 快照必须**连请求标识一起记**，靠它让下面那份 `entry` 与"缓存里现在有什么"用同一套判定。
   * 只 memo 在 serverId 上会死锁：改了房区之后 requestKey 变了、entry 不再匹配，而 effect 发现
   * 缓存还新鲜就直接 return 不写状态，渲染期又只有这次改动之前读到的 null —— 卡会永远停在
   * 「正在获取…」。带上 requestKey 之后，改房区 / 换服务器都会重读一次，正好对上那次判定。
   * （缓存本身仍按服务器存：整服数据一次到手，换房区只是换显示哪几行。）
   */
  const cached = useMemo((): { key: string; data: HouseData } | null => {
    if (serverId === undefined) {
      return null
    }
    const hit = readHouseCache(serverId)
    return hit === null ? null : { key: requestKey, data: hit }
  }, [requestKey, serverId])

  const data = (entry?.key === requestKey ? entry.data : null) ?? cached?.data ?? null
  const error = failure?.key === requestKey ? failure.message : null
  // 没有数据也没有错误 = 还在等第一次结果，不需要单独维护一个 loading 状态
  const pending = serverId !== undefined && data === null && error === null

  /*
   * 拉取 + 落盘 + 记账。
   *
   * 刻意写成**同步函数返回 Promise**（而不是 async 函数）：setState 全部落在
   * then/catch 回调里，effect 同步阶段一次都不会触发渲染。
   */
  const reload = useCallback((): Promise<void> => {
    if (serverName === '') {
      return Promise.resolve()
    }
    return fetchSales(serverName)
      .then((result) => {
        writeHouseCache(result)
        setEntry({ key: requestKey, data: result })
        // 成功就把同一份请求的错误记录清掉，否则重试成功后错误提示还挂着
        setFailure((previous) => (previous?.key === requestKey ? null : previous))
      })
      .catch((requestError: unknown) => {
        setFailure({
          key: requestKey,
          message: requestError instanceof Error ? requestError.message : '未知错误',
        })
      })
  }, [requestKey, serverName])

  /*
   * 打开 / 换服务器时请求一次，**只此一次**：命中未过期缓存（8 小时内）就直接用、不发请求。
   * 换房区只是换了要显示哪几行，数据是整服一起回来的，所以它同样只走缓存这一关。
   */
  useEffect(() => {
    if (serverId === undefined) {
      return
    }
    const hit = readHouseCache(serverId)
    if (hit && isFresh(hit, Date.now())) {
      return
    }
    void reload()
  }, [reload, serverId])

  if (serverId === undefined) {
    return (
      <Alert
        type="warning"
        showIcon
        title="还没有选择服务器"
        description="打开编辑弹窗，在「服务器」里选择一个服务器。"
      />
    )
  }

  if (areasKey === '') {
    return (
      <Alert
        type="warning"
        showIcon
        title="还没有选择房区"
        description="打开编辑弹窗，在「房区」里至少勾选一个房区。"
      />
    )
  }

  // 抽签时期是纯时钟推算的：接口挂了这段照常显示，所以它不参与"有没有数据"的判断
  const phase = resolveHousePhase(now)
  // 合计同样在渲染期算：用途、房区都只是筛选条件，数据是整服一次拿回来的
  const totals = data === null ? null : sumCounts(data, areas, config.use)
  const status =
    error !== null
      ? '获取失败'
      : pending
        ? '正在获取…'
        : data
          ? formatRelativeTime(data.fetchedAt, now.getTime())
          : '暂无数据'

  return (
    /*
     * 正文整块可点，跳到售楼中心。链接只包住读数区：**标题栏**里有编辑/删除按钮，
     * 交互元素不能嵌在 <a> 里。
     */
    <a
      className="dash-house-link"
      href={HOUSE_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="打开艾欧泽亚售楼中心"
    >
      <Flex vertical gap={10} style={{ minWidth: 0 }}>
        <Flex align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis className={`dash-house-phase-name${phase.kind === 'entry' ? '-is-entry' : ''}`} style={{ fontSize: 13 }}>
            {HOUSE_PHASE_LABELS[phase.kind]}
          </Typography.Text>
          <Typography.Text
            type={error === null ? 'secondary' : 'warning'}
            title={error ?? undefined}
            style={{ fontSize: 11, flex: 'none' }}
          >
            {serverName ?? '未知大区'} · {status}
          </Typography.Text>
        </Flex>

        <div className={`dash-house-phase`}>
          <span className="dash-house-phase-note">{formatRemaining(phase.remaining)}</span>
          <span className="dash-house-phase-note">
            {phase.kind === 'entry'
              ? `${formatBoundary(phase.endAt)} 开始公示`
              : `${formatBoundary(phase.endAt)} 开始申请`}
          </span>
        </div>

        {/*
          合计块外面套一层：`container-type: inline-size` 只能声明在**容器自己**身上，
          而字号缩放要作用到里面的数字（`cqi` 量的是这一层的宽度），所以两者必须分开。
        */}
        <Flex vertical gap={4} style={{ minWidth: 0 }}>
          <span className="dash-house-totals-caption">
            {areas.length == 1 ? HOUSE_AREAS[areas[0]]?.name ?? '未知房区' : `${areas.length} 个房区`} · {HOUSE_USE_LABELS[config.use]}
          </span>
          <div className="dash-house-totals-wrap">
            <div className="dash-house-totals">
              {HOUSE_SIZE_KEYS.map((size) => (
                <TotalCell key={size} size={size} value={totals?.[size]} />
              ))}
            </div>
          </div>
        </Flex>
      </Flex>
    </a>
  )
}
