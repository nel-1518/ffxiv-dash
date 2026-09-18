/**
 * 房屋数据缓存（localStorage，纯逻辑无 React）。
 *
 * 与物品价格卡的缓存同一套写法：**整个缓存只占一个键**，内部按「服务器」分条目，
 * 写入时顺手把过期条目一起清掉，不会随时间无限堆积。
 *
 * 区别只有两点，都是因为卡片只要计数：
 * 1. 条目 key 就是服务器 id（数据是按服上报的，与房区 / 用途选择无关 —— 换筛选条件不必重新请求）；
 * 2. 存的是**计数表**而不是明细，一次写入只有几十个数字。
 *
 * 网页打开时先看它：命中且未过期就直接用、**不发请求**。
 */
import { HOUSE_CACHE_TTL_MS } from './config.ts'
import { HOUSE_SIZE_KEYS } from './constants.ts'
import type { HouseData, SizeCounts, UseCounts } from './sale.ts'

/** 整个房屋缓存只占这一个键。 */
const CACHE_KEY = 'ffxiv-dash:house:v1'

/**
 * 内部结构版本。结构一变就升它，旧数据自然被当成空缓存丢掉。
 * v1 → v2：计数从「每区一个总数」改成「每区按用途分桶」（筛选不再重新请求）。
 */
const CACHE_VERSION = 2

type HouseCacheFile = {
  version: number
  /** 服务器 id（字符串）→ 数据。 */
  entries: Record<string, HouseData>
}

function emptyFile(): HouseCacheFile {
  return { version: CACHE_VERSION, entries: {} }
}

function isSizeCounts(value: unknown): value is SizeCounts {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const counts = value as Record<string, unknown>
  return HOUSE_SIZE_KEYS.every((key) => typeof counts[key] === 'number')
}

function isUseCounts(value: unknown): value is UseCounts {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return Object.values(value).every(isSizeCounts)
}

function isHouseData(value: unknown): value is HouseData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  if (
    typeof entry.server !== 'number' ||
    typeof entry.serverName !== 'string' ||
    typeof entry.fetchedAt !== 'number' ||
    typeof entry.counts !== 'object' ||
    entry.counts === null
  ) {
    return false
  }
  return Object.values(entry.counts).every(isUseCounts)
}

/** 读整个缓存文件。任何异常（无键 / 坏 JSON / 版本不符）都退化成空缓存。 */
function readFile(): HouseCacheFile {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) {
      return emptyFile()
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return emptyFile()
    }
    const file = parsed as Partial<HouseCacheFile>
    if (file.version !== CACHE_VERSION || typeof file.entries !== 'object' || file.entries === null) {
      return emptyFile()
    }
    return { version: CACHE_VERSION, entries: file.entries }
  } catch {
    return emptyFile()
  }
}

/** 读取某个服务器的缓存。过期与否由调用方用 `isFresh` 判断 —— 过期数据仍可用于先渲染后刷新。 */
export function readHouseCache(server: number): HouseData | null {
  const entry = readFile().entries[String(server)]
  if (!isHouseData(entry) || entry.server !== server) {
    return null
  }
  return entry
}

/** 是否还在有效期内。 */
export function isFresh(data: HouseData, now: number): boolean {
  return now - data.fetchedAt < HOUSE_CACHE_TTL_MS
}

/**
 * 写入一条，并**顺手清掉所有已过期条目**。
 *
 * 清理和写入共用 `HOUSE_CACHE_TTL_MS`：缓存只有"还能用"与"该删了"两种状态，
 * 过期数据留在盘上不会有人读，只会白占地方。
 */
export function writeHouseCache(data: HouseData): void {
  const file = readFile()
  const entries: Record<string, HouseData> = {}
  const now = Date.now()

  // 未过期的旧条目原样带走，过期的一律不带
  for (const [key, entry] of Object.entries(file.entries)) {
    if (isHouseData(entry) && now - entry.fetchedAt < HOUSE_CACHE_TTL_MS) {
      entries[key] = entry
    }
  }

  entries[String(data.server)] = data

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, entries }))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}
