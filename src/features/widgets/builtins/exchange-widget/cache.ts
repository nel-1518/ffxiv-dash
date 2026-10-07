/**
 * 汇率缓存（localStorage，纯逻辑无 React）。
 *
 * 与市场税率 / 物品价格同一套写法：**整个缓存只占一个键**，内部按货币对分条目，
 * 写入时顺手把过期条目一起清掉，不会随时间无限堆积。
 * 网页打开时先看它：命中且未过期就直接用、**不发请求**。
 */
import { EXCHANGE_CACHE_TTL_MS } from './config.ts'
import type { ExchangeRate } from './rates.ts'

/** 整个汇率缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash-cache:exchange:v1'

/** 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。 */
const CACHE_VERSION = 1

type ExchangeCacheFile = {
  version: number
  /** `BASE-QUOTE` → 数据。 */
  entries: Record<string, ExchangeRate>
}

function emptyFile(): ExchangeCacheFile {
  return { version: CACHE_VERSION, entries: {} }
}

/** 缓存来自 localStorage、可能被手改过：逐字段验过才敢当 `ExchangeRate` 用。 */
function isExchangeRate(value: unknown): value is ExchangeRate {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.base === 'string' &&
    typeof entry.quote === 'string' &&
    typeof entry.rate === 'number' &&
    Number.isFinite(entry.rate) &&
    entry.rate > 0 &&
    typeof entry.date === 'string' &&
    typeof entry.fetchedAt === 'number'
  )
}

function pairKey(base: string, quote: string): string {
  return `${base}-${quote}`
}

/** 读整个缓存文件。任何异常（无键 / 坏 JSON / 版本不符）都退化成空缓存。 */
function readFile(): ExchangeCacheFile {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return emptyFile()
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return emptyFile()
    }
    const file = parsed as Partial<ExchangeCacheFile>
    if (file.version !== CACHE_VERSION || typeof file.entries !== 'object' || file.entries === null) {
      return emptyFile()
    }
    return { version: CACHE_VERSION, entries: file.entries }
  } catch {
    return emptyFile()
  }
}

/** 读取某个货币对的缓存。过期与否由调用方用 `isFresh` 判断 —— 过期数据仍可用于先渲染后刷新。 */
export function readExchangeCache(base: string, quote: string): ExchangeRate | null {
  const entry = readFile().entries[pairKey(base, quote)]
  if (!isExchangeRate(entry) || entry.base !== base || entry.quote !== quote) {
    return null
  }
  return entry
}

/** 是否还在有效期内。 */
export function isFresh(data: ExchangeRate, now: number): boolean {
  return now - data.fetchedAt < EXCHANGE_CACHE_TTL_MS
}

/**
 * 写入一条，并**顺手清掉所有已过期条目**。
 *
 * 清理和写入共用 `EXCHANGE_CACHE_TTL_MS`：过期数据留在盘上不会有人读，只会白占地方。
 */
export function writeExchangeCache(data: ExchangeRate): void {
  const file = readFile()
  const entries: Record<string, ExchangeRate> = {}
  const now = Date.now()

  // 未过期的旧条目原样带走，过期的一律不带
  for (const [key, entry] of Object.entries(file.entries)) {
    if (isExchangeRate(entry) && now - entry.fetchedAt < EXCHANGE_CACHE_TTL_MS) {
      entries[key] = entry
    }
  }

  entries[pairKey(data.base, data.quote)] = data

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, entries }))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
