/** 倒数日组件的配置类型、默认值与归一化（纯数据，无组件）。 */
import { isCountdownCycle, isValidDateKey } from './countdown.ts'
import type { CountdownCycle } from './countdown.ts'

export type CountdownConfig = {
  /** 事件名称，嵌在「距【事件】还有 XX 日」这句话里。 */
  event: string
  /** 目标日期，`YYYY-MM-DD`（本地日历日，不带时刻 —— 卡片只数到"天"）。 */
  date: string
  /** 倒数周期；除「不重复」外，倒数永远指向下一个有效日期。 */
  cycle: CountdownCycle
}

export const COUNTDOWN_DEFAULT_CONFIG: CountdownConfig = {
  event: '',
  // 刻意留空而不是填"今天"：默认值只是新建时的起点，真实日期由用户在选择器里挑
  date: '',
  cycle: 'none',
}

/** 事件名称长度上限。卡片本来就窄，再长会把主句挤成三行。 */
export const MAX_EVENT_LENGTH = 40

/** 事件名为空时的兜底，保证句子里不会出现空。 */
export const EVENT_FALLBACK = '事件'

export function normalizeCountdownConfig(raw: unknown): CountdownConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  // 只收字符串：类型不对（旧数据 / 手改）一律当没填
  const trimmed = typeof source.event === 'string' ? source.event.trim() : ''
  const event = (trimmed || EVENT_FALLBACK).slice(0, MAX_EVENT_LENGTH)

  /*
   * 非法日期直接置空，交给渲染层提示「请选择日期」，不做任何猜测性修补。
   * 注意这里只校验、不改写：日期就是用户选的那一天，组件不该替他挑一个。
   */
  const date = typeof source.date === 'string' && isValidDateKey(source.date) ? source.date : ''

  return {
    event,
    date,
    cycle: isCountdownCycle(source.cycle) ? source.cycle : COUNTDOWN_DEFAULT_CONFIG.cycle,
  }
}
