/**
 * 市场税率卡的配置字段与渲染。
 *
 * 卡面三段：标题行（服务器 + 数据新鲜度）→ 减税市场（一行列出）→ 金额输入框 + 含税估算。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Flex, Form, Input, Select, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { formatRelativeTime } from '../../../../core/clock/format.ts'
import { findWorldByName, worldOptions } from '../../../../core/world.ts'
import { TAX_NORMAL_RATE, TAX_SITE_URL } from './constants.ts'
import { isFresh, readTaxCache, writeTaxCache } from './cache.ts'
import { fetchTaxRates, isDiscounted } from './rates.ts'
import type { TaxRates } from './rates.ts'
import type { TaxConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

/** 金额输入最多 9 位数字（上限 999,999,999）。 */
const AMOUNT_MAX_DIGITS = 9

/** 整数金额的千分位格式化。 */
function formatGil(value: number): string {
  return value.toLocaleString('en-US')
}

export function TaxFormFields(): React.ReactNode {
  return (
    <Form.Item
      label="服务器"
      name={['config', 'server']}
      rules={[{ required: true, message: '请选择一个服务器' }]}
      extra="查询指定服务器的市场税率，只显示正在减税的城市。"
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
   */
  const cached = useMemo(() => (serverId === undefined ? null : readTaxCache(serverId)), [serverId])

  const data = (entry?.key === requestKey ? entry.data : null) ?? cached
  const error = failure?.key === requestKey ? failure.message : null
  // 没有数据也没有错误 = 还在等第一次结果，不需要单独维护一个 loading 状态
  const pending = serverId !== undefined && data === null && error === null

  /*
   * 金额输入：存**格式化后的文本**（千分位随输入即时生效），计算时再去掉逗号。
   * 只保留数字、最多 9 位 —— 前导零顺手被 Number 归一掉（"00100" → "100"）。
   */
  const [amountText, setAmountText] = useState('')
  const amount = amountText === '' ? 0 : Number(amountText.replace(/,/g, ''))
  const hasAmount = amount > 0

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.replace(/[^0-9]/g, '').slice(0, AMOUNT_MAX_DIGITS)
    setAmountText(digits === '' ? '' : formatGil(Number(digits)))
  }

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

  // 只保留正在减税的城市（`isDiscounted` 是类型谓词，filter 之后 `rate` 必为数字）
  const rows = data === null ? [] : data.rates.filter(isDiscounted)

  /*
   * 减税地点按税率分组：税率只有 5% / 3% 两档，一组一行列出城市（顿号分隔、超宽自动折行），
   * 比逐城一行省下大半版面。分组顺序沿用 `TAX_CITIES` 的顺序（Map 保持插入顺序）。
   */
  const groups = new Map<number, string[]>()
  for (const row of rows) {
    const labels = groups.get(row.rate)
    if (labels === undefined) {
      groups.set(row.rate, [row.label])
    } else {
      labels.push(row.label)
    }
  }

  /*
   * 含税估算只算三档：卖出 5%（正常税）→ 卖出各减税档（如 3%）→ 买入 5%。
   * **税额一律向下取整**，卖出 = 金额 − 税额，买入 = 金额 + 税额。
   * 金额未填时读数为 null（显示破折号）：格子常驻，版面高度不随输入跳变。
   */
  const discountedRates = Array.from(new Set(rows.map((row) => row.rate))).sort((a, b) => a - b)

  /**
   * 金额 `amount` 在税率 `rate`（百分比）下的税额，向下取整。
   * ⚠️ 先乘整数再除 100（而不是乘 `rate / 100`）：后者在 0.05 / 0.03 这类
   * 二进制表示不精确的浮点数上会漂出 1 分（如 3333 × 0.05 = 166.64999999999998）。
   */
  const taxOf = (rate: number): number => Math.floor((amount * rate) / 100)

  const estimates: { key: string; label: string; value: number | null; emphasis: boolean }[] = [
    {
      key: 'sell-normal',
      label: `卖出 ${String(TAX_NORMAL_RATE)}%`,
      value: hasAmount ? amount - taxOf(TAX_NORMAL_RATE) : null,
      emphasis: false,
    },
    ...discountedRates.map((rate) => ({
      key: `sell-${String(rate)}`,
      label: `卖出 ${String(rate)}%`,
      value: hasAmount ? amount - taxOf(rate) : null,
      emphasis: true,
    })),
    {
      key: 'buy-normal',
      label: `买入 ${String(TAX_NORMAL_RATE)}%`,
      value: hasAmount ? amount + taxOf(TAX_NORMAL_RATE) : null,
      emphasis: false,
    },
  ]

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
     * 正文不可点，纯读数 + 一个输入框（不套 `.dash-card-link`，flex 规则自己给，同汇率卡）。
     * 这一层撑满卡面正文区，好把富余高度交给中间的减税地点区（上限 `.dash-card-fill` 的 164px）。
     */
    <div className="dash-card-fill dash-tax">
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

      {groups.size > 0 ? (
        /*
         * 整块可点，跳到 Universalis（数据来源）。
         * 链接就是这块滚动容器本身，样式由 `.dash-tax-places` 给（无悬停动画，见 CSS）。
         */
        <a
          className="dash-tax-places"
          href={TAX_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="打开 Universalis 查看"
        >
          {Array.from(groups.entries()).map(([rate, labels]) => (
            <div key={rate} className="dash-tax-place">
              <span className="dash-tax-place-cities">{labels.join('、')}</span>{' '}
              <span className="dash-tax-place-names">
                正在实施减税{TAX_NORMAL_RATE - rate}%的活动。税金为成交价格的{rate}%。
              </span>
            </div>
          ))}
        </a>
      ) : (
        <div className="dash-tax-empty">
          {pending ? '正在获取…' : error !== null ? '获取失败' : '当前没有正在减税的市场'}
        </div>
      )}

      {/*
       * 计算器：输入框 + 含税估算，包成一组 —— 内部间距收紧到 6px，
       * 与卡里其他区块（10px）拉开层次，读作「一个功能的两个部分」。
       */}
      <div className="dash-tax-calc">
        <Input
          className="dash-tax-input"
          size="small"
          placeholder="输入金额计算含税价"
          value={amountText}
          onChange={handleAmountChange}
          inputMode="numeric"
          allowClear
        />

        {/*
         * 含税估算：浅底网格一列一档（同房屋合计块的排版语言），标签在上、读数在下。
         * 列数随档位数走（没有减税时只有两列），写在 inline style 里。
         */}
        <div
          className="dash-tax-results"
          style={{ gridTemplateColumns: `repeat(${String(estimates.length)}, minmax(0, 1fr))` }}
        >
          {estimates.map((estimate) => (
            <div key={estimate.key} className="dash-tax-cell">
              <span className="dash-tax-cell-label">{estimate.label}</span>
              <span
                className={`dash-tax-cell-value${estimate.value === null ? ' is-blank' : ''}${
                  estimate.emphasis ? ' is-emphasis' : ''
                }`}
                title={estimate.value === null ? undefined : formatGil(estimate.value)}
              >
                {estimate.value === null ? '—' : formatGil(estimate.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
