/**
 * 物品库（`public/data/item-db.json`）的按需加载与检索（纯逻辑，无 React）。
 * 文件有几 MB 且单行，**不打包进 bundle**，只在非它不可时拉一次、之后挂模块级 Promise
 * 全应用共用：① 打开编辑弹窗检索（必须全量）；② 老配置还没有物品快照（`config.ts` 的
 * `itemMeta`），卡片得现查名称。新存的卡片两条都不走，**进网页不会因这张卡拉物品库**。
 * 模块级状态而非传数组：调用方（下拉与卡片）只问「现在能搜了吗」，不必把几万条传来传去。
 */

import { assetUrl } from '../../../../core/asset-url.ts'
import type { PublicPath } from '../../../../core/asset-url.ts'

/** 物品库在 `public/data/` 下：`PublicPath` 保证写法是 `/` 开头的部署无关路径。 */
const ITEM_DB_PATH: PublicPath = '/data/item-db.json'
const ITEM_DB_URL = assetUrl(ITEM_DB_PATH)

/** 待选列表上限。 */
export const MAX_ITEM_SUGGESTIONS = 10

export type ItemEntry = {
  id: number
  name: string
  /** 1 = 该物品有 HQ 版本，0 = 没有。 */
  hq: number
}

export type ItemDbStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

let items: ItemEntry[] = []
/** 预先小写化的名称，避免每次按键都对几万条做 toLowerCase。 */
let lowerNames: string[] = []
let byId = new Map<number, ItemEntry>()
let state: ItemDbStatus = { status: 'idle' }
let pending: Promise<void> | null = null

export function getItemDbStatus(): ItemDbStatus {
  return state
}

/** 加载物品库；重复调用共享同一个 Promise。失败后不保留 Promise，允许重试。 */
export function loadItemDb(): Promise<void> {
  if (pending) {
    return pending
  }

  state = { status: 'loading' }
  pending = fetch(ITEM_DB_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const parsed: unknown = await response.json()
      const list = Array.isArray(parsed) ? (parsed as ItemEntry[]) : []
      items = list
      lowerNames = list.map((item) => item.name.toLowerCase())
      byId = new Map(list.map((item) => [item.id, item]))
      state = { status: 'ready' }
    })
    .catch((error: unknown) => {
      pending = null
      state = { status: 'error', message: error instanceof Error ? error.message : '未知错误' }
      throw error
    })

  return pending
}

/**
 * 按名称或 ID 检索，最多 `limit` 条、**按 id 倒序**。
 * ID 走前缀匹配：输入「1602」能直接定位到 1602 与 16020，比只认完整 ID 好用。
 */
export function searchItems(query: string, limit = MAX_ITEM_SUGGESTIONS): ItemEntry[] {
  const keyword = query.trim().toLowerCase()
  if (keyword === '') {
    return []
  }

  const hits: ItemEntry[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (lowerNames[index].includes(keyword) || String(item.id).startsWith(keyword)) {
      hits.push(item)
    }
  }

  hits.sort((left, right) => right.id - left.id)
  return hits.slice(0, limit)
}

export function findItem(id: number): ItemEntry | undefined {
  return byId.get(id)
}
