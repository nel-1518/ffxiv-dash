/**
 * 「跳转」设置：每天首次进入页面时自动打开的一批链接（纯逻辑 + 一个 localStorage 键，无 React）。
 *
 * 它既不进看板数据、也不进外观偏好，因此独立落一个键 ——
 * 看板导出（`serializeBoardDoc`）天然不会带上它。
 *
 * 以**本地 0 点**为界（日历日，用 `core/clock/format.ts` 的 `formatDateKey`）：
 * 一天只跳一次，同一天里刷新、重开标签页都不再跳。判断只在页面启动时做一次，
 * 停留期间不挂任何定时器 —— 这就是"不需要实时"的落地方式。
 */
import { formatDateKey } from '../clock/format.ts'
import { isRecord } from '../guards.ts'

/** 整个「跳转」设置只占这一个键。 */
const STORAGE_KEY = 'ffxiv-dash:auto-open:v1'

export type AutoOpenState = {
  /**
   * 用户填的原文（每行一个链接）。
   * 存原文而不是解析结果：设置里那个输入框要能原样回显用户写的东西。
   */
  links: string
  /** 上次自动跳转发生在哪个日历日（`YYYY-MM-DD`）；空串 = 从没跳过。 */
  lastOpenedOn: string
}

const EMPTY_STATE: AutoOpenState = { links: '', lastOpenedOn: '' }

/** 有协议头（`https://…`）就原样用，否则按 `https://` 补 —— 用户多半是直接粘域名的。 */
const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

/** 合法的日历日。手改坏的值一律当成"没跳过"：最多今天多跳一次，比永远不跳强。 */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

let state: AutoOpenState = EMPTY_STATE
let loaded = false
const listeners = new Set<() => void>()

function normalize(raw: unknown): AutoOpenState {
  if (!isRecord(raw)) {
    return EMPTY_STATE
  }
  const lastOpenedOn = typeof raw.lastOpenedOn === 'string' ? raw.lastOpenedOn.trim() : ''
  return {
    links: typeof raw.links === 'string' ? raw.links : '',
    lastOpenedOn: DATE_KEY_PATTERN.test(lastOpenedOn) ? lastOpenedOn : '',
  }
}

/** 惰性读盘：重复调用只读一次存储（与 `core/appearance/store.ts` 同一形状）。 */
function load(): AutoOpenState {
  if (loaded) {
    return state
  }
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    state = normalize(raw === null ? null : JSON.parse(raw))
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取跳转设置，按"未设置"处理', error)
    state = EMPTY_STATE
  }
  return state
}

/**
 * 一条链接的规范化：没写协议头就补 `https://`，且**只认 `http(s):`**。
 *
 * `javascript:` / `data:` 这类协议不该出现在"自动打开"里，一律当作认不出来。
 */
function normalizeLink(line: string): string | null {
  const candidate = HAS_SCHEME_PATTERN.test(line) ? line : `https://${line}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * 解析输入框里的文本（每行一个链接）。
 *
 * - 空行忽略；
 * - 同一地址填两行也只留一条（浏览器不会替我们去重，会开出两个一样的标签页）；
 * - `invalid` 是"认不出来"的行原文，只为让设置面板把"N 行已忽略"说清楚，
 *   它不影响其它行生效。
 */
export function parseLinks(text: string): { links: string[]; invalid: string[] } {
  const links: string[] = []
  const invalid: string[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') {
      continue
    }
    const url = normalizeLink(trimmed)
    if (url === null) {
      invalid.push(trimmed)
      continue
    }
    if (!links.includes(url)) {
      links.push(url)
    }
  }

  return { links, invalid }
}

export function getAutoOpenLinks(): string {
  return load().links
}

export function subscribeAutoOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function save(next: AutoOpenState): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    // 隐私模式 / 配额满：这次改动作废，但不当场打断输入
    console.warn('[ffxiv-dash] 无法保存跳转设置', error)
  }
  for (const listener of listeners) {
    listener()
  }
}

/**
 * 更新链接文本。设置面板每次按键都会调它 ——
 * 半截的输入只是"暂时认不出来"，没有需要额外维护的中间态。
 */
export function setAutoOpenLinks(links: string): void {
  const current = load()
  if (current.links === links) {
    return
  }
  save({ ...current, links })
}

/**
 * 今天该自动打开的链接；今天已经跳过、或压根没填链接时返回空数组。
 *
 * ⚠️ **查到就立刻记账**（在同一个同步调用里完成）：本函数在 dev 的 StrictMode 下会被调两次，
 * 查询与记账拆成两步就会开出两轮标签页。
 * 代价是"被浏览器拦下"时当天不再自动重试 —— 这条由调用方的提示与「全部打开」按钮兜住，
 * 总比每次刷新都多开一堆重复标签页好。
 */
export function takeTodayLinks(now: Date): string[] {
  const current = load()
  const today = formatDateKey(now)

  if (current.lastOpenedOn === today) {
    return []
  }

  const { links } = parseLinks(current.links)
  if (links.length === 0) {
    // 没填就不记账：今天晚些时候填好再刷新，应当立刻跳一次
    return []
  }

  save({ ...current, lastOpenedOn: today })
  return links
}
