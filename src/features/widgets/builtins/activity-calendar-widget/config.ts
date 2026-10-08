/**
 * 活动日历卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * 唯一可配项：`emphasisDays` —— 剩余不超过多少天时，倒计时用强调色显示（默认 3 天）。
 * 活动名称、起止时间、专属色与专题页链接都来自接口，不可配。
 */
export const ACTIVITY_CALENDAR_API_URL = 'https://ffxiv-api.neeeel.com/api/getActiveCalendarMonth'

/** 高亮阈值（天）的取值范围：0 = 关闭高亮；上限 30 天与「本月活动」的时间跨度相当。 */
export const ACTIVITY_CALENDAR_EMPHASIS_MIN = 0
export const ACTIVITY_CALENDAR_EMPHASIS_MAX = 30

export type ActivityCalendarConfig = {
  /** 剩余不超过该天数时，倒计时读数用强调色显示；0 = 始终不高亮。 */
  emphasisDays: number
}

/** 默认剩余 3 天内高亮。 */
export const ACTIVITY_CALENDAR_DEFAULT_CONFIG: ActivityCalendarConfig = {
  emphasisDays: 3,
}

/** 取整并夹到区间内；非数字（旧数据 / 手改过的值）一律退回 `fallback`。 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export function normalizeActivityCalendarConfig(raw: unknown): ActivityCalendarConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    emphasisDays: clampInt(
      source.emphasisDays,
      ACTIVITY_CALENDAR_EMPHASIS_MIN,
      ACTIVITY_CALENDAR_EMPHASIS_MAX,
      ACTIVITY_CALENDAR_DEFAULT_CONFIG.emphasisDays,
    ),
  }
}
