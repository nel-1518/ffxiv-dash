/**
 * 市场税率卡的配置字段与渲染。
 *
 * 卡面两段：标题行（服务器 + 数据新鲜度）→ 2×4 的城市税率格。
 * 城市按 `TAX_CITIES` 的固定顺序排（**不排序**：位置不承载信息），
 * 减税的城市在税率左边挂一个「减」字 —— 一眼看出哪几个在打折。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Flex, Form, Select, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { formatRelativeTime } from '../../../../core/clock/format.ts'
import { findWorldByName, worldOptions } from '../../../../core/world.ts'
import { TAX_CITIES, TAX_SITE_URL } from './constants.ts'
import { isFresh, readTaxCache, writeTaxCache } from './cache.ts'
import { fetchTaxRates, isDiscounted } from './rates.ts'
import type { TaxRow, TaxRates } from './rates.ts'
import type { TaxConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

export function TaxFormFields(): React.ReactNode {
  return (
    <Form.Item
      label="服务器"
      name={['config', 'server']}
      rules={[{ required: true, message: '请选择一个服务器' }]}
      extra="查询指定服务器的市场税率。"
    >
      <Select
        showSearch
        optionFilterProp="label"
        placeholder="选择服务器"
        options={worldOptions()}
        listHeight={320}
      />
    </Form.Item>
  )
}

export function TaxRender({ config }: WidgetRenderProps<TaxConfig>): React.ReactNode {
  /*
   * 时钟取**分钟粒度**：这张卡只有「N 分钟前」那一行吃时钟，而它一分钟才变一次。
   * （缓存 8 小时，读数最多显示到「N 小时前」。）
   */
  const now = useClockAt('minute')

  const serverName = config.server
  const serverId = findWorldByName(serverName)?.id
  /** 当前请求的唯一标识：数据与错误都按它归档，换服务器时旧数据自然失效。 */
  const requestKey = String(serverId ?? 0)

  /*
   * 数据与错误都**连着自己那份请求标识一起存**，而不是在 effect 里手动清空：
   * 渲染期拿 key 一比就知道这条数据是不是当前服务器的，不必"先置空再请求"。
   */
  const [entry, setEntry] = useState<{ key: string; data: TaxRates } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示。
   *
   * 这张卡只有"服务器"一个参数，直接 memo 在它上面即可 —— 不需要房屋卡那种
   * "连 requestKey 一起 memo"的写法（那是为了躲开多参数下的死锁）。
   */
  const cached = useMemo(() => (serverId === undefined ? null : readTaxCache(serverId)), [serverId])

  const data = (entry?.key === requestKey ? entry.data : null) ?? cached
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
    return fetchTaxRates(serverName)
      .then((result) => {
        writeTaxCache(result)
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
   * 打开 / 换服务器时请求一次，**只此一次**：命中未过期缓存（8 小时内）就直接用、不发请求；
   * 停留期间不做任何轮询 —— 这正是"每次进入页面判断一次即可"的落地方式。
   */
  useEffect(() => {
    if (serverId === undefined) {
      return
    }
    const hit = readTaxCache(serverId)
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

  /*
   * 拿到数据前先摆出八个城市（读数显示破折号）：卡高稳定，数据回来时不会跳。
   * 行序就是 `TAX_CITIES` 的顺序，有数据 / 没数据走的都是同一条路。
   */
  const skeleton: TaxRow[] = TAX_CITIES.map((city) => ({ ...city, rate: null }))
  const rows = data?.rates ?? skeleton

  // 失败优先于其他状态：标题行只显示「获取失败」，原因悬停可看，细节在控制台
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
     * 正文整块可点，跳到 Universalis（数据来源）。
     * 链接只包住读数区：**卡片标题栏**里有编辑/删除按钮，交互元素不能互相嵌套。
     * 这一层同时是卡内的纵向 flex 容器（原来是里面那层 Flex）——
     * 它撑满卡面正文区，好把富余高度传给下面的读数区（上限见 global.css 的 `.dash-tax-link`）。
     */
    <a
      className="dash-tax-link"
      href={TAX_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="打开 Universalis 查看"
    >
      <Flex align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
        <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
          {serverName}
        </Typography.Text>
        {/* 数据新鲜度挤在标题行右侧，不独占一行；获取失败时这里转警示色 */}
        <Typography.Text
          type={error === null ? 'secondary' : 'warning'}
          title={error ?? undefined}
          style={{ fontSize: 11, flex: 'none' }}
        >
          {status}
        </Typography.Text>
      </Flex>

      <div className="dash-tax-rows">
        {rows.map((row) => (
          <div key={row.key} className="dash-tax-row">
            {/* 窄卡里把城市名截断（hover 看全名），不让税率数字被挤走 */}
            <span className="dash-tax-city" title={row.label}>
              {row.label}
            </span>
            {/* 「减」标记与税率贴成一组一起靠右：标记是给这个数字做注解的 */}
            <span className="dash-tax-tail">
              {isDiscounted(row) ? <span className="dash-tax-cut">减</span> : null}
              <span className={`dash-tax-rate${row.rate === null ? ' is-blank' : ''}`}>
                {row.rate === null ? '—' : `${String(row.rate)}%`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </a>
  )
}
