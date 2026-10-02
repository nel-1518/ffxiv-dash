/**
 * 公告活动卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * 三个可配项：`limit`（展示几条，**同时就是请求的 `pageSize`**）、
 * `highlight`（最多几条置顶高亮）、`keywords`（哪些词算重点条目）。
 *
 * `limit` 进了请求参数，所以任何配置改动都按当前配置**重新请求一次**
 * （见 `fields.tsx` 的 effect）；缓存也按条数对账，条数对不上就作废重取。
 */

/**
 * 数据来源：盛趣官方新闻列表接口。
 *
 * ⚠️ **只支持 JSONP**：响应带了一堆 CORS 头却**没有 `Access-Control-Allow-Origin`**，
 * 浏览器里的 fetch / XHR 会被直接拦掉（实测）；官网自己也是用 JSONP 调的。
 */
export const NEWS_API_BASE_URL = 'https://cqnews.web.sdo.com/api/news/newsList'

/**
 * 请求地址：游戏固定 ff，分类取综合 / 活动 / 公告（5313 当前无数据，一并带上不影响），
 * 第一页；**`pageSize` 就是要展示的条数** —— 要几条取几条，不取多余的。
 * 返回顺序即卡面顺序的基准（卡面**不重排**，只做置顶分区）。
 */
export function newsListUrl(limit: number): string {
  return `${NEWS_API_BASE_URL}?gameCode=ff&CategoryCode=5310,5311,5312,5313&pageIndex=0&pageSize=${String(limit)}`
}

/**
 * 新闻详情页前缀：官网是 hash 路由，`#/newstab/newscont/<Id>`。
 * （从官网 web8 的路由表确认：`path: "newscont/:itemId"`。）
 */
export const NEWS_DETAIL_BASE_URL = 'https://ff.web.sdo.com/web8/index.html#/newstab/newscont/'

/**
 * 缓存有效期 1 小时。
 *
 * 组件只在页面打开时看一次缓存，命中且未过期就直接用、不发请求；
 * 因此这个值同时也是"最长会看到多久以前的公告"。
 */
export const NEWS_CACHE_TTL_MS = 60 * 60 * 1000

/**
 * 默认的高亮关键字：标题里出现任一个即"命中"，会被拎到列表最前并用强调色显示
 * （季节活动 / 联动 / 莫古莫古这类"有时效、错过就没了"的活动）。
 *
 * 用户可在编辑弹窗里整份替换（`config.keywords`）。
 */
export const NEWS_DEFAULT_KEYWORDS = ['季节活动', '联动', '莫古莫古'] as const

/** 展示条数 / 请求条数的下限与上限。 */
export const NEWS_LIMIT_MIN = 5
export const NEWS_LIMIT_MAX = 20

/** 默认摆 10 条：一屏多一点，够看又不用滚太久。 */
export const NEWS_LIMIT_DEFAULT = 10

/** 置顶高亮条数的下限 / 上限：0 = 一条都不置顶。 */
export const NEWS_HIGHLIGHT_MIN = 0
export const NEWS_HIGHLIGHT_MAX = 5

export type NewsConfig = {
  /** 展示几条公告 —— 同时也是请求的 `pageSize`。 */
  limit: number
  /** 最多几条命中的条目被置顶 + 高亮；命中但超出上限的按普通条目留在原位。 */
  highlight: number
  /** 高亮关键字：标题含其中任一个即算命中（逐个关键字都过一遍）。空数组 = 一条都不高亮。 */
  keywords: string[]
}

/** 默认展示 10 条、高亮 5 条、关键字取 `NEWS_DEFAULT_KEYWORDS`。 */
export const NEWS_DEFAULT_CONFIG: NewsConfig = {
  limit: NEWS_LIMIT_DEFAULT,
  highlight: NEWS_HIGHLIGHT_MAX,
  keywords: [...NEWS_DEFAULT_KEYWORDS],
}

/** 取整并夹到区间内；非数字（旧数据 / 手改过的值）一律退回 `fallback`。 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/**
 * 关键字列表归一化：只留非空字符串、去掉首尾空白，并按首次出现去重（保留用户给的顺序）。
 *
 * ⚠️ 字段缺失（没配过的卡）与"显式空数组"是两回事：
 * 前者退回默认三词，后者是用户主动清空 —— 尊重它，一条都不高亮。
 */
function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...NEWS_DEFAULT_KEYWORDS]
  }
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const raw of value) {
    const keyword = typeof raw === 'string' ? raw.trim() : ''
    if (keyword === '' || seen.has(keyword)) {
      continue
    }
    seen.add(keyword)
    keywords.push(keyword)
  }
  return keywords
}

export function normalizeNewsConfig(raw: unknown): NewsConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    limit: clampInt(source.limit, NEWS_LIMIT_MIN, NEWS_LIMIT_MAX, NEWS_DEFAULT_CONFIG.limit),
    highlight: clampInt(source.highlight, NEWS_HIGHLIGHT_MIN, NEWS_HIGHLIGHT_MAX, NEWS_DEFAULT_CONFIG.highlight),
    keywords: normalizeKeywords(source.keywords),
  }
}
