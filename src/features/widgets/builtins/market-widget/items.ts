/**
 * 物品库（`public/data/item-db.json`）的按需加载与检索（纯逻辑，无 React）。
 *
 * 文件有几 MB 且是单行，**不打包进 bundle**，只在非它不可时才拉一次，之后挂在模块级
 * Promise 上、全应用共用同一份：
 * ① 打开编辑弹窗选物品（检索本身就需要全量数据）；
 * ② 更早版本的配置里还没有物品快照（见 `config.ts` 的 `itemMeta`），卡片得现查一次名称。
 * 新存的卡片不会走第 ② 条 —— 名称与 HQ 已经随配置一起落盘，
 * 所以**进网页时不会因为这张卡拉物品库**（`useItemDb` 的 `enabled` 参数把这件事钉在调用点）。
 *
 * 模块级状态而不是每次传数组：调用方（下拉与卡片）只要问「现在能搜了吗」，
 * 不必把几万条数据当参数传来传去。
 */

const ITEM_DB_URL = `${import.meta.env.BASE_URL}data/item-db.json`

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
 * 按名称或 ID 检索，最多 `limit` 条，**按 id 倒序**。
 *
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
