import { useMemo, useSyncExternalStore } from 'react'
import { getNow, subscribe } from './store.ts'

/**
 * 时钟的粗粒度派生快照：只有 `select` 的返回值真的变了才重渲染。
 *
 * 时钟每秒通知一次，但很多读数不需要每秒变 —— 问候语只认小时、`HH:mm` 只认分钟、
 * 艾欧泽亚读数约 2.9 秒才跳一格；让 `useSyncExternalStore` 比快照，相等就跳过渲染。
 *
 * ⚠️ `select` 必须返回可按值比较的结果（数字 / 字符串 / 布尔）；返回每次新建的对象
 * 会让快照永远"变了"，直接无限重渲染。
 * ⚠️ `select` 在每次快照检查时都会被调用（含时钟回调），别在里面做重活
 * （例如现造 `Intl.DateTimeFormat`，构造远比格式化贵）。
 */
export function useClockValue<T>(select: (now: Date) => T): T {
  return useSyncExternalStore(subscribe, () => select(new Date(getNow())))
}

/** 时钟粒度：读数最快多久变一次。 */
export type ClockPart = 'second' | 'minute' | 'hour' | 'day'

/**
 * 把时刻截断到粒度的起点（本地时区）。
 *
 * ⚠️ 不能拿 `Math.floor(ms / 3600000)` 之类的整除算整点：那是 UTC 整点，
 * 只有整点时区（东八区）才与本地整点重合，+5:30 / +9:30 这类时区会错开半小时。
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
 * 粒度版的「现在」：截断到该粒度起点的 Date。
 *
 * 读数与卡片要的往往不是"此刻"，而是"按某个刻度看现在是哪一格"：相对时间只认分钟、
 * 倒数日只认哪一天、PvP 轮换只认哪一分钟。整块渲染跟着这个 Date 走，
 * 就不会因为时钟每秒一跳而重渲染。
 *
 * 何时用哪个：`now` 被整块共用（status / phase / rotation）→ 用这个；
 * 只是"一行文本多久变一次"（如「N 分钟前」）→ `useClockValue(格式化函数)` 更省。
 *
 * ⚠️ Date 必须在 `useMemo` 里按那个毫秒数造：快照是每次新建的对象会被判定"一直在变"。
 */
export function useClockAt(part: ClockPart): Date {
  const ms = useClockValue(CLOCK_SELECTORS[part])
  return useMemo(() => new Date(ms), [ms])
}
