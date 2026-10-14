/**
 * 价格缓存（localStorage，纯逻辑无 React）。**整个缓存只占一个键**，内部按「区服 + 物品」
 * 分条目 —— 换几个物品/区服就散落一串键，合成一条既好数，也能**每次写入时顺手清过期条目**
 * （不随时间堆积）。条目**按单个物品拆开存**：卡片随时增删、改物品，批量请求的物品组合
 * 每次都不同，整存组合一变就全 miss，拆成一件一条后谁查过且没过期，谁来问都命中。
 * 网页打开时命中未过期缓存就直接用、**不发请求**。localStorage 在隐私模式 / 配额超限会抛
 * （写法对齐 `core/search/store.ts`），一律 try/catch，缓存失败不影响功能。
 */
import { MARKET_CACHE_TTL_MS } from './config.ts'
import type { ItemMarket, MarketData } from './universalis.ts'

/** 整个价格缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash-cache:market:v1'

/** 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。 */
const CACHE_VERSION = 1

type MarketCacheFile = {
  version: number
  /** 条目 key（`entryKey`）→ 数据。 */
  entries: Record<string, MarketData>
}

/**
 * 条目的 key = 区服 + 物品组合；物品顺序不影响接口结果，排序后拼，[3,5] 与 [5,3] 共用同一条。
 * 实际写入组合恒为单个物品（见 `splitByItem`），key 即 `区服:物品id`；保留数组形态只是让
 * 读取端能按多个物品拼 key，将来开放多选不必改结构。
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

/**
 * 读取这几个物品的缓存。过期与否由调用方用 `isFresh` 判断 —— 过期数据仍可用于先渲染后刷新。
 * 条目按物品拆开存，这里逐个物品取再拼回一份 `MarketData`：**有一个物品没缓存就整体 miss**
 * （返回 null，交给调用方重新请求）—— 半份数据会出现"有的有价、有的空白"；
 * `fetchedAt` 取各条里**最早**的那个：有效期按最旧的数据算，宁早不晚。
 */
export function readMarketCache(scope: string, itemIds: number[]): MarketData | null {
  if (itemIds.length === 0) {
    return null
  }
  const entries = readFile().entries
  const items: ItemMarket[] = []
  const failedItems: number[] = []
  let fetchedAt = 0

  for (const itemId of itemIds) {
    const entry = entries[entryKey(scope, [itemId])]
    if (!isMarketData(entry) || entry.scope !== scope) {
      return null
    }
    items.push(...entry.items)
    failedItems.push(...entry.failedItems)
    fetchedAt = fetchedAt === 0 ? entry.fetchedAt : Math.min(fetchedAt, entry.fetchedAt)
  }

  return { scope, itemIds: [...itemIds], items, failedItems, fetchedAt }
}

/** 是否还在有效期内。 */
export function isFresh(data: MarketData, now: number): boolean {
  return now - data.fetchedAt < MARKET_CACHE_TTL_MS
}

/**
 * 把一次批量请求的结果**按物品拆条**写入，并**顺手清掉所有已过期条目**。
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

  for (const entry of splitByItem(data)) {
    entries[entryKey(entry.scope, entry.itemIds)] = entry
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, entries }))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}

/**
 * 把一份（可能含多个物品的）结果切成「一件一条」。
 * 是 `failedItems` 独有的物品也补一条（内容为空）：不补的话，这类"接口明确说查不到"的
 * 物品因盘上没有条目，每次进网页都会再请求一次。
 */
function splitByItem(data: MarketData): MarketData[] {
  const failed = new Set(data.failedItems)
  const pieces: MarketData[] = []
  const covered = new Set<number>()

  for (const item of data.items) {
    covered.add(item.itemId)
    pieces.push({
      scope: data.scope,
      itemIds: [item.itemId],
      items: [item],
      failedItems: failed.has(item.itemId) ? [item.itemId] : [],
      fetchedAt: data.fetchedAt,
    })
  }

  for (const itemId of data.failedItems) {
    if (covered.has(itemId)) {
      continue
    }
    pieces.push({
      scope: data.scope,
      itemIds: [itemId],
      items: [],
      failedItems: [itemId],
      fetchedAt: data.fetchedAt,
    })
  }

  return pieces
}
