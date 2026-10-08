/**
 * 活动日历接口与读数计算（纯逻辑，无 React；可以脱离浏览器单独验证）。
 *
 * 接口：`GET https://ffxiv-api.neeeel.com/api/getActiveCalendarMonth` →
 * HTTP 200，`Content-Type: application/json`，**原文透传**上游石之家日历：
 *
 * ⚠️ `begin_time` / `end_time` 是 **Unix 秒**，这里统一 × 1000 归一到毫秒，
 * 卡面与时钟（`Date.now()`）才能直接比较。
 */
import { ACTIVITY_CALENDAR_API_URL } from './config.ts'

/** 卡面要用的活动字段（时间已归一到 ms；取不到的时间为 null）。 */
export type CalendarActivity = {
  /** 上游活动 id，仅用于 React key（取不到为 0）。 */
  id: number
  name: string
  /** 活动专题页链接；缺失为空串（该行退化成不可点的普通行）。 */
  url: string
  beginTime: number | null
  endTime: number | null
  /** 活动专属色（如 `#B184B2`，用于名称下划线）；缺失 / 非法为空串（不画下划线）。 */
  color: string
}

export type ActivityCalendarData = {
  /** 基础顺序：按开始时间升序（时间缺失的排最后）；卡面渲染时会再按剩余时间重排（见 sortByRemaining）。 */
  activities: CalendarActivity[]
  /** 数据到手时刻（ms），只用于排查，不参与渲染。 */
  fetchedAt: number
}

/** 活动相对当下时钟的状态。 */
export type ActivityState = 'upcoming' | 'ongoing' | 'ended'

/** 取不到的读数统一用破折号：卡高稳定，也不会把"没有"显示成 0。 */
const BLANK = '—'

/** 对象窄化：非对象一律当空对象，后面的取值就永远安全。 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** 字符串窄化并去空白；非字符串当空串。 */
function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 数字窄化；非有限数取 fallback。 */
function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Unix 秒 → 毫秒；非正数 / 非数字一律 null。
 * 上游没有活动时 `begin_time` 会是 0，当作"没有这个时间"而不是 1970 年。
 */
function secondsToMs(value: unknown): number | null {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null
  }
  return seconds * 1000
}

/** 只认 `#RGB` / `#RRGGBB`（上游给的是形如 `#B184B2` 的活动主题色），其余当没有颜色。 */
function asHexColor(value: unknown): string {
  const color = typeof value === 'string' ? value.trim() : ''
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : ''
}

/** 窄化单条活动；没有名字的条目直接丢弃（列表里只会多一行空行）。 */
function parseActivity(value: unknown): CalendarActivity | null {
  const source = asRecord(value)
  const name = asString(source.name)
  if (name === '') {
    return null
  }
  return {
    id: asNumber(source.id, 0),
    name,
    url: asString(source.url),
    beginTime: secondsToMs(source.begin_time),
    endTime: secondsToMs(source.end_time),
    color: asHexColor(source.color),
  }
}

/**
 * 把接口原文窄化成卡面要用的数据（接口改版 / 字段缺失都不会抛错，只会少几行）。
 * `data` 不是数组时按空列表处理。
 */
export function parseCalendarPayload(payload: unknown, fetchedAt: number): ActivityCalendarData {
  const source = asRecord(payload)
  const rows = Array.isArray(source.data) ? source.data : []
  const activities = rows
    .map(parseActivity)
    .filter((activity): activity is CalendarActivity => activity !== null)
    .sort((a, b) => (a.beginTime ?? Number.POSITIVE_INFINITY) - (b.beginTime ?? Number.POSITIVE_INFINITY))
  return { activities, fetchedAt }
}

/**
 * 按本地时钟判定活动状态。
 *
 * 顺序：先看还没开始（`now < begin`），再看是否已结束（`now > end`），其余都算进行中。
 * `begin === end`（单日活动）也随之自然覆盖，无需特判。
 */
export function resolveActivityState(activity: CalendarActivity, now: number): ActivityState {
  const { beginTime, endTime } = activity
  if (beginTime !== null && now < beginTime) {
    return 'upcoming'
  }
  if (endTime !== null && now > endTime) {
    return 'ended'
  }
  return 'ongoing'
}

/** 一天的毫秒数：剩余时间跨过这条线才按「天」显示。 */
export const DAY_MS = 86_400_000

/**
 * 剩余时长：
 * - 剩余 ≥ 1 天：**只显示天数**（向下取整），如 `6天`；
 * - 剩余 < 1 天：显示时分，如 `5时20分` / `45分`（最小单位到分，卡面按分钟粒度刷新）。
 *
 * 已过期的时刻夹到 `0分`，不会出现负数读数。
 */
