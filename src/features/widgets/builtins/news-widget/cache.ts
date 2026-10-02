/**
 * 公告活动缓存（localStorage，纯逻辑无 React）。
 *
 * 与税率 / 物品价格 / 房屋卡同一套写法，只是这里**只有一份数据**
 * （接口与参数都固定，不像税率按服务器分条目），所以整个缓存就是一个键：
 * 存 `fetchedAt` + 条目数组，写入即覆盖。
 * 网页打开时先看它：命中且未过期就直接用、**不发请求**。
 *
 * ⚠️ 缓存要连**当时的条数**（`limit`）一起存：请求的 `pageSize` 就是它，
 * 5 条的那份数据给不了 20 行的卡。条数对不上就当作没缓存 —— 正好也是
 * "改了「公告数量」就按新条数重取一次"的落点（见 `fields.tsx` 的 effect）。
 */
import { NEWS_CACHE_TTL_MS } from './config.ts'
import type { NewsItem } from './api.ts'

/** 整个公告缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash:news:v1'

/**
 * 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。
 * v4：条目去掉 `weighted`（高亮不再看官网的 SortIndex）、缓存头加上 `limit`（请求条数）。
 */
const CACHE_VERSION = 4

type NewsCacheFile = {
  version: number
  fetchedAt: number
  /** 这份数据是按几行取的（= 请求的 `pageSize`）。 */
  limit: number
  items: NewsItem[]
}

/** 缓存里的那份数据（读出来即已验过字段）。 */
export type NewsCache = {
  /** 数据到手时刻（ms）。 */
  fetchedAt: number
  /** 这份数据是按几行取的；与当前配置不一致时调用方应当忽略它。 */
  limit: number
  items: NewsItem[]
}

/** 缓存来自 localStorage、可能被手改过：逐字段验过才敢当 `NewsItem` 用。 */
function isNewsItem(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'number' &&
    typeof item.title === 'string' &&
    typeof item.summary === 'string' &&
    typeof item.url === 'string' &&
    typeof item.external === 'boolean'
  )
}

/** 读缓存。任何异常（无键 / 坏 JSON / 版本不符 / 字段不全）都退化成 null。 */
export function readNewsCache(): NewsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const file = parsed as Partial<NewsCacheFile>
    if (
      file.version !== CACHE_VERSION ||
      typeof file.fetchedAt !== 'number' ||
      typeof file.limit !== 'number' ||
      !Array.isArray(file.items) ||
      !file.items.every(isNewsItem)
    ) {
      return null
    }
    return { fetchedAt: file.fetchedAt, limit: file.limit, items: file.items as NewsItem[] }
  } catch {
    return null
  }
}

/** 是否还在有效期内。 */
export function isNewsCacheFresh(cache: NewsCache, now: number): boolean {
  return now - cache.fetchedAt < NEWS_CACHE_TTL_MS
}

/** 写入一份（覆盖旧值）。 */
export function writeNewsCache(cache: NewsCache): void {
  try {
    const file: NewsCacheFile = { version: CACHE_VERSION, ...cache }
    localStorage.setItem(CACHE_KEY, JSON.stringify(file))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
