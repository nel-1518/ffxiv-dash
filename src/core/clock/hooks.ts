import { useMemo, useSyncExternalStore } from 'react'
import { getNow, subscribe } from './store.ts'

/**
 * 时钟的粗粒度派生快照：`select` 返回值真变了才重渲染。
 * 时钟每秒一跳，但问候语只认小时、`HH:mm` 只认分钟、艾欧泽亚读数约 2.9 秒才跳一格；
 * 让 useSyncExternalStore 比快照，相等就跳过渲染。
 * ⚠️ `select` 必须返回可按值比较的结果（数字 / 字符串 / 布尔）；返回每次新建的对象会无限重渲染。
 * ⚠️ `select` 在每次快照检查时都会被调用（含时钟回调），别做重活（如现造 `Intl.DateTimeFormat`，构造远比格式化贵）。
 */
export function useClockValue<T>(select: (now: Date) => T): T {
  return useSyncExternalStore(subscribe, () => select(new Date(getNow())))
}

/** 时钟粒度：读数最快多久变一次。 */
export type ClockPart = 'second' | 'minute' | 'hour' | 'day'

/**
 * 把时刻截断到粒度的起点（本地时区）。
 * ⚠️ 不能用 `Math.floor(ms / 3600000)` 等整除算整点：那是 UTC 整点，只有整点时区与本地整点重合，
 * +5:30 / +9:30 这类时区会错开半小时。
 */
function truncate(now: Date, part: ClockPart): number {
  const at = new Date(now.getTime())
  at.setMilliseconds(0)
  if (part === 'second') {
    return at.getTime()
  }
  at.setSeconds(0)
  if (part === 'minute') {
    return at.getTime()
  }
  at.setMinutes(0)
  if (part === 'hour') {
    return at.getTime()
  }
  at.setHours(0)
  return at.getTime()
}

/** 各粒度的快照选择器：同一格内返回值不变，`useSyncExternalStore` 会因此跳过渲染。 */
const CLOCK_SELECTORS: Record<ClockPart, (now: Date) => number> = {
  second: (now) => truncate(now, 'second'),
  minute: (now) => truncate(now, 'minute'),
  hour: (now) => truncate(now, 'hour'),
  day: (now) => truncate(now, 'day'),
}

/**
 * 粒度版的「现在」：截断到该粒度起点的 Date。读数要的往往是「按某刻度看现在是哪一格」
 * （相对时间只认分钟、倒数日只认哪一天、PvP 轮换只认哪一分钟），整块渲染跟着这个 Date
 * 走就不随秒跳重渲染。整块共用（status / phase / rotation）→ 用这个；
 * 只是一行文本（如「N 分钟前」）→ `useClockValue(格式化函数)` 更省。
 * ⚠️ Date 必须在 `useMemo` 里按毫秒数造：每次新建对象会被判定「一直在变」。
 */
export function useClockAt(part: ClockPart): Date {
  const ms = useClockValue(CLOCK_SELECTORS[part])
  return useMemo(() => new Date(ms), [ms])
}
