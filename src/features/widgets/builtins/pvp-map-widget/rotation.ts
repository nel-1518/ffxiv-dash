/**
 * PvP 地图轮换（纷争前线 / 水晶冲突）。
 *
 * 逻辑移植自 ffxiv-wakeng/pvp-calendar：
 * 用「已知轮换起点 + 固定周期」算出当前是第几个轮换，再对地图表取模。
 * 起点与周期都是绝对 UTC 时刻，因此浏览者所在时区不影响结果。
 *
 * 维护方式（与上游一致）：
 * - 增删地图：改对应数组，必要时把 REFERENCE 同步成一个已知的轮换起点；
 * - 改轮换周期：改周期常量，同样要同步 REFERENCE。
 *
 * 本模块是**纯数据 + 纯函数**，不引入 React，方便单独校对。
 */

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE

export type FrontlineMapId = 'secure' | 'seize' | 'shatter' | 'naadam' | 'triumph'
export type CcMapId =
  | 'palaistra'
  | 'volcanic'
  | 'castletown'
  | 'bayside'
  | 'cloudnine'
  | 'redsands'
  | 'harmonias'

/**
 * 纷争前线：每 24 小时在 23:00（北京）/ 15:00（UTC）轮换一次。
 *
 * 表长 8 而不是去重后的 5：上游就是按这个顺序排的 8 天循环，
 * 重复出现的 `seize` / `naadam` / `triumph` 是有意为之，改顺序前先核对游戏内实际轮换。
 */
export const FRONTLINE_ROTATION_MS = 24 * MS_PER_HOUR
export const FRONTLINE_REFERENCE = Date.parse('2026-04-27T15:00:00Z')

export const FRONTLINE_MAPS: readonly FrontlineMapId[] = [
  'seize', // 尘封秘岩
  'secure', // 周边遗迹群
  'naadam', // 昂萨哈凯尔
  'triumph', // 沃刻其特
  'seize', // 尘封秘岩
  'shatter', // 荣誉野
  'naadam', // 昂萨哈凯尔
  'triumph', // 沃刻其特
]

/** 水晶冲突：每 60 分钟轮换一次。 */
export const CC_ROTATION_MS = 60 * MS_PER_MINUTE
export const CC_REFERENCE = Date.parse('2026-04-28T13:00:00Z')

export const CC_MAPS: readonly CcMapId[] = [
  'palaistra', // 角力学校
  'volcanic', // 火山之心
  'bayside', // 海岸鸟群斗场
  'cloudnine', // 九霄云上
  'castletown', // 机关大殿
  'harmonias', // 休兵书库
  'redsands', // 赤土红沙
]

export const FRONTLINE_MAP_NAMES: Record<FrontlineMapId, string> = {
  seize: '尘封秘岩',
  secure: '周边遗迹群',
  naadam: '昂萨哈凯尔',
  triumph: '沃刻其特',
  shatter: '荣誉野',
}

export const CC_MAP_NAMES: Record<CcMapId, string> = {
  palaistra: '角力学校',
  volcanic: '火山之心',
  bayside: '海岸鸟群斗场',
  cloudnine: '九霄云上',
  castletown: '机关大殿',
  harmonias: '休兵书库',
  redsands: '赤土红沙',
}

/** 第几个轮换、这一轮的起点与下一次轮换的时刻。 */
type Rotation = { index: number; next: number }

function rotationAt(nowMs: number, reference: number, periodMs: number): Rotation {
  // 参考时间之前的时刻会算出负的 index；取模时统一补正，见 pickMap
  const index = Math.floor((nowMs - reference) / periodMs)
  return { index, next: reference + (index + 1) * periodMs }
}

/** 负数取模在 JS 里会保留负号，补一轮再取模才能落回 [0, length)。 */
function pickMap<T>(maps: readonly T[], index: number): T {
  return maps[((index % maps.length) + maps.length) % maps.length]
}

export type FrontlineRotation = {
  /** 当前生效的地图。 */
  map: FrontlineMapId
  /** 下一次轮换的时刻。 */
  nextRotation: Date
}

export function getFrontlineRotation(now: Date = new Date()): FrontlineRotation {
  const rotation = rotationAt(now.getTime(), FRONTLINE_REFERENCE, FRONTLINE_ROTATION_MS)
  return { map: pickMap(FRONTLINE_MAPS, rotation.index), nextRotation: new Date(rotation.next) }
}

/**
 * 下一次轮换后生效的纷争前线地图，也就是「次日」。
 *
 * 轮换点在 23:00，因此这个值在 00:00–22:59 就是次日的白天图；
 * 到了 23:00–23:59 当前图已经属于新的一天，它就顺延成再下一天，语义仍是"下一次轮换"。
 */
export function getNextFrontlineMap(now: Date = new Date()): FrontlineMapId {
  const rotation = rotationAt(now.getTime(), FRONTLINE_REFERENCE, FRONTLINE_ROTATION_MS)
  return pickMap(FRONTLINE_MAPS, rotation.index + 1)
}

export type CcRotation = {
  /** 当前生效的地图。 */
  map: CcMapId
  /**
   * 下一次轮换的时刻。
   *
   * 剩余时长由调用方拿这个时刻现算（卡片是在叶子里按"文本变了才渲染"取的快照）：
   * 在这里算好一个毫秒数反而用不上 —— 它一渲染就过期。
   */
  nextRotation: Date
}

export function getCcRotation(now: Date = new Date()): CcRotation {
  const rotation = rotationAt(now.getTime(), CC_REFERENCE, CC_ROTATION_MS)
  return {
    map: pickMap(CC_MAPS, rotation.index),
    nextRotation: new Date(rotation.next),
  }
}

/** 下一次轮换后生效的水晶冲突地图。 */
export function getNextCcMap(now: Date = new Date()): CcMapId {
  const rotation = rotationAt(now.getTime(), CC_REFERENCE, CC_ROTATION_MS)
  return pickMap(CC_MAPS, rotation.index + 1)
}

/**
 * 剩余时长：`时:分`。
 *
 * 分钟**向下取整**（秒直接截掉，不四舍五入）：显示 13h:17m 就代表还剩 13 小时 17 分多，
 * 不会因为四舍五入把 13:17:40 报成 13:18。
 */
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / MS_PER_MINUTE))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours)}h:${String(minutes).padStart(2, '0')}m`
}

/**
 * 剩余分钟数，形如 `09m`。
 *
 * 水晶冲突每小时轮换一次，剩余分钟恒在 0-59 之间，写小时段只会永远显示 0h；
 * 与 formatHoursMinutes 同样向下取整，分钟补足两位以免逐分变化时宽度跳动。
 */
export function formatMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / MS_PER_MINUTE))
  return `${String(totalMinutes).padStart(2, '0')}m`
}
