/** 物品价格组件的配置类型、默认值与归一化（纯数据，无组件）。 */
import { CHINA_REGION, isScopeName } from '../../../../core/world.ts'

/**
 * 缓存有效期 1 小时。
 *
 * 组件只在页面打开（或换物品 / 换区服）时看一次缓存，
 * 命中且未过期就直接用、不发请求；过期了才请求一次。
 * 因此这个值同时也是"最长会看到多久以前的价格"。
 */
export const MARKET_CACHE_TTL_MS = 60 * 60 * 1000

export type MarketConfig = {
  /**
   * 物品 id。
   *
   * UI 目前只允许选一个，但**用数组存**：接口的 itemIds 本来就是逗号分隔的多个，
   * 将来开放多选不必迁移已有数据。
   */
  itemIds: number[]
  /** 区服：服务器名、大区名，或 `中国`（整个中国区）。 */
  scope: string
  /** 基准单价（可选）。最低挂价高于它标红、低于它标绿；缺失则不比较。 */
  basePrice?: number
}

export const MARKET_DEFAULT_CONFIG: MarketConfig = {
  itemIds: [],
  scope: CHINA_REGION,
}

function toItemIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const ids: number[] = []
  for (const entry of raw) {
    const parsed = typeof entry === 'number' ? entry : Number(entry)
    // 只接受正整数，顺手去重；顺序保持用户选择的先后
    if (Number.isInteger(parsed) && parsed > 0 && !ids.includes(parsed)) {
      ids.push(parsed)
    }
  }
  return ids
}

function toBasePrice(raw: unknown): number | undefined {
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return Math.round(parsed)
}

export function normalizeMarketConfig(raw: unknown): MarketConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  // 区服只认世界表里真实存在的名字：拼错的话接口会 404，
  // 与其每次都报一次错，不如回落到默认值
  const rawScope = typeof source.scope === 'string' ? source.scope.trim() : ''
  const scope = isScopeName(rawScope) ? rawScope : CHINA_REGION

  return {
    itemIds: toItemIds(source.itemIds),
    scope,
    basePrice: toBasePrice(source.basePrice),
  }
}
