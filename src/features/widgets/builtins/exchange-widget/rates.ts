/**
 * Frankfurter 汇率接口（纯逻辑，无 React）。
 *
 * 接口：`GET https://api.frankfurter.dev/v2/rates?base=CNY&quotes=JPY` →
 * `[{"date":"2026-10-05","base":"CNY","quote":"JPY","rate":23.561}]`
 * —— 数组里每项是一条货币对，`rate` 是 1 基准货币能换多少目标货币，
 * `date` 是汇率所属的**交易日**（不是拿到响应的时刻，卡面上把它当数据日期展示）。
 * 数据是欧洲央行等多家央行参考汇率的中间价，每个交易日更新一次。
 */
const API_BASE = 'https://api.frankfurter.dev/v2/rates'

export type ExchangeRate = {
  /** 基准货币（与配置一致，缓存键与卡面标题都用它）。 */
  base: string
  /** 目标货币。 */
  quote: string
  /** 1 base = rate quote。 */
  rate: number
  /** 汇率所属交易日（`YYYY-MM-DD`，接口给的）。 */
  date: string
  /** 数据到手时刻，缓存有效期以它为准。 */
  fetchedAt: number
}

export function buildExchangeUrl(base: string, quote: string): string {
  return `${API_BASE}?base=${base}&quotes=${quote}`
}

/**
 * 解析成一条读数：v2 返回数组，从中找出目标货币对；
 * `rate` 必须是正的有限数、`date` 必须是字符串，找不到就抛错（由卡面提示获取失败）。
 */
export function parseExchangeRate(
  payload: unknown,
  base: string,
  quote: string,
  fetchedAt: number,
): ExchangeRate {
  const list = Array.isArray(payload) ? payload : []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) {
      continue
    }
    const row = item as Record<string, unknown>
    if (row.base !== base || row.quote !== quote) {
      continue
    }
    const rate = Number(row.rate)
    if (Number.isFinite(rate) && rate > 0 && typeof row.date === 'string') {
      return { base, quote, rate, date: row.date, fetchedAt }
    }
  }
  throw new Error('接口没有返回这对货币的汇率')
}

/** 同一 URL 的并发请求合并成一次：StrictMode 双挂载、多张同对卡片都只发一次。 */
const inFlight = new Map<string, Promise<ExchangeRate>>()

export function fetchExchangeRate(base: string, quote: string): Promise<ExchangeRate> {
  const url = buildExchangeUrl(base, quote)
  const running = inFlight.get(url)
  if (running) {
    return running
  }

  const task = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const payload: unknown = await response.json()
      return parseExchangeRate(payload, base, quote, Date.now())
    })
    .catch((error: unknown) => {
      /*
       * 失败细节只进控制台：卡面上只在标题行留一个「获取失败」，不占版面。
       * 记在这里而不是调用方 —— 同一 URL 的并发调用共用这一个 Promise，
       * 一次真实请求只会打一条。
       */
      console.error('[ffxiv-dash] 汇率获取失败', { base, quote, url, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(url)
    })

  inFlight.set(url, task)
  return task
}
