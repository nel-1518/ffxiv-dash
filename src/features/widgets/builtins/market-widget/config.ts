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

/**
 * 物品信息快照：选中物品的那一刻跟着配置一起存下来。
 *
 * 存在的意义是**卡片不必再依赖物品库**：没有它的话，每次进网页都要为了
 * 「这个 id 叫什么、有没有 HQ」去拉一次几 MB 的 `item-db.json`。
 * 字段与物品库的条目（`items.ts` 的 `ItemEntry`）故意保持同形，两边可直接互赋。
 */
export type MarketItemMeta = {
  id: number
  name: string
  /** 1 = 该物品有 HQ 版本，0 = 没有。与物品库字段一致。 */
  hq: number
}

export type MarketConfig = {
  /**
   * 物品 id。
   *
   * UI 目前只允许选一个，但**用数组存**：接口的 itemIds 本来就是逗号分隔的多个，
   * 将来开放多选不必迁移已有数据。
   */
  itemIds: number[]
  /**
   * 与 `itemIds` 对应的物品快照，见 `MarketItemMeta`。
   *
   * 归一化时按 `itemIds` 过滤：配置里只留当前选中物品的信息，改选别的物品后旧快照自然消失。
   * 本字段出现之前存下的老配置这里是空数组，卡片会去物品库现查一次并写回（见 `fields.tsx`）。
   */
  itemMeta: MarketItemMeta[]
  /** 区服：服务器名、大区名，或 `中国`（整个中国区）。 */
  scope: string
  /** 基准单价（可选）。最低挂价低于它用主题强调色，缺失则不比较。 */
  basePrice?: number
}

export const MARKET_DEFAULT_CONFIG: MarketConfig = {
  itemIds: [],
  itemMeta: [],
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

/**
 * 快照列表。
 *
 * 三条规矩：名称必须是有效字符串（名称才是这张快照的全部意义，空名等同于没有）、
 * id 必须在当前的 `itemIds` 里（顺手把改选物品后残留的旧快照筛掉）、同一 id 只留一条。
 */
function toItemMeta(raw: unknown, itemIds: number[]): MarketItemMeta[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const metas: MarketItemMeta[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const record = entry as Record<string, unknown>
    const id = Number(record.id)
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!Number.isInteger(id) || id <= 0 || name === '' || !itemIds.includes(id)) {
      continue
    }
    if (metas.some((meta) => meta.id === id)) {
      continue
    }

    // hq 收敛成 0 / 1：界面只判「是不是 0」，不关心物品库将来怎么扩展这个字段
    metas.push({ id, name, hq: Number(record.hq) === 0 ? 0 : 1 })
  }
  return metas
}

export function normalizeMarketConfig(raw: unknown): MarketConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  // 区服只认世界表里真实存在的名字：拼错的话接口会 404，
  // 与其每次都报一次错，不如回落到默认值
  const rawScope = typeof source.scope === 'string' ? source.scope.trim() : ''
  const scope = isScopeName(rawScope) ? rawScope : CHINA_REGION

  const itemIds = toItemIds(source.itemIds)

  return {
    itemIds,
    // 先有 itemIds 才能过滤快照，顺序不能颠倒
    itemMeta: toItemMeta(source.itemMeta, itemIds),
    scope,
    basePrice: toBasePrice(source.basePrice),
  }
}
