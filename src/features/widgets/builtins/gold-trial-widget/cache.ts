/**
 * 黄金的试炼缓存（localStorage，纯逻辑无 React）。
 *
 * 与税率 / 物品价格 / 汇率同一套写法：这张卡**只有一份数据**（接口与参数都固定），
 * 所以整个缓存就是一个键 —— 存 `fetchedAt` + 解析好的数据，写入即覆盖。
 * 网页打开时先看它：命中且未过期（8 小时内）就直接用、**不发请求**。
 */
import { GOLD_TRIAL_CACHE_TTL_MS } from './config.ts'
import type { GoldTrialData } from './api.ts'

/** 整个试炼缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash-cache:goldTrial:v1'

/** 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。 */
const CACHE_VERSION = 1

type GoldTrialCacheFile = {
  version: number
  data: GoldTrialData
}

/** 缓存里的那份数据（读出来即已验过字段）。 */
export type GoldTrialCache = GoldTrialData

/** 可为 null 的数字（时间戳）。 */
function isNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

/** 缓存来自 localStorage、可能被手改过：逐字段验过才敢当 `GoldTrialActivity` 用。 */
function isActivityLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const activity = value as Record<string, unknown>
  return (
    typeof activity.name === 'string' &&
    isNullableNumber(activity.onlineAt) &&
    isNullableNumber(activity.challengeFrom) &&
    isNullableNumber(activity.challengeTo) &&
    isNullableNumber(activity.registerTo) &&
    isNullableNumber(activity.settleTo)
  )
}

/** 副本 `{ name, level }`。 */
function isTerritoryLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const territory = value as Record<string, unknown>
  return typeof territory.name === 'string' && typeof territory.level === 'string'
}

/** 整份数据窄化：任一字段不合规都当没缓存。 */
function isGoldTrialData(value: unknown): value is GoldTrialData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const data = value as Record<string, unknown>
  return (
    (data.current === null || isActivityLike(data.current)) &&
    (data.next === null || isActivityLike(data.next)) &&
    (data.territory === null || isTerritoryLike(data.territory)) &&
    typeof data.rewardName === 'string' &&
    typeof data.fetchedAt === 'number'
  )
}

/** 读缓存。任何异常（无键 / 坏 JSON / 版本不符 / 字段不全）都退化成 null。 */
export function readGoldTrialCache(): GoldTrialCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const file = parsed as Partial<GoldTrialCacheFile>
    if (file.version !== CACHE_VERSION || !isGoldTrialData(file.data)) {
      return null
    }
    return file.data
  } catch {
    return null
  }
}

/** 是否还在有效期内（8 小时）。 */
export function isGoldTrialCacheFresh(cache: GoldTrialCache, now: number): boolean {
  return now - cache.fetchedAt < GOLD_TRIAL_CACHE_TTL_MS
}

/** 写入一份（覆盖旧值）。 */
export function writeGoldTrialCache(data: GoldTrialData): void {
  try {
    const file: GoldTrialCacheFile = { version: CACHE_VERSION, data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(file))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
