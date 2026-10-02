/**
 * 公告活动接口（纯逻辑，无 React；可以脱离浏览器单独验证）。
 *
 * ⚠️ **必须走 JSONP**：响应带 `Access-Control-Allow-Credentials` 等一串 CORS 头，
 * 却**没有 `Access-Control-Allow-Origin`** —— 浏览器里的 fetch / XHR 会被直接拦掉（实测），
 * 官网自己也是 `this.$http.jsonp(...)` 调的。代价是只能 GET，而这个接口本来就只有一个 GET。
 *
 * 请求：`<NEWS_API_BASE_URL>?<NEWS_QUERY>&callback=<唯一回调名>`
 * 响应：`<唯一回调名>({"Code":0,"Data":[{...}]})`
 *
 * 数据形状（字段名沿用上游风格，只取卡面要用的部分）：
 * - `Id` / `Title`：条目标识与标题
 * - `Summary`：一句话摘要（悬停提示的第二行）；不少条目直接复读标题，见 `parseNewsItem`
 * - `SortIndex`：官网给"重点条目"的权重，普通流水为 0
 * - `Articletype`：3 = 站内文章（详情页），4 = 外链（`OutLink` 里给地址，如石之家活动）
 */
import { NEWS_DETAIL_BASE_URL, newsListUrl } from './config.ts'

/**
 * 一条公告：**与用户配置无关的静态数据**，因此可以整份缓存。
 *
 * ⚠️ 「要不要高亮」不在这里 —— 那取决于用户配的关键字，
 * 存进缓存会让改关键字后必须等下一次请求才生效。命中判定见 `highlightNews`。
 */
export type NewsItem = {
  id: number
  title: string
  /**
   * 摘要：悬停提示里标题下面那一行。
   * **与标题相同（或接口没给）时是空串** —— 判定放在解析时做一次，
   * 渲染层与缓存里都不必再存一份跟标题一样的文本。
   */
  summary: string
  /** 打开目标的地址；外链缺失时兜回官网详情页。 */
  url: string
  /** 站外链接（如石之家社区活动）：卡面据此补一句来源提示。 */
  external: boolean
}

/** 渲染用的一行：在静态条目上标出"最终要不要高亮"（= 命中 + 落在高亮上限内）。 */
export type NewsRow = NewsItem & {
  /** 置顶并使用强调色显示。 */
  pinned: boolean
}

/** 对象窄化：非对象一律当空对象，后面的取值就永远安全。 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** 数字窄化：字符串数字也认（接口历史上两种都给过），认不出返回 null。 */
function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** 字符串窄化并去空白；非字符串当空串。 */
function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 命中判定：标题含用户配的任一关键字（字面包含 —— 关键字都是中文词，没有大小写问题）。
 *
 * 只看标题，不看官网的 `SortIndex`：哪些条目算重点由用户说了算。
 */
export function isKeywordHit(title: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keyword !== '' && title.includes(keyword))
}

/** 一条 payload → `NewsItem`；缺 id 或缺标题的残缺条目直接丢掉（返回 null）。 */
function parseNewsItem(value: unknown): NewsItem | null {
  const source = asRecord(value)
  const id = asNumber(source.Id)
  const title = asString(source.Title)
  if (id === null || title === '') {
    return null
  }

  // Articletype 4 是外链：优先用 OutLink，拿不到就退回官网详情页（宁可跳错也不要死链）
  const external = asNumber(source.Articletype) === 4
  const outLink = asString(source.OutLink)
  const url = external && outLink !== '' ? outLink : `${NEWS_DETAIL_BASE_URL}${String(id)}`

  /*
   * 摘要与标题**逐字相同**（trim 后）时不保留：接口里大量条目就是把标题复读一遍，
   * 悬停提示再重复一遍毫无信息量。判定放在这里做一次，渲染层只管"空串就不显示"。
   */
  const rawSummary = asString(source.Summary)
  const summary = rawSummary === title ? '' : rawSummary

  return {
    id,
    title,
    summary,
    url,
    external: external && outLink !== '',
  }
}

/** 响应原文 → 条目数组；`Code` 非 0 或 `Data` 不是数组一律当成失败（抛一句话给卡面显示）。 */
export function parseNewsPayload(payload: unknown): NewsItem[] {
  const source = asRecord(payload)
  const code = asNumber(source.Code)
  if (code !== 0) {
    throw new Error(`接口返回 Code=${String(source.Code ?? '未知')}`)
  }
  if (!Array.isArray(source.Data)) {
    throw new Error('响应缺少新闻列表')
  }
  return source.Data.map(parseNewsItem).filter((item): item is NewsItem => item !== null)
}

