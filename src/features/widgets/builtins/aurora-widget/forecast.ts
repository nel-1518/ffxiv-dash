/**
 * 极光预报的纯逻辑：天气种子、碧空判定与极光窗口搜索。
 *
 * 天气算法整理自 https://github.com/Asvel/ffxiv-weather ：
 * 天气每 8 个艾欧泽亚小时（= 1400 地球秒）更换一次，
 * 由窗口起点推一个 0~99 的种子，再按各区域的概率表落位到具体天气。
 *
 * 极光规则（https://ff14.huijiwiki.com/wiki/天气#极光）：
 * 在库尔札斯西部高地与旧萨雷安，ET 00:00~08:00 的天气窗口若为「碧空」，
 * 则该窗口的前半段 ET 00:00~04:00 会出现极光。
 *
 * 不导入 React、不碰 DOM，输入输出都是原始值 —— 可以脱离浏览器单独验证。
 */

/** 1 艾欧泽亚小时（bell）= 175 地球秒。 */
const BELL_MS = 175_000

/** 天气窗口长度：8 个艾欧泽亚小时；窗口起点循环对齐到 ET 00:00 / 08:00 / 16:00。 */
const WINDOW_BELLS = 8

/** 极光可见时长：ET 00:00~04:00 = 4 个艾欧泽亚小时 = 700 地球秒。 */
const AURORA_BELLS = 4

/** 一个艾欧泽亚日是 24 个 bell；极光只出现在 ET 00:00 起的那一格天气窗口。 */
const BELLS_PER_DAY = 24

/**
 * 搜索窗口数的安全上界：5000 格天气窗口 ≈ 194 个现实日。
 * 「碧空」最稀有的区域（库尔札斯西部高地，5%）平均 ~23 现实小时才出现一次，
 * 凑 3 次远用不到这个数 —— 它只保证极端不走运时函数能停下来。
 */
const MAX_WINDOWS = 5000

export type AuroraZoneId = 'coerthas-western' | 'old-sharlayan'

/** 天气 id；本组件只关心 `clear-skies`（碧空），其余仅用于概率表落位。 */
type WeatherId = 'blizzards' | 'snow' | 'fair-skies' | 'clear-skies' | 'clouds' | 'fog'

/**
 * 极光区域的天气概率表：种子 0~99 落在哪个累计区间就是哪种天气。
 * 数据整理自 ffxiv-weather ——「碧空」在库尔札斯西部高地占 70~74（5%），
 * 在旧萨雷安占 0~9（10%），因此两地的极光时间线并不相同。
 */
const ZONE_WEATHER_TABLES: Record<AuroraZoneId, [WeatherId, number][]> = {
  'coerthas-western': [
    ['blizzards', 20],
    ['snow', 60],
    ['fair-skies', 70],
    ['clear-skies', 75],
    ['clouds', 90],
    ['fog', 100],
  ],
  'old-sharlayan': [
    ['clear-skies', 10],
    ['fair-skies', 50],
    ['clouds', 70],
    ['fog', 85],
    ['snow', 100],
  ],
}

/**
 * 天气种子的「钟点」偏移：ET 16:00 记 0、00:00 记 8、08:00 记 16
 * （ffxiv-weather 原注释：为了计算，16:00 是 0、00:00 是 8、08:00 是 16）。
 */
function forecastIncrement(bell: number): number {
  return (bell + 8 - (bell % WINDOW_BELLS)) % 24
}

/**
 * 计算某个天气窗口的种子（0~99）。
 * 整理自 ffxiv-weather 的 `calculateForecastTarget`，按窗口起点求值。
 * @param bell 窗口起点的 bell 序号（自 unix 纪元起算的 175 秒格数，须为 8 的倍数）
 */
function weatherSeed(bell: number): number {
  // 窗口起点的 unix 秒：bell * 175（整数，无精度问题）
  const unix = bell * 175
  // 艾欧泽亚日序（1 日 = 4200 地球秒）
  const totalDays = Math.trunc(unix / 4200) >>> 0
  const calcBase = totalDays * 0x64 + forecastIncrement(bell)
  const step1 = ((calcBase << 0xb) ^ calcBase) >>> 0
  const step2 = ((step1 >>> 8) ^ step1) >>> 0
  return step2 % 0x64
}

/** 种子落位后的天气 id。 */
function weatherAt(zone: AuroraZoneId, seed: number): WeatherId {
  const table = ZONE_WEATHER_TABLES[zone]
  for (const [weather, threshold] of table) {
    if (seed < threshold) {
      return weather
    }
  }
  return table[table.length - 1][0]
}

export type AuroraWindow = {
  /** 极光开始（ET 00:00）的现实毫秒时间戳。 */
  startMs: number
  /** 极光结束（ET 04:00）的现实毫秒时间戳（= 开始后 700 地球秒）。 */
  endMs: number
  /** 相对查询时刻是否正在极光时段内。 */
  ongoing: boolean
}

/**
 * 从 `nowMs` 出发，找出某区域接下来 `count` 次极光窗口。
 *
 * 天气窗口每 3 格轮到一次 ET 00:00 起点，因此只对 `bell % 24 === 0` 的窗口做
 * 碧空判定；当前窗口若极光已过 ET 04:00（结束时刻不晚于查询时刻）则跳过。
 */
export function findAuroraWindows(zone: AuroraZoneId, nowMs: number, count: number): AuroraWindow[] {
  const currentBell = Math.floor(nowMs / BELL_MS)
  // 对齐到包含 nowMs 的天气窗口起点
  let bell = currentBell - (currentBell % WINDOW_BELLS)

  const windows: AuroraWindow[] = []
  for (let i = 0; i < MAX_WINDOWS && windows.length < count; i++, bell += WINDOW_BELLS) {
    if (bell % BELLS_PER_DAY !== 0) {
      continue
    }
    const startMs = bell * BELL_MS
    const endMs = startMs + AURORA_BELLS * BELL_MS
    if (endMs <= nowMs) {
      continue
    }
    if (weatherAt(zone, weatherSeed(bell)) !== 'clear-skies') {
      continue
    }
    windows.push({ startMs, endMs, ongoing: nowMs >= startMs })
  }
  return windows
}
