/**
 * Universalis 聚合接口（纯逻辑，无 React）。
 *
 * 只做三件事：拼 URL、发请求（同一 URL 去重）、把响应按区服档位翻译成读数。
 *
 * 接口：`GET /api/v2/aggregated/{worldDcRegion}/{itemIds}`
 * 响应里 `nq` / `hq` 各含 minListing、averageSalePrice、recentPurchase 等统计项，
 * 而每一项都是 `{ world, dc, region }` 三档 —— 正好对应三级区服选择，
 * 所以「选了哪个粒度就读哪一档」由 `resolveTier` 决定。
 */
import { resolveTier, worldNameById } from './scopes.ts'
import type { ScopeTier } from './scopes.ts'

const API_BASE = 'https://universalis.app/api/v2/aggregated'
/** 网页版物品页；卡片正文整块点它就跳这里。 */
const WEB_BASE = 'https://universalis.app/market'

/** 一行读数。 */
export type PriceReading = {
  /** 单价，单位金币。接口在没有数据时返回 0。 */
  price: number
  /** 是否真的有数据。`price <= 0` 一律视为无数据，不能显示成「0 金币」。 */
  hasData: boolean
  /** 该价格出自哪个服务器；查单个服务器时接口不返回 worldId，故可能为空。 */
  worldName?: string
  /** 成交时间（epoch ms），只有最近成交价带。 */
  timestamp?: number
}

export type QualityReadings = {
  minListing: PriceReading
  averageSalePrice: PriceReading
  recentPurchase: PriceReading
}

export type ItemMarket = {
  itemId: number
  nq: QualityReadings
  hq: QualityReadings
}

export type MarketData = {
  scope: string
  itemIds: number[]
  items: ItemMarket[]
  /** 接口明确表示取不到数据的物品 id。 */
  failedItems: number[]
  /** 数据到手时刻，缓存有效期以它为准。 */
  fetchedAt: number
}

export function buildAggregatedUrl(scope: string, itemIds: number[]): string {
  return `${API_BASE}/${encodeURIComponent(scope)}/${itemIds.join(',')}`
}

/** 该物品在 Universalis 网页上的地址。 */
export function buildMarketPageUrl(itemId: number): string {
  return `${WEB_BASE}/${itemId}`
}

/** 从 `{ world, dc, region }` 里取指定档。该档不存在时返回 undefined，也就是「无数据」。 */
function pickTier(raw: unknown, tier: ScopeTier): unknown {
  const group = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return group[tier]
}

function toReading(entry: unknown): PriceReading {
  const source = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
  const price = typeof source.price === 'number' && Number.isFinite(source.price) ? source.price : 0
  const worldId = typeof source.worldId === 'number' ? source.worldId : undefined
  const timestamp = typeof source.timestamp === 'number' ? source.timestamp : undefined

  return {
    price,
    hasData: price > 0,
    worldName: worldNameById(worldId),
    timestamp,
  }
}

/**
 * 平均售价。
 *
 * ⚠️ 接口只按**大区 / 全区**算它 —— 实测查「拉诺西亚」时 `averageSalePrice` 只有 `dc` 与
 * `region`，就是没有 `world`（`minListing` / `recentPurchase` 则是有 `world` 档的）。
 * 所以**选单个服务器时放宽到大区档**，否则这一行永远是「—」。
 *
 * 这时显示的数字其实是**大区**均价，不是本服均价。
 *
 * `minListing` / `recentPurchase` **刻意不回退**：它们本身有 `world` 档，缺失就意味着
 * 「这个服确实没货」，拿别服的价格顶上会真的误导。大区/全区的平均售价也不回退，
 * 那两档缺失说明是真的没有成交数据。
 */
function toAverageSalePrice(raw: unknown, tier: ScopeTier): PriceReading {
  const group = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  if (tier !== 'world') {
    return toReading(group[tier])
  }

  for (const candidate of ['world', 'dc', 'region'] as const) {
    const entry = group[candidate]
    if (typeof entry === 'object' && entry !== null) {
      return toReading(entry)
    }
  }
  return toReading(undefined)
}

function toQuality(raw: unknown, tier: ScopeTier): QualityReadings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    minListing: toReading(pickTier(source.minListing, tier)),
    averageSalePrice: toAverageSalePrice(source.averageSalePrice, tier),
    recentPurchase: toReading(pickTier(source.recentPurchase, tier)),
  }
}

export function parseAggregated(
  payload: unknown,
  scope: string,
  itemIds: number[],
  fetchedAt: number,
): MarketData {
  const tier = resolveTier(scope)
  const root = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
  const rawResults = Array.isArray(root.results) ? root.results : []

  const items: ItemMarket[] = rawResults.map((raw) => {
    const result = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const itemId = typeof result.itemId === 'number' ? result.itemId : 0
    return { itemId, nq: toQuality(result.nq, tier), hq: toQuality(result.hq, tier) }
  })

  const failedItems = Array.isArray(root.failedItems)
    ? root.failedItems.filter((value): value is number => typeof value === 'number')
    : []

  return { scope, itemIds, items, failedItems, fetchedAt }
}

/** 同一 URL 的并发请求合并成一次：StrictMode 双挂载、多张同参数卡片都只发一次。 */
const inFlight = new Map<string, Promise<MarketData>>()

export function fetchMarket(scope: string, itemIds: number[]): Promise<MarketData> {
  const url = buildAggregatedUrl(scope, itemIds)
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
      return parseAggregated(payload, scope, itemIds, Date.now())
    })
    .catch((error: unknown) => {
      /*
       * 失败细节只进控制台：卡面上只在标题行留一个「获取失败」，不占版面。
       * 记在这里而不是调用方 —— 同一 URL 的并发调用共用这一个 Promise，
       * 所以一次真实请求只会打一条（在调用方记会被 StrictMode 双挂载打成两条）。
       */
      console.error('[ffxiv-dash] 物品价格获取失败', { scope, itemIds, url, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(url)
    })

  inFlight.set(url, task)
  return task
}