/**
 * 置顶高亮：**从上到下**扫一遍公告，每条都过一次全部关键字；
 * 命中且高亮还没满额，就把它拎进高亮组（彼此保持接口返回的相对顺序），
 * 其余条目原样跟在后面 —— 一次遍历做稳定分区，不用 `Array.sort`
 * （需求是"未命中 / 超额的那些条目完全保持接口顺序"）。
 *
 * 三点讲究：
 * ① `highlightLimit` 是**上限而不是开关**：命中 4 条而上限 2 时，只有前 2 条置顶，
 *    第 3 / 4 条按原位置混在普通条文里（标记为不高亮），而不是把命中全取消；
 * ② 上限 0（或关键字为空）= 一条都不置顶，顺序与标记原样；
 * ③ 命中只看标题，不看官网的 `SortIndex` —— 哪些算重点由用户的关键字说了算。
 *
 * ⚠️ `keywords` 在这里才吃进来（而不是解析 / 缓存时）：返回类型是独立的 `NewsRow`，
 * `pinned` 的语义就是"这一行最终要高亮"。
 */
export function highlightNews(items: NewsItem[], highlightLimit: number, keywords: string[]): NewsRow[] {
  const limit = Number.isFinite(highlightLimit) ? Math.max(0, Math.floor(highlightLimit)) : 0
  const highlighted: NewsRow[] = []
  const rest: NewsRow[] = []

  for (const item of items) {
    const hit = isKeywordHit(item.title, keywords)
    if (hit && highlighted.length < limit) {
      highlighted.push({ ...item, pinned: true })
      continue
    }
    rest.push({ ...item, pinned: false })
  }

  return highlighted.length === 0 ? rest : [...highlighted, ...rest]
}

/** 回调名自增计数器：每次请求一个新名字，StrictMode 双挂载 / 多实例并发不会互相踩名。 */
let callbackSeq = 0

/** 超时上限：脚本加载不出来（被拦截 / 网络挂住）时把 Promise 结束掉，卡面不会一直停在"正在获取"。 */
const JSONP_TIMEOUT_MS = 10_000

/** 允许动态挂回调名的 window 视图（用完即删）。 */
type JsonpWindow = Window & Record<string, unknown>

/**
 * 发一次 JSONP 请求（要几条由 `limit` 决定，即请求的 `pageSize`）。
 *
 * 收尾（摘 script、删全局回调、清计时器）统一走 `cleanup`：
 * 成功 / 接口报错 / 脚本加载失败 / 超时四条路径都会经过，不留残留。
 */
function requestNewsJsonp(limit: number): Promise<NewsItem[]> {
  return new Promise((resolve, reject) => {
    const callbackName = `__ffxivDashNews${String(++callbackSeq)}`
    const globalWindow = window as unknown as JsonpWindow
    const script = document.createElement('script')
    let timer: number | undefined

    const cleanup = (): void => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        timer = undefined
      }
      script.remove()
      delete globalWindow[callbackName]
    }

    globalWindow[callbackName] = (payload: unknown) => {
      cleanup()
      try {
        resolve(parseNewsPayload(payload))
      } catch (error: unknown) {
        reject(error)
      }
    }

    timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('请求超时'))
    }, JSONP_TIMEOUT_MS)

    script.async = true
    script.onerror = () => {
      cleanup()
      reject(new Error('脚本加载失败'))
    }
    script.src = `${newsListUrl(limit)}&callback=${callbackName}`
    document.head.appendChild(script)
  })
}

/**
 * 同一 URL（= 同一个条数）的并发请求合并成一次：StrictMode 双挂载、同页多张同卡都只发一次。
 * 按 URL 分键而不是单个变量 —— 条数不同的两次请求是两份数据，不能互相顶替。
 */
const inFlight = new Map<string, Promise<NewsItem[]>>()

/** 取 `limit` 条公告；`limit` 直接进请求的 `pageSize`。 */
export function fetchNews(limit: number): Promise<NewsItem[]> {
  const url = newsListUrl(limit)
  const running = inFlight.get(url)
  if (running !== undefined) {
    return running
  }

  const task = requestNewsJsonp(limit)
    .catch((error: unknown) => {
      /*
       * 失败细节只进控制台：卡面只在状态行留一个「获取失败」，原因悬停可看。
       * 记在这里而不是调用方 —— 并发调用共用这一个 Promise，一次真实请求只打一条。
       */
      console.error('[ffxiv-dash] 公告活动获取失败', { url, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(url)
    })

  inFlight.set(url, task)
  return task
}
