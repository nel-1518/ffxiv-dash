/**
 * 待办卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * config 里放的是**用户填的内容**：周期、刷新时刻、待办原文。
 * 「已完成」不进这里 —— 它每天会被清掉，属于临时状态，单独落一个 localStorage 键（见 `state.ts`），
 * 理由与「跳转」设置（`core/auto-open/store.ts`）一样：临时状态不该跟着看板导出走，
 * 也不该让每次勾选都重写整份看板数据。
 */
import { TODO_CYCLE_OPTIONS, formatHhMm, isTodoCycle, parseHhMm } from './schedule.ts'
import type { TodoCycle } from './schedule.ts'

/** 默认刷新时刻 16:00。 */
export const DEFAULT_TODO_TIME = '16:00'

/** 待办数量上限。超出的行不渲染，面板里会明说忽略了几行。 */
export const MAX_TODO_ITEMS = 20

/**
 * 待办原文的长度上限。
 *
 * 这是防呆而不是业务限制：`items` 存的是**原文**（面板里的输入框要能原样回显用户写的东西），
 * 所以它会长进 config、进而进 localStorage 与导出的看板文件。20 行正常人写的字远到不了这个数，
 * 它挡的是"整篇小说粘进来"。
 */
export const MAX_TODO_TEXT_LENGTH = 4000

export type TodoConfig = {
  /** 刷新周期：不刷新 / 每日 / 每周几。 */
  cycle: TodoCycle
  /** 刷新时刻，`HH:mm` 字符串（localStorage 只认可序列化值，转 dayjs 只做在表单两端）。 */
  time: string
  /** 待办原文，每行一项。存原文而不是解析结果，输入框才能原样回显。 */
  items: string
}

/** 默认周期是每周二。 */
export const TODO_DEFAULT_CONFIG: TodoConfig = {
  cycle: 'tue',
  time: DEFAULT_TODO_TIME,
  items: '',
}

/** 默认周期名，供表单里的缺省提示复用。 */
export const DEFAULT_TODO_CYCLE: TodoCycle =
  TODO_CYCLE_OPTIONS.find((option) => option.value === TODO_DEFAULT_CONFIG.cycle)?.value ?? 'tue'

export type ParsedTodos = {
  /** 真正会渲染的待办：去掉空行、去掉重复、只留前 `MAX_TODO_ITEMS` 项。 */
  items: string[]
  /** 因为与前面的行重复而被忽略的行数。 */
  duplicates: number
  /** 因为超过数量上限而被忽略的行数。 */
  overflow: number
}

/**
 * 解析待办原文（每行一项）。
 *
 * 同一行填两遍只留一项：勾选状态是按**行文本**归档的，留两行就会一起勾/一起取消，
 * 与其制造两行"绑在一起"的假象，不如按「跳转」设置（`parseLinks`）的老规矩去重，
 * 并在面板的小结里说明忽略了几行。
 */
export function parseTodos(text: string): ParsedTodos {
  const items: string[] = []
  let duplicates = 0
  let overflow = 0

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') {
      continue
    }
    if (items.includes(trimmed)) {
      duplicates += 1
      continue
    }
    if (items.length >= MAX_TODO_ITEMS) {
      overflow += 1
      continue
    }
    items.push(trimmed)
  }

  return { items, duplicates, overflow }
}

export function normalizeTodoConfig(raw: unknown): TodoConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  const rawTime = typeof source.time === 'string' ? source.time.trim() : ''
  const parsedTime = parseHhMm(rawTime)

  const rawItems = typeof source.items === 'string' ? source.items : ''

  return {
    cycle: isTodoCycle(source.cycle) ? source.cycle : TODO_DEFAULT_CONFIG.cycle,
    // 认不出来的时刻一律回落默认值
    time: parsedTime === null ? DEFAULT_TODO_TIME : formatHhMm(parsedTime.hour, parsedTime.minute),
    items: rawItems.length > MAX_TODO_TEXT_LENGTH ? rawItems.slice(0, MAX_TODO_TEXT_LENGTH) : rawItems,
  }
}
