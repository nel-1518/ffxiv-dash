/**
 * 倒数日的纯逻辑：日期解析、周期推进、倒数结果。
 *
 * 不导入 React、不碰 DOM，输入输出都是原始值 —— 可以脱离浏览器单独验证。
 * 所有比较都以「本地日历日」为单位（本地 0 点为基准），时钟的时分秒不参与计算：
 * 卡片只数到"天"，同一天里无论几点看都必须是同一个答案。
 */

/** 倒数周期：`none` 只倒到锚点那一天，过了就转成「已过去」；其余三种按周期往后滚。 */
export type CountdownCycle = 'none' | 'weekly' | 'monthly' | 'yearly'

/** 今天的 `YYYY-MM-DD`，由调用方以「天」粒度的时钟快照算好（`formatDateKey(useClockAt('day'))`，函数在 `core/clock/format.ts`）。 */
export type DateKey = string

/** 日历日的三个部分，month 从 1 开始（和 Date 的 0 起月份错开，故意的：写出来就是人读的样子）。 */
export type DateParts = { year: number; month: number; day: number }

/** 周期下拉的选项；顺序即展示顺序。 */
export const CYCLE_OPTIONS: { label: string; value: CountdownCycle }[] = [
  { label: '不重复', value: 'none' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
]

/** 卡片副行上的周期名。 */
export const CYCLE_LABELS: Record<CountdownCycle, string> = {
  none: '不重复',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
}

export function isCountdownCycle(value: unknown): value is CountdownCycle {
  return value === 'none' || value === 'weekly' || value === 'monthly' || value === 'yearly'
}

/** 某年某月的天数（month 从 1 开始）。用"下个月的第 0 天"求，闰年自动正确。 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 解析 `YYYY-MM-DD`。
 *
 * 只看正则不够：`2026-02-31` 长得完全合法，而 `new Date(2026, 1, 31)` 会把它
 * 悄悄滚成 3 月 3 日。这里额外核对"这一天在该月真实存在"，非法即返回 null ——
 * 于是数据层里只可能出现真实存在的日历日，渲染层不用再兜底。
 */
export function parseDateKey(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }
  return { year, month, day }
}

export function isValidDateKey(value: string): boolean {
  return parseDateKey(value) !== null
}

/** 本地 0 点的 Date。日历日的比较都建立在它上面，免得"现在几点"影响结果。 */
function atMidnight(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

/**
 * 两个本地 0 点日期相差的整天数（`to - from`）。
 *
 * 用 round 而不是 floor：夏令时切换那天只有 23 小时，floor 会把"隔一天"算成 0 天。
 * 中国没有夏令时，但这里不应该依赖这件事。
 */
function diffInDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** 卡片副行上的日期文案。 */
export function formatDateText(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 锚点偏移 k 个自然月。
 *
 * 锚点日超出目标月的天数时夹到月末（1/31 的"下个月"是 2/28 或 2/29）。
 * ⚠️ 每一步都必须"锚点 + k"重新算，绝不能拿上一个候选再 +1 个月：
 * 夹取会沿着链条传染（31 → 28 → 28 → …），一旦踩到短月，之后每个月都停在 28 号。
 */
function addMonthsClamped(anchor: DateParts, k: number): Date {
  const total = anchor.year * 12 + (anchor.month - 1) + k
  const year = Math.floor(total / 12)
  const month = (((total % 12) + 12) % 12) + 1
  return atMidnight(year, month, Math.min(anchor.day, daysInMonth(year, month)))
}

/**
 * 第 k 次出现（k = 0 就是锚点当天）。
 *
 * 每周用"日 + 7k"交给 Date 自己进位，跨月跨年不用管，也不会因为夏令时少一小时；
 * 每 / 每年走 `addMonthsClamped`，因为它要处理"锚点日在这个月不存在"。
 */
function occurrenceAt(anchor: DateParts, cycle: Exclude<CountdownCycle, 'none'>, k: number): Date {
  if (cycle === 'weekly') {
    return atMidnight(anchor.year, anchor.month, anchor.day + k * 7)
  }
  if (cycle === 'monthly') {
    return addMonthsClamped(anchor, k)
  }
  return addMonthsClamped(anchor, k * 12)
}

/** 估算"今天"落在第几次出现上，只用来给搜索定起点与上界。 */
function estimateSteps(anchor: DateParts, cycle: Exclude<CountdownCycle, 'none'>, today: Date): number {
  if (cycle === 'weekly') {
    return Math.ceil(diffInDays(atMidnight(anchor.year, anchor.month, anchor.day), today) / 7)
  }
  const months = (today.getFullYear() - anchor.year) * 12 + (today.getMonth() + 1 - anchor.month)
  return cycle === 'monthly' ? months : Math.floor(months / 12)
}

/**
 * 从锚点出发，找到第一个不早于今天的候选。
 *
 * 先按周 / 月 / 年差估出"今天大约落在第几次"，再从 `估算 - 1` 起向前试：
 * 夹到月末、以及"锚点日 vs 今天日"的大小关系都会让估算最多偏一期，
 * 所以留一格余量就够，实际循环只跑 1~2 次。
 *
 * ⚠️ 上界必须跟着估算走（`k <= 估算 + 2`），不能用固定的期数上限：
 * 锚点可以是几十年前，固定上限会把 k 卡在很早的那一期上，
 * 于是函数返回一个**过去的**日期，卡片就只能显示"已过去"。
 * 用估算值当上界则既不会死循环，也不会在大跨度下退化。
 */
function nextOccurrence(anchor: DateParts, cycle: Exclude<CountdownCycle, 'none'>, today: Date): Date {
  const estimate = estimateSteps(anchor, cycle, today)
  const limit = estimate + 2
  let k = Math.max(0, estimate - 1)
  let candidate = occurrenceAt(anchor, cycle, k)
  while (candidate.getTime() < today.getTime() && k < limit) {
    k += 1
    candidate = occurrenceAt(anchor, cycle, k)
  }
  return candidate
}

export type CountdownState = 'future' | 'today' | 'past'

export type CountdownResult = {
  /** 倒数指向的那一天：不重复就是锚点，周期模式是"下一个"。 */
  target: Date
  /** 距目标的天数：未来为正、今天为 0、已过为负。 */
  days: number
  state: CountdownState
}

/**
 * 算出卡片要显示的内容。日期不合法（没填、或被手改坏）时返回 null，由渲染层给提示。
 *
 * 收 `todayKey`（`YYYY-MM-DD`）而不是 `now`：卡片的内容只跟"今天是哪天"有关。
 * 调用方用「天」粒度的快照把它算好（见 `fields.tsx`），于是跨天才重渲染一次；
 * 直接传 Date 的话秒级时钟会让卡片每一秒都跟着走。
 */
export function resolveCountdown(config: { date: string; cycle: CountdownCycle }, todayKey: DateKey): CountdownResult | null {
  const anchor = parseDateKey(config.date)
  const today = parseDateKey(todayKey)
  if (!anchor || !today) {
    return null
  }

  const todayDate = atMidnight(today.year, today.month, today.day)

  if (config.cycle === 'none') {
    const target = atMidnight(anchor.year, anchor.month, anchor.day)
    const days = diffInDays(todayDate, target)
    return days === 0 ? { target, days, state: 'today' } : { target, days, state: days > 0 ? 'future' : 'past' }
  }

  const target = nextOccurrence(anchor, config.cycle, todayDate)
  const days = diffInDays(todayDate, target)
  // 锚点当天算第一次出现，所以周期模式下 days 最小是 0，永远不会出现"已过去"
  return { target, days, state: days === 0 ? 'today' : 'future' }
}
