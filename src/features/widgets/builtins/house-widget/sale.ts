/**
 * 售楼中心接口（纯逻辑，无 React）。
 *
 * 只做三件事：拼 URL、发请求（同一 URL 去重）、把响应折叠成**每区每尺寸的处数**。
 *
 * 接口：`GET https://house.ffxiv.cyou/api/sales?server={serverId}` → `list[dict]`
 * 一条 = 一处挂出来的房子，字段见 `constants.ts` 的对照表。
 *
 * 卡片不列明细，所以解析的产物直接就是计数表 —— 缓存里也只存这 15 个数字，
 * 不必把几百条明细写进 localStorage。
 */
import { findWorldByName } from '../../../../core/world.ts'
import { HOUSE_AREAS, HOUSE_SIZE_KEYS, houseSizeOf, regionTypesOf } from './constants.ts'
import type { HouseSize, HouseUse } from './constants.ts'

const API_BASE = 'https://house.ffxiv.cyou/api/sales'

/** 三个尺寸的计数。 */
export type SizeCounts = Record<HouseSize, number>

/**
 * 一个房区里按**用途**分桶的计数，键就是接口的 `RegionType`（0 / 1 / 2）。
 *
 * 分桶存而不是直接存一个总数：用途是筛选条件，分桶之后切换筛选就不用重新请求。
 */
export type UseCounts = Record<number, SizeCounts>

export type HouseData = {
  /** 服务器 id（与 `core/world.ts`、接口的 `Server` 字段一致）。 */
  server: number
  /** 服务器名。缓存里也留一份，卡面不必再从 id 反查。 */
  serverName: string
  /** 房区 id → 分桶计数。已知房区一律建零桶，所以这里总是齐的。 */
  counts: Record<number, UseCounts>
  /** 数据到手时刻，缓存有效期以它为准。 */
  fetchedAt: number
}

export function buildSalesUrl(serverId: number): string {
  return `${API_BASE}?server=${String(serverId)}`
}

function emptySizeCounts(): SizeCounts {
  return { s: 0, m: 0, l: 0 }
}

/** 三个用途桶先都建好：接口没上报的那类要显示 0，而不是整块消失。 */
function emptyUseCounts(): UseCounts {
  return { 0: emptySizeCounts(), 1: emptySizeCounts(), 2: emptySizeCounts() }
}

/**
 * 折叠成计数表。
 *
 * **完全无视 `State`**：用户要的是「这个服务器上有多少处房子在卖」，而不是抽签流程走到哪一步 ——
 * 后者由 `phase.ts` 用周期算。区间外的 `Area` / `Size` / `RegionType` 整条忽略，坏数据不当数据。
 */
export function parseSales(
  payload: unknown,
  server: number,
  serverName: string,
  fetchedAt: number,
): HouseData {
  const counts: Record<number, UseCounts> = {}
  for (const area of HOUSE_AREAS) {
    counts[area.id] = emptyUseCounts()
  }

  for (const raw of Array.isArray(payload) ? payload : []) {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const areaId = typeof row.Area === 'number' ? row.Area : Number.NaN
    const size = houseSizeOf(typeof row.Size === 'number' ? row.Size : Number.NaN)
    const regionType = typeof row.RegionType === 'number' ? row.RegionType : Number.NaN
    const areaCounts = counts[areaId]
    // 别的服务器的行也一并忽略：接口理论上只回本服，但白捡一层校验不花什么
    if (areaCounts === undefined || size === undefined || row.Server !== server) {
      continue
    }
    const bucket = areaCounts[regionType]
    if (bucket === undefined) {
      continue
    }
    bucket[size] += 1
  }

  return { server, serverName, counts, fetchedAt }
}

/** 把所选房区、所选用途的计数加起来 —— 卡面只显示这三个总数。 */
export function sumCounts(data: HouseData, areas: number[], use: HouseUse): SizeCounts {
  const total = emptySizeCounts()
  const wanted = regionTypesOf(use)

  for (const areaId of areas) {
    const buckets = data.counts[areaId]
    if (buckets === undefined) {
      continue
    }
    for (const regionType of wanted) {
      const counts = buckets[regionType]
      if (counts === undefined) {
        continue
      }
      for (const size of HOUSE_SIZE_KEYS) {
        total[size] += counts[size]
      }
    }
  }

  return total
}

/** 同一 URL 的并发请求合并成一次：StrictMode 双挂载、多张同参数卡片都只发一次。 */
const inFlight = new Map<string, Promise<HouseData>>()

export function fetchSales(serverName: string): Promise<HouseData> {
  const world = findWorldByName(serverName)
  if (!world) {
    // 归一化保证不会走到这里，留个明确的错误好过拼出一个查不到的 URL
    return Promise.reject(new Error(`未知服务器：${serverName}`))
  }

  const url = buildSalesUrl(world.id)
  const running = inFlight.get(url)
  if (running) {
    return running
  }

  const task = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const payload: unknown = await response.json()
      return parseSales(payload, world.id, world.name, Date.now())
    })
    .catch((error: unknown) => {
      /*
       * 失败细节只进控制台：卡面上只在标题行留一个「获取失败」，不占版面。
       * 记在这里而不是调用方 —— 同一 URL 的并发调用共用这一个 Promise，
       * 所以一次真实请求只会打一条（在调用方记会被 StrictMode 双挂载打成两条）。
       */
      console.error('[ffxiv-dash] 房屋售卖获取失败', { server: serverName, url, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(url)
    })

  inFlight.set(url, task)
  return task
}
