/** 物品价格组件的配置类型、默认值与归一化（纯数据，无组件）。 */
import { CHINA_REGION, isScopeName } from '../../../../core/world.ts'

/** 缓存有效期 29 分钟。超过就视为过期，下次打开会重新请求。 */
export const MARKET_CACHE_TTL_MS = 29 * 60 * 1000

/**
 * 定时重取间隔 30 分钟。
 *
 * 刻意比 TTL 长 1 分钟：到点时缓存必然已经过期，重取不会白跑；
 * 若两者相等，恰好卡在边界上容易"明明有缓存却仍去请求"。
 */
export const MARKET_REFRESH_MS = 30 * 60 * 1000

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
  // 与其每 30 分钟报一次错，不如回落到默认值
  const rawScope = typeof source.scope === 'string' ? source.scope.trim() : ''
  const scope = isScopeName(rawScope) ? rawScope : CHINA_REGION

  return {
    itemIds: toItemIds(source.itemIds),
    scope,
    basePrice: toBasePrice(source.basePrice),
  }
}
