/**
 * 税率缓存（localStorage，纯逻辑无 React）。
 *
 * 与物品价格 / 房屋卡同一套写法：**整个缓存只占一个键**，内部按服务器分条目，
 * 写入时顺手把过期条目一起清掉，不会随时间无限堆积。
 * 网页打开时先看它：命中且未过期就直接用、**不发请求**。
 */
import { TAX_CACHE_TTL_MS } from './config.ts'
import type { TaxRates } from './rates.ts'

/** 整个税率缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash:tax:v1'

/** 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。 */
const CACHE_VERSION = 1

type TaxCacheFile = {
  version: number
  /** 服务器 id（字符串）→ 数据。 */
  entries: Record<string, TaxRates>
}

function emptyFile(): TaxCacheFile {
  return { version: CACHE_VERSION, entries: {} }
}

/** 缓存来自 localStorage、可能被手改过：逐字段验过才敢当 `TaxRates` 用。 */
function isTaxRow(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const row = value as Record<string, unknown>
  return (
    typeof row.key === 'string' &&
    typeof row.label === 'string' &&
    (row.rate === null || typeof row.rate === 'number')
  )
}

function isTaxRates(value: unknown): value is TaxRates {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.server === 'number' &&
    typeof entry.serverName === 'string' &&
    typeof entry.fetchedAt === 'number' &&
    Array.isArray(entry.rates) &&
    entry.rates.every(isTaxRow)
  )
}

/** 读整个缓存文件。任何异常（无键 / 坏 JSON / 版本不符）都退化成空缓存。 */
function readFile(): TaxCacheFile {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return emptyFile()
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return emptyFile()
    }
    const file = parsed as Partial<TaxCacheFile>
    if (file.version !== CACHE_VERSION || typeof file.entries !== 'object' || file.entries === null) {
      return emptyFile()
    }
    return { version: CACHE_VERSION, entries: file.entries }
  } catch {
    return emptyFile()
  }
}

/** 读取某个服务器的缓存。过期与否由调用方用 `isFresh` 判断 —— 过期数据仍可用于先渲染后刷新。 */
export function readTaxCache(server: number): TaxRates | null {
  const entry = readFile().entries[String(server)]
  if (!isTaxRates(entry) || entry.server !== server) {
    return null
  }
  return entry
}

/** 是否还在有效期内。 */
export function isFresh(data: TaxRates, now: number): boolean {
  return now - data.fetchedAt < TAX_CACHE_TTL_MS
}

/**
 * 写入一条，并**顺手清掉所有已过期条目**。
 *
 * 清理和写入共用 `TAX_CACHE_TTL_MS`：缓存只有"还能用"与"该删了"两种状态，
 * 过期数据留在盘上不会有人读，只会白占地方。
 */
export function writeTaxCache(data: TaxRates): void {
  const file = readFile()
  const entries: Record<string, TaxRates> = {}
  const now = Date.now()

  // 未过期的旧条目原样带走，过期的一律不带
  for (const [key, entry] of Object.entries(file.entries)) {
    if (isTaxRates(entry) && now - entry.fetchedAt < TAX_CACHE_TTL_MS) {
      entries[key] = entry
    }
  }

  entries[String(data.server)] = data

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, entries }))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
