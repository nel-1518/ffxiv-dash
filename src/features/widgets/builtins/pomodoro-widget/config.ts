/**
 * 休息提醒卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * config 里只放**用户设置**：两个时长、是否自动接续、两条提醒语。
 * 计时状态既不跟着看板导出走，也不该让每秒的读数写进落盘数据，刷新页面就回到「准备专注」。
 */

export type RestConfig = {
  /** 专注时段，分钟。 */
  focusMinutes: number
  /** 休息时段，分钟。 */
  breakMinutes: number
  /** 勾上：专注结束自动进入休息、休息结束自动进入专注。 */
  autoNext: boolean
  /** 专注时段结束时那句提醒（通知正文）。 */
  focusDoneText: string
  /** 休息时段结束时那句提醒（通知正文）。 */
  breakDoneText: string
}

/** 两个时长的取值范围（与编辑弹窗里的 Slider 共用一份，免得两头写不一致）。 */
export const FOCUS_MINUTES = { min: 10, max: 120, step: 5, default: 30 } as const
export const BREAK_MINUTES = { min: 1, max: 20, step: 1, default: 5 } as const

/** 提醒语长度上限。它是通知正文，一行读得完就够了。 */
export const MAX_NOTICE_LENGTH = 80

export const REST_DEFAULT_CONFIG: RestConfig = {
  focusMinutes: FOCUS_MINUTES.default,
  breakMinutes: BREAK_MINUTES.default,
  autoNext: true,
  focusDoneText: '专注结束，活动一下身体，休息休息眼睛。',
  breakDoneText: '休息结束，继续冒险！',
}

function clampMinutes(value: unknown, range: { min: number; max: number; default: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return range.default
  }
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

/**
 * 提醒语：认不出来的值回落默认文案，能认出来的**原样保留**（含空串）。
 *
 * 空串是合法值（= 通知只显示标题）—— 不能像"认不出来"那样补回默认值，
 * 否则用户清空之后它又会自己冒出来（与主题档案里"空 url 是合法值"同一个道理）。
 */
function normalizeNotice(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') {
    return fallback
  }
  return raw.length > MAX_NOTICE_LENGTH ? raw.slice(0, MAX_NOTICE_LENGTH) : raw
}

export function normalizeRestConfig(raw: unknown): RestConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  return {
    focusMinutes: clampMinutes(source.focusMinutes, FOCUS_MINUTES),
    breakMinutes: clampMinutes(source.breakMinutes, BREAK_MINUTES),
    autoNext: source.autoNext !== false,
    focusDoneText: normalizeNotice(source.focusDoneText, REST_DEFAULT_CONFIG.focusDoneText),
    breakDoneText: normalizeNotice(source.breakDoneText, REST_DEFAULT_CONFIG.breakDoneText),
  }
}

/**
 * 两份配置在**值**上是否相同。
 *
 * ⚠️ 必须逐字段比，不能比引用：`normalizeConfig` 每次都返回新对象，编辑弹窗点「确定」时
 * 即使一个字段都没改也会换掉 config 的引用 —— 拿引用当"用户改了设置"的信号，会把正在跑的
 * 计时平白重置。新增字段时记得同步加到这里。
 */
export function isSameRestConfig(a: RestConfig, b: RestConfig): boolean {
  return (
    a.focusMinutes === b.focusMinutes &&
    a.breakMinutes === b.breakMinutes &&
    a.autoNext === b.autoNext &&
    a.focusDoneText === b.focusDoneText &&
    a.breakDoneText === b.breakDoneText
  )
}
