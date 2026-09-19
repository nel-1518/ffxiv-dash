/**
 * 待办卡的「已完成」状态：按 (卡片 id, 刷新窗口) 归档，单独落一个 localStorage 键。
 *
 * 为什么不写进组件 config：勾选是**每天会被清掉的临时状态**，
 * 而 config 会随看板导出、也会让每次勾选都重写整份看板数据 ——
 * 与「跳转」设置（`core/auto-open/store.ts`）同一条理由，它同样不进看板数据。
 *
 * 「超过刷新时刻就复原」在这里**不是一段逻辑**：存的每条记录都记着自己属于哪个窗口
 * （`windowKey`），读的时候拿当前窗口一比，不匹配就当空的返回。
 * 于是不需要定时器、不需要 effect、也不需要任何"重置"写盘 ——
 * 与市场卡「数据连着请求标识一起存」是同一个套路（`tax-widget/fields.tsx`）。
 *
 * 卡片 id 变了（删掉重建）就等于从零开始，这是刻意的：状态跟着卡片，不跟着待办文本。
 */
import { isRecord } from '../../../../core/guards.ts'

/** 整个待办卡的状态只占这一个键。 */
const STORAGE_KEY = 'ffxiv-dash:todo:v1'

/** 过期条目的清理期限：30 天没被碰过的卡片记录直接丢掉（写入时顺手清）。 */
const ENTRY_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 条目数上限：卡片删掉后它的记录要等 TTL 才消失，这里再兜一层，免得键无限长大。 */
const MAX_ENTRIES = 100

type TodoEntry = {
  /** 这份勾选属于哪个刷新窗口（`schedule.ts` 的 `windowKeyOf`）。 */
  windowKey: string
  /** 已完成的行文本（与配置里的待办逐字对应）。 */
  done: string[]
  /** 最后改动时间，只用于清理过期条目。 */
  updatedAt: number
}

type TodoState = {
  version: number
  entries: Record<string, TodoEntry>
}

const EMPTY_STATE: TodoState = { version: 1, entries: {} }

let state: TodoState = EMPTY_STATE
let loaded = false

function normalizeEntry(raw: unknown): TodoEntry | null {
  if (!isRecord(raw)) {
    return null
  }
  const windowKey = typeof raw.windowKey === 'string' ? raw.windowKey : ''
  if (windowKey === '') {
    return null
  }
  const done = Array.isArray(raw.done) ? raw.done.filter((item): item is string => typeof item === 'string') : []
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0
  return { windowKey, done, updatedAt }
}

function normalizeState(raw: unknown): TodoState {
  if (!isRecord(raw) || !isRecord(raw.entries)) {
    return EMPTY_STATE
  }
  const entries: Record<string, TodoEntry> = {}
  for (const [itemId, value] of Object.entries(raw.entries)) {
    const entry = normalizeEntry(value)
    if (entry !== null) {
      entries[itemId] = entry
    }
  }
  return { version: 1, entries }
}

/** 惰性读盘：重复调用只读一次存储（与 `core/auto-open/store.ts` 同一形状）。 */
function load(): TodoState {
  if (loaded) {
    return state
  }
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    state = raw === null ? EMPTY_STATE : normalizeState(JSON.parse(raw))
  } catch (error) {
    // 手改坏的值 / 隐私模式：按"没有任何勾选"处理，卡片照常能勾
    console.warn('[ffxiv-dash] 无法读取待办状态，按全部未完成处理', error)
    state = EMPTY_STATE
  }
  return state
}

/**
 * 这个窗口里已完成的待办。
 *
 * ⚠️ 窗口不匹配就返回空数组 —— **这正是"过点自动复原"的落地方式**，
 * 调用方不需要在任何地方判断时间。
 */
export function readTodoDone(itemId: string, windowKey: string): string[] {
  const entry = load().entries[itemId]
  return entry !== undefined && entry.windowKey === windowKey ? [...entry.done] : []
}

function save(next: TodoState): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    // 配额满：这次勾选当场生效（组件自己的 state 已经改了），只是刷新后会丢
    console.warn('[ffxiv-dash] 无法保存待办状态', error)
  }
}

/** 写入时顺手清理：过期的条目丢掉，条目太多时只留最近写过的那些。 */
function prune(entries: Record<string, TodoEntry>, now: number): Record<string, TodoEntry> {
  const alive = Object.entries(entries).filter(([, entry]) => now - entry.updatedAt < ENTRY_TTL_MS)
  alive.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
  return Object.fromEntries(alive.slice(0, MAX_ENTRIES))
}

export function writeTodoDone(itemId: string, windowKey: string, done: string[]): void {
  const current = load()
  const now = Date.now()
  const entries = { ...current.entries, [itemId]: { windowKey, done: [...done], updatedAt: now } }
  save({ version: 1, entries: prune(entries, now) })
}
