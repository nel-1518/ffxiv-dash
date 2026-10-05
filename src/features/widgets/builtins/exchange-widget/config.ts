/**
 * 汇率卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * 一张卡盯一个货币对：基准货币 `base` → 目标货币 `quote`。
 * 默认人民币 → 日元（看日区定价 / 日服消费是最高频的需求）。
 */
import { isCurrencyCode } from './currencies.ts'

/**
 * 缓存有效期 8 小时。
 *
 * 央行参考汇率每个交易日只更新一次，缓存短过这个节奏只会白发请求；
 * 8 小时意味着一张卡一天最多拉三次，停留期间完全不轮询。
 */
export const EXCHANGE_CACHE_TTL_MS = 8 * 60 * 60 * 1000

export type ExchangeConfig = {
  /** 基准货币（ISO 4217 代码）。 */
  base: string
  /** 目标货币（ISO 4217 代码）。 */
  quote: string
}

export const EXCHANGE_DEFAULT_CONFIG: ExchangeConfig = { base: 'CNY', quote: 'JPY' }

/**
 * 补默认值并挡掉表外代码：不认识的回落到默认对的对应一侧，
 * 两侧相同（同一种货币没有「汇率」，多半是误操作）则整对退回默认。
 */
export function normalizeExchangeConfig(raw: unknown): ExchangeConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const base = isCurrencyCode(source.base) ? (source.base as string).toUpperCase() : EXCHANGE_DEFAULT_CONFIG.base
  const quote = isCurrencyCode(source.quote) ? (source.quote as string).toUpperCase() : EXCHANGE_DEFAULT_CONFIG.quote
  return base === quote ? EXCHANGE_DEFAULT_CONFIG : { base, quote }
}
