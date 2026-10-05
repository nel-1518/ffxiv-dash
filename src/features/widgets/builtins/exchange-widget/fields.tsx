/**
 * 汇率卡的配置字段与渲染。
 *
 * 卡面两段：标题行（货币对 + 数据新鲜度）→ 浅底读数面板。
 * 面板中央是主读数「1 基准货币 = 汇率 目标货币」（汇率跟着卡宽缩放，同倒数日卡），
 * 下方一行反向汇率、一行数据日期 —— 看一眼就知道手里的钱折过来是多少，
 * 以及这个数是哪天的（央行参考汇率一天一更）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flex, Form, Select, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { formatRelativeTime } from '../../../../core/clock/format.ts'
import { currencyOptions } from './currencies.ts'
import { isFresh, readExchangeCache, writeExchangeCache } from './cache.ts'
import { fetchExchangeRate } from './rates.ts'
import type { ExchangeRate } from './rates.ts'
import type { ExchangeConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

/**
 * 汇率数字的展示精度：跨度从 0.0042（JPY→CNY）到两万多（VND），固定小数位顾不了两头 ——
 * 按数量级分档，保证每档都有 4 位左右的有效数字。
 */
function formatRate(rate: number): string {
  if (rate >= 100) {
    // 两万多印尼盾 / 一千多韩元：整数 + 两位小数已经够看，加千分位读得快
    return rate.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  if (rate >= 1) {
    // 23.561 / 1.2793：四位小数再抹掉尾零
    return String(Number(rate.toFixed(4)))
  }
  // 0.04244：四位有效数字，再小就看不出变化了
  return String(Number(rate.toPrecision(4)))
}

/** 编辑弹窗里的「组件配置」区：基准 / 目标货币各一个搜索选择器 + 数据来源说明。 */
export function ExchangeFormFields(): React.ReactNode {
  const options = useMemo(() => currencyOptions(), [])
  return (
    <>
      <Form.Item
        label="基准货币"
        name={['config', 'base']}
        rules={[{ required: true, message: '请选择基准货币' }]}
      >
        <Select showSearch optionFilterProp="label" placeholder="选择基准货币" options={options} />
      </Form.Item>
      <Form.Item
        label="目标货币"
        name={['config', 'quote']}
        rules={[{ required: true, message: '请选择目标货币' }]}
        extra="卡面显示 1 基准货币 = ? 目标货币，以及反向汇率。"
      >
        <Select showSearch optionFilterProp="label" placeholder="选择目标货币" options={options} />
      </Form.Item>
    </>
  )
}

export function ExchangeRender({ config }: WidgetRenderProps<ExchangeConfig>): React.ReactNode {
  /*
   * 时钟取**分钟粒度**：这张卡只有「N 分钟前」那一行吃时钟，而它一分钟才变一次。
   * （缓存 8 小时，读数最多显示到「N 小时前」。）
   */
  const now = useClockAt('minute')

  const { base, quote } = config
  /** 当前请求的唯一标识：数据与错误都按它归档，换货币对时旧数据自然失效。 */
  const requestKey = `${base}-${quote}`

  /*
   * 数据与错误都**连着自己那份请求标识一起存**，而不是在 effect 里手动清空：
   * 渲染期拿 key 一比就知道这条数据是不是当前货币对的，不必"先置空再请求"。
   */
  const [entry, setEntry] = useState<{ key: string; data: ExchangeRate } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示。
   */
  const cached = useMemo(() => readExchangeCache(base, quote), [base, quote])

  const data = (entry?.key === requestKey ? entry.data : null) ?? cached
  const error = failure?.key === requestKey ? failure.message : null
  // 没有数据也没有错误 = 还在等第一次结果，不需要单独维护一个 loading 状态
  const pending = data === null && error === null

  /*
   * 拉取 + 落盘 + 记账。
   *
   * 刻意写成**同步函数返回 Promise**（而不是 async 函数）：setState 全部落在
   * then/catch 回调里，effect 同步阶段一次都不会触发渲染。
   */
  const reload = useCallback((): Promise<void> => {
    return fetchExchangeRate(base, quote)
      .then((result) => {
        writeExchangeCache(result)
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
  }, [base, quote, requestKey])

  /*
   * 打开 / 换货币对时请求一次，**只此一次**：命中未过期缓存（8 小时内）就直接用、不发请求；
   * 停留期间不做任何轮询。
   */
  useEffect(() => {
    const hit = readExchangeCache(base, quote)
    if (hit && isFresh(hit, Date.now())) {
      return
    }
    void reload()
  }, [reload, base, quote])

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
     * 正文不可点，纯粹是读数展示 —— 这一层是卡内的纵向 flex 容器，
     * 撑满卡面正文区（`.dash-exchange` 里有 display: flex 的规则）。
     */
    <div className="dash-card-fill dash-exchange">
      <Flex align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
        <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
          {base} → {quote}
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

      <div className="dash-exchange-panel">
        {data ? (
          <>
            <div className="dash-exchange-amount">
              <span className="dash-exchange-each">1 {base} =</span>
              <span className="dash-exchange-value">{formatRate(data.rate)}</span>
              <span className="dash-exchange-quote-unit">{quote}</span>
            </div>
            <div className="dash-exchange-reverse">
              1 {quote} ≈ {formatRate(1 / data.rate)} {base}
            </div>
            <div className="dash-exchange-date">{data.date}</div>
          </>
        ) : (
          <span className="dash-exchange-value is-blank">—</span>
        )}
      </div>
    </div>
  )
}