export function formatCountdown(until: number, now: number): string {
  const remaining = Math.max(0, until - now)
  if (remaining >= DAY_MS) {
    return `${String(Math.floor(remaining / DAY_MS))}天`
  }
  const totalMinutes = Math.floor(remaining / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${String(hours)}时${String(minutes)}分` : `${String(minutes)}分`
}

/** `9/25 13:00`：卡面所有时刻都用它，不显示年份。 */
export function formatDayTime(at: number): string {
  const date = new Date(at)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${String(date.getMonth() + 1)}/${String(date.getDate())} ${hour}:${minute}`
}

/** 行右侧读数：未开始「X天后开始」/ 进行中「剩余 X天」/ 已结束「已结束」（<1 天时读数为时分）。 */
export function activityCountdownText(activity: CalendarActivity, now: number): string {
  const state = resolveActivityState(activity, now)
  if (state === 'ended') {
    return '已结束'
  }
  if (state === 'upcoming') {
    return activity.beginTime === null ? '即将开始' : `${formatCountdown(activity.beginTime, now)}后开始`
  }
  return activity.endTime === null ? '进行中' : `剩余${formatCountdown(activity.endTime, now)}`
}

/** 未结束活动的剩余时间（ms）：未开始 = 距开始，进行中 = 距结束；已结束 / 时间未知 = null。 */
function remainingMs(activity: CalendarActivity, now: number): number | null {
  const state = resolveActivityState(activity, now)
  if (state === 'ended') {
    return null
  }
  const target = state === 'upcoming' ? activity.beginTime : activity.endTime
  return target === null ? null : Math.max(0, target - now)
}

/**
 * 按**剩余时间升序**排列（最紧急的在前）；已结束与时间未知的排最后（彼此按开始时间）。
 * 剩余时间随时钟变化，所以这一步放在渲染期用当前 `now` 现算，而不是取数时排一次。
 */
export function sortByRemaining(activities: CalendarActivity[], now: number): CalendarActivity[] {
  return [...activities].sort((a, b) => {
    const left = remainingMs(a, now)
    const right = remainingMs(b, now)
    if (left === null && right === null) {
      return (a.beginTime ?? Number.POSITIVE_INFINITY) - (b.beginTime ?? Number.POSITIVE_INFINITY)
    }
    if (left === null) return 1
    if (right === null) return -1
    return left - right
  })
}

/**
 * 是否该用强调色：**只按结束时间算**（不看开始时间）——距结束不超过 `emphasisDays` 天即高亮。
 * 已结束（`now > endTime`）与没有结束时间的不高亮；`emphasisDays <= 0` 视为关闭高亮。
 */
export function isActivityEmphasized(
  activity: CalendarActivity,
  now: number,
  emphasisDays: number,
): boolean {
  const { endTime } = activity
  if (endTime === null || now > endTime) {
    return false
  }
  return endTime - now <= emphasisDays * DAY_MS
}

/** 生效区间：`10/15 00:00 ~ 11/3 23:59`；只有一个端点时只显示那一个。 */
export function activityRangeText(activity: CalendarActivity): string {
  const { beginTime, endTime } = activity
  if (beginTime !== null && endTime !== null) {
    return `${formatDayTime(beginTime)} ~ ${formatDayTime(endTime)}`
  }
  if (beginTime !== null) {
    return `${formatDayTime(beginTime)} 起`
  }
  if (endTime !== null) {
    return `截止 ${formatDayTime(endTime)}`
  }
  return BLANK
}

/** 同一 URL 的并发请求合并成一次：StrictMode 双挂载、同页多张同卡都只发一次。 */
const inFlight = new Map<string, Promise<ActivityCalendarData>>()

export function fetchActivityCalendar(): Promise<ActivityCalendarData> {
  const running = inFlight.get(ACTIVITY_CALENDAR_API_URL)
  if (running) {
    return running
  }

  const task = fetch(ACTIVITY_CALENDAR_API_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`)
      }
      const payload: unknown = await response.json()
      const fetchedAt = Date.now()
      const data = parseCalendarPayload(payload, fetchedAt)
      // 代理透传上游原文，正常一定带 code=10000；这里只兜住"字段被改坏"的情况
      if (asRecord(payload).code !== 10000 && data.activities.length === 0) {
        throw new Error('响应缺少活动数据')
      }
      return data
    })
    .catch((error: unknown) => {
      // 失败细节只进控制台：卡面只在标题行留一句「获取失败」
      console.error('[ffxiv-dash] 活动日历获取失败', { url: ACTIVITY_CALENDAR_API_URL, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(ACTIVITY_CALENDAR_API_URL)
    })

  inFlight.set(ACTIVITY_CALENDAR_API_URL, task)
  return task
}
