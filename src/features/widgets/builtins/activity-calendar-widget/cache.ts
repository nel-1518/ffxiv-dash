/**
 * 活动日历缓存（localStorage，纯逻辑无 React）。
 *
 * 与税率 / 物品价格 / 汇率同一套写法：这张卡**只有一份数据**（接口与参数都固定，默认本月），
 * 所以整个缓存就是一个键 —— 存 `fetchedAt` + 解析好的活动列表，写入即覆盖。
 * 网页打开时先看它：命中且未过期（8 小时内）就直接用、**不发请求**。
 */
import { ACTIVITY_CALENDAR_CACHE_TTL_MS } from './config.ts'
import type { ActivityCalendarData } from './api.ts'

/** 整个活动日历缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash-cache:activityCalendar:v1'

/** 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。 */
const CACHE_VERSION = 1

type ActivityCalendarCacheFile = {
  version: number
  data: ActivityCalendarData
}

/** 缓存里的那份数据（读出来即已验过字段）。 */
export type ActivityCalendarCache = ActivityCalendarData

/** 可为 null 的数字（时间戳）。 */
function isNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

/** 缓存来自 localStorage、可能被手改过：逐字段验过才敢当 `CalendarActivity` 用。 */
function isCalendarActivity(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const activity = value as Record<string, unknown>
  return (
    typeof activity.id === 'number' &&
    typeof activity.name === 'string' &&
    typeof activity.url === 'string' &&
    isNullableNumber(activity.beginTime) &&
    isNullableNumber(activity.endTime) &&
    typeof activity.color === 'string'
  )
}

/** 整份数据窄化：活动列表与抓取时间都合规才敢用。 */
function isActivityCalendarData(value: unknown): value is ActivityCalendarData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const data = value as Record<string, unknown>
  return (
    typeof data.fetchedAt === 'number' &&
    Array.isArray(data.activities) &&
    data.activities.every(isCalendarActivity)
  )
}

/** 读缓存。任何异常（无键 / 坏 JSON / 版本不符 / 字段不全）都退化成 null。 */
export function readActivityCalendarCache(): ActivityCalendarCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const file = parsed as Partial<ActivityCalendarCacheFile>
    if (file.version !== CACHE_VERSION || !isActivityCalendarData(file.data)) {
      return null
    }
    return file.data
  } catch {
    return null
  }
}

/** 是否还在有效期内（8 小时）。 */
export function isActivityCalendarCacheFresh(cache: ActivityCalendarCache, now: number): boolean {
  return now - cache.fetchedAt < ACTIVITY_CALENDAR_CACHE_TTL_MS
}

/** 写入一份（覆盖旧值）。 */
export function writeActivityCalendarCache(data: ActivityCalendarData): void {
  try {
    const file: ActivityCalendarCacheFile = { version: CACHE_VERSION, data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(file))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
