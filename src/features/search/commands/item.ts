/**
 * `/i` 物品搜索命令：检索走 XIVAPI v2 的搜索接口（不再读本地 item-db.json）。
 * ⚠️ 接口的 query 值必须用双引号括起 —— 不加引号会 400（`error Char at: …`）。
 * 响应按 score 倒序返回，展示前改按 ID 降序重排（新物品在前，顺序稳定可预期）。
 * 选中物品钻入动作面板：复制 ID / 名称 / 打开 WIKI-物品 / 检索器 /（可交易时）打开查价。
 * 检索是远程的，可能失败也可能乱序回来，所以只提供 loadRows；
 * 防抖、取消与竞态判废统一由状态中枢（useLinkSearch）负责。
 */

import type { ActionRow, ItemHit, ItemRow, SlashCommand } from './types.ts'

/** XIVAPI v2 搜索接口。 */
const SEARCH_ENDPOINT = 'https://xivapi-v2.xivcdn.com/api/search'
/** /i 模式一次列出（同时也是向接口取回）的物品条数。 */
export const ITEM_RESULT_LIMIT = 10

/** 物品的 wiki 词条地址：只对物品名 encodeURIComponent，`物品:` 前缀与冒号保持明文（URL path 里合法，与站点实际形态一致）。 */
export function buildWikiUrl(name: string): string {
  return `https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(name)}`
}

/** Wiki 的物品检索器地址：按名称搜物品，落在搜索结果页而不是某个词条。 */
export function buildWikiSearchUrl(name: string): string {
  return `https://ff14.huijiwiki.com/wiki/ItemSearch?name=${encodeURIComponent(name)}`
}

/** 物品在 Universalis 的查价地址；不可交易物品没有这一动作（见 buildItemActions）。 */
export function buildMarketUrl(id: number): string {
  return `https://universalis.app/market/${String(id)}`
}

/** 解析搜索结果：逐条形状校验而非整体断言 —— 接口错乱时只丢认不出的条目，不整块崩掉。 */
function parseSearchResults(payload: unknown): ItemHit[] {
  if (typeof payload !== 'object' || payload === null) {
    return []
  }
  const results = (payload as { results?: unknown }).results
  if (!Array.isArray(results)) {
    return []
  }

  const hits: ItemHit[] = []
  for (const entry of results) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const row = entry as { row_id?: unknown; fields?: unknown }
    const fields = row.fields
    if (typeof row.row_id !== 'number' || typeof fields !== 'object' || fields === null) {
      continue
    }
    const { Name, IsUntradable } = fields as { Name?: unknown; IsUntradable?: unknown }
    if (typeof Name !== 'string') {
      continue
    }
    hits.push({ id: row.row_id, name: Name, untradable: IsUntradable === true })
  }
  return hits
}

/** 按名称检索物品。`signal` 用于取消：输入变化时状态中枢会中止上一次请求。 */
export async function searchItems(query: string, signal: AbortSignal): Promise<ItemHit[]> {
  // query 的值必须带引号；名字里混进引号会破坏 query 语法，先剔掉
  const keyword = query.trim().replace(/"/g, '')
  const expression = `Name~"${keyword}"`
  const url = `${SEARCH_ENDPOINT}?sheets=Item&fields=Name,IsUntradable&query=${encodeURIComponent(expression)}&limit=${ITEM_RESULT_LIMIT}`

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return parseSearchResults(await response.json())
}

/**
 * 某个物品的钻取动作（面板第二层），全部是声明式 ActionRow：
 * 复制走剪贴板、打开走新标签页，由状态中枢统一执行；这里不碰 DOM / 剪贴板 / 弹窗。
 */
export function buildItemActions(item: ItemHit): ActionRow[] {
  const actions: ActionRow[] = [
    {
      key: `item:${item.id}:copy-name`,
      kind: 'action',
      title: '复制物品名称',
      note: item.name,
      run: { type: 'copy', text: item.name },
    },
    {
      key: `item:${item.id}:copy-id`,
      kind: 'action',
      title: '复制物品 ID',
      note: `#${item.id}`,
      run: { type: 'copy', text: String(item.id) },
    },
    {
      key: `item:${item.id}:open-wiki`,
      kind: 'action',
      title: '在 WIK 中查看',
      note: `ff14.huijiwiki.com`,
      run: { type: 'open', url: buildWikiUrl(item.name) },
    },
    {
      key: `item:${item.id}:open-wiki-search`,
      kind: 'action',
      title: '打开物品检索器',
      note: `ff14.huijiwiki.com`,
      run: { type: 'open', url: buildWikiSearchUrl(item.name) },
    },
  ]

  // 不可交易的物品上不了市场，查价无意义 —— 直接不出现这一行
  if (!item.untradable) {
    actions.push({
      key: `item:${item.id}:open-market`,
      kind: 'action',
      title: '打开 Universalis 查价',
      note: 'universalis.app',
      run: { type: 'open', url: buildMarketUrl(item.id) },
    })
  }

  return actions
}

export const itemCommand: SlashCommand = {
  key: 'i',
  placeholder: '输入物品名称…',
  hint: '输入物品名称，最多列出 10 条匹配，回车查看可用操作',
  resultTitle: '匹配的物品',
  async loadRows(query, signal) {
    const hits = await searchItems(query, signal)
    // 接口按相关度（score）返回，这里改成按 ID 降序：新物品在前，顺序稳定可预期
    hits.sort((left, right) => right.id - left.id)
    return hits.slice(0, ITEM_RESULT_LIMIT).map<ItemRow>((item) => ({
      key: `item:${item.id}`,
      kind: 'item',
      title: item.name,
      item,
    }))
  },
  buildActions(row) {
    // 只有物品行可钻取；动作行本身不再展开
    return row.kind === 'item' ? buildItemActions(row.item) : []
  },
  notice(query, rowCount) {
    // 加载中 / 失败由状态中枢给出；这里只负责「结果到了但是没有匹配」这一档
    if (query.trim() === '') {
      return null
    }
    return rowCount === 0 ? '没有匹配的物品' : null
  },
}
