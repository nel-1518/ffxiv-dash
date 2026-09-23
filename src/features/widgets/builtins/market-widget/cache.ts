/**
 * 价格缓存（localStorage，纯逻辑无 React）。
 *
 * **整个缓存只占一个键**，内部按「区服 + 物品组合」分条目。早先是"一个组合一个键"，
 * 换几个物品/区服就会在 localStorage 里散落一串键；合成一条之后既好数，
 * 也能在**每次写入时顺手把过期条目一起清掉**，不会随时间无限堆积。
 *
 * 网页打开时先看它：命中且未过期就直接用、**不发请求** —— 这正是「有缓存就不请求」的落地方式。
 *
 * 写法对齐其它 localStorage 缓存（如 `core/search/store.ts`）：localStorage 在隐私模式 / 配额超限时会抛，
 * 一律 try/catch 掉，缓存失败不影响功能。
 */
import { MARKET_CACHE_TTL_MS } from './config.ts'
import type { MarketData } from './universalis.ts'

/** 整个价格缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash:market:v2'

/** 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。 */
const CACHE_VERSION = 1

type MarketCacheFile = {
  version: number
  /** 条目 key（`entryKey`）→ 数据。 */
  entries: Record<string, MarketData>
}

/**
 * 条目的 key = 区服 + 物品组合。
 * 物品顺序不影响接口结果，排序后再拼，[3,5] 与 [5,3] 才能共用同一条。
 */
function entryKey(scope: string, itemIds: number[]): string {
  return `${scope}:${[...itemIds].sort((left, right) => left - right).join(',')}`
}

function emptyFile(): MarketCacheFile {
  return { version: CACHE_VERSION, entries: {} }
}

function isMarketData(value: unknown): value is MarketData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.scope === 'string' &&
    typeof entry.fetchedAt === 'number' &&
    Array.isArray(entry.itemIds) &&
    Array.isArray(entry.items) &&
    Array.isArray(entry.failedItems)
  )
}

/** 读整个缓存文件。任何异常（无键 / 坏 JSON / 版本不符）都退化成空缓存。 */
function readFile(): MarketCacheFile {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return emptyFile()
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return emptyFile()
    }
    const file = parsed as Partial<MarketCacheFile>
    if (file.version !== CACHE_VERSION || typeof file.entries !== 'object' || file.entries === null) {
      return emptyFile()
    }
    return { version: CACHE_VERSION, entries: file.entries }
  } catch {
    return emptyFile()
  }
}

/** 读取某个组合的缓存。过期与否由调用方用 `isFresh` 判断 —— 过期数据仍可用于先渲染后刷新。 */
export function readMarketCache(scope: string, itemIds: number[]): MarketData | null {
  if (itemIds.length === 0) {
    return null
  }
  const entry = readFile().entries[entryKey(scope, itemIds)]
  if (!isMarketData(entry) || entry.scope !== scope) {
    return null
  }
  return entry
}

/** 是否还在有效期内。 */
export function isFresh(data: MarketData, now: number): boolean {
  return now - data.fetchedAt < MARKET_CACHE_TTL_MS
}

/**
 * 写入一条，并**顺手清掉所有已过期条目**。
 *
 * 清理和写入共用 `MARKET_CACHE_TTL_MS`：缓存只有"还能用"与"该删了"两种状态，
 * 过期数据留在盘上不会有人读，只会白占地方。
 */
export function writeMarketCache(data: MarketData): void {
  const file = readFile()
  const entries: Record<string, MarketData> = {}
  const now = Date.now()

  // 未过期的旧条目原样带走，过期的一律不带
  for (const [key, entry] of Object.entries(file.entries)) {
    if (isMarketData(entry) && now - entry.fetchedAt < MARKET_CACHE_TTL_MS) {
      entries[key] = entry
    }
  }

  entries[entryKey(data.scope, data.itemIds)] = data

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, entries }))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
