/**
 * 待办卡的纯时间逻辑：刷新周期 + 刷新时刻 → 「当前所在的刷新窗口」。
 * 不导入 React、不碰 DOM，输入输出都是原始值，可脱离浏览器单独验证。
 * 核心概念只有窗口标识一个：把「最近一次已发生的刷新时刻」格式化成 `YYYY-MM-DD HH:mm` 当窗口 id，
 * 勾选状态按这个 id 归档（见 `state.ts`）。过了刷新时刻 id 即失配、读出来就是空，无需定时器与重置写盘。
 */

/** 刷新周期。「不刷新」以外的取值就是每周几，`none` / `daily` 是另外两条路。 */
export type TodoCycle = 'none' | 'daily' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

/** 周期下拉的选项；顺序即展示顺序（周一在前，与中文习惯一致）。 */
export const TODO_CYCLE_OPTIONS: { label: string; value: TodoCycle }[] = [
  { label: '不刷新', value: 'none' },
  { label: '每日', value: 'daily' },
  { label: '每周一', value: 'mon' },
  { label: '每周二', value: 'tue' },
  { label: '每周三', value: 'wed' },
  { label: '每周四', value: 'thu' },
  { label: '每周五', value: 'fri' },
  { label: '每周六', value: 'sat' },
  { label: '每周日', value: 'sun' },
]

/** 卡面小字里的周期名。 */
export const TODO_CYCLE_LABELS: Record<TodoCycle, string> = {
  none: '不自动刷新',
  daily: '每日',
  sun: '每周日',
  mon: '每周一',
  tue: '每周二',
  wed: '每周三',
  thu: '每周四',
  fri: '每周五',
  sat: '每周六',
}

/** 每周几在 `Date.getDay()` 里的下标（0 = 周日）。 */
const CYCLE_WEEKDAY: Record<Exclude<TodoCycle, 'none' | 'daily'>, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

/** 窗口标识与下拉都在比较的常量：周期为「不刷新」时窗口永不变化。 */
export const NO_WINDOW_KEY = 'none'

/** `HH:mm`（小时允许 1 位，方便手改过的数据）。 */
const HH_MM_PATTERN = /^(\d{1,2}):(\d{2})$/

export function isTodoCycle(value: unknown): value is TodoCycle {
  return typeof value === 'string' && value in TODO_CYCLE_LABELS
}

/** 解析 `HH:mm`；越界（`24:00` / `23:60`）与认不出来的写法一律返回 null。 */
export function parseHhMm(value: string): { hour: number; minute: number } | null {
  const match = HH_MM_PATTERN.exec(value.trim())
  if (!match) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    return null
  }
  return { hour, minute }
}

/** 把时分写成规范形式（`9:5` → `09:05`），存进 config 的永远是这一种。 */
export function formatHhMm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * 某一天的某个时刻（本地）。用构造函数而非 `setHours` 这类字段 setter：跨夏令时的那一天它会多加 / 少加一小时
 * （中国没有夏令时，但不该依赖这件事，`countdown.ts` 同一写法）。`dayOfMonth` 允许超出当月范围，Date 自行进位、跨月跨年不必特判。
 */
function atLocalTime(now: Date, dayOffset: number, hour: number, minute: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0)
}

/** 窗口标识：`YYYY-MM-DD HH:mm`（本地）。这是勾选状态归档、比较窗口是否变化的唯一依据。 */
export function formatWindowKey(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${day} ${formatHhMm(at.getHours(), at.getMinutes())}`
}

/**
 * 最近一次已经发生的刷新时刻；「不刷新」或时刻认不出来时返回 null。
 * 每日：今天该时刻没到就回退到昨天该时刻；每周几：先看本周的那一天（今天就是该星期几时是今天），时刻没到再往前退 7 天。
 * 用「今天减几天」而不是算周一起点，跨月跨年由 Date 进位。
 */
export function windowStartOf(cycle: TodoCycle, time: string, now: Date): Date | null {
  if (cycle === 'none') {
    return null
  }
  const parsed = parseHhMm(time)
  if (parsed === null) {
    return null
  }
  const { hour, minute } = parsed

  if (cycle === 'daily') {
    const today = atLocalTime(now, 0, hour, minute)
    return today.getTime() <= now.getTime() ? today : atLocalTime(now, -1, hour, minute)
  }

  const daysSince = (now.getDay() - CYCLE_WEEKDAY[cycle] + 7) % 7
  const candidate = atLocalTime(now, -daysSince, hour, minute)
  return candidate.getTime() <= now.getTime() ? candidate : atLocalTime(now, -daysSince - 7, hour, minute)
}

/**
 * 当前窗口的 id。
 * 组件把它当 `useClockValue` 的快照：它是字符串，只在跨过刷新时刻那一秒才变
 * （周期为「不刷新」时恒为 `'none'`，一次都不重渲染）。
 */
export function windowKeyOf(cycle: TodoCycle, time: string, now: Date): string {
  const start = windowStartOf(cycle, time, now)
  return start === null ? NO_WINDOW_KEY : formatWindowKey(start)
}

/** 卡面小字上的刷新说明，例如 `每周二 23:00 刷新` / `不自动刷新`。 */
export function formatRefreshLabel(cycle: TodoCycle, time: string): string {
  if (cycle === 'none') {
    return TODO_CYCLE_LABELS.none
  }
  const parsed = parseHhMm(time)
  if (parsed === null) {
    return TODO_CYCLE_LABELS[cycle]
  }
  return `${TODO_CYCLE_LABELS[cycle]} ${formatHhMm(parsed.hour, parsed.minute)} 刷新`
}
