/**
 * 房屋抽签周期（纯逻辑，无 React）。
 *
 * 房屋抽签是固定 9 天一轮：**申请期 5 天 + 公示期 4 天**，两者首尾相接。
 * 卡片只用它回答一个问题：现在处于哪个时期、还剩多久。
 *
 * 维护方式与 `pvp-map-widget/rotation.ts` 一致：已知起点 + 固定周期做取模。
 * 一旦游戏调整周期长度、或维护挪动了轮换点，把 `HOUSE_PHASE_ANCHOR` 换成一个
 * **已知的申请期起点**即可，其余代码一行都不用动。
 */
const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

export const HOUSE_ENTRY_MS = 5 * MS_PER_DAY
export const HOUSE_RESULT_MS = 4 * MS_PER_DAY
export const HOUSE_CYCLE_MS = HOUSE_ENTRY_MS + HOUSE_RESULT_MS

/**
 * 锚点 = 一个已知的申请期起点。
 *
 * 北京时间 2026-09-19 23:00（= UTC 15:00）：公示期结束、申请期开始。
 */
export const HOUSE_PHASE_ANCHOR = Date.parse('2026-09-19T15:00:00Z')

export type HousePhaseKind = 'entry' | 'result'

export const HOUSE_PHASE_LABELS: Record<HousePhaseKind, string> = {
  entry: '申请期',
  result: '公示期',
}

export type HousePhase = {
  kind: HousePhaseKind
  /** 本阶段的起点 / 终点（epoch ms）。 */
  startAt: number
  endAt: number
  /** 距本阶段结束还剩多少毫秒。 */
  remaining: number
}

/** 锚点之前的时刻会算出负偏移；补一轮再取模才能落回 [0, CYCLE)。 */
function cycleOffset(nowMs: number): number {
  const offset = (nowMs - HOUSE_PHASE_ANCHOR) % HOUSE_CYCLE_MS
  return offset < 0 ? offset + HOUSE_CYCLE_MS : offset
}

export function resolveHousePhase(now: Date = new Date()): HousePhase {
  const nowMs = now.getTime()
  // offset 是"距本轮申请期开始过了多久"，所以 nowMs - offset 是**整轮**的起点
  const offset = cycleOffset(nowMs)
  const kind: HousePhaseKind = offset < HOUSE_ENTRY_MS ? 'entry' : 'result'
  const startAt = nowMs - offset + (kind === 'entry' ? 0 : HOUSE_ENTRY_MS)
  // 公示期紧跟在申请期之后，所以终点要按当前这一段的长度加，不能一律加整轮
  const endAt = startAt + (kind === 'entry' ? HOUSE_ENTRY_MS : HOUSE_RESULT_MS)
  return { kind, startAt, endAt, remaining: endAt - nowMs }
}

/**
 * 剩余时长文案：`2 天 03h:07m`，不足一天时只有 `05h:12m`。
 *
 * 分钟**向下取整**（与 pvp 卡 `formatHoursMinutes` 同一规矩）：显示 03h:07m 就是还剩
 * 3 小时 7 分多，不会因为四舍五入把 7 分 40 秒报成 8 分。小时补零，宽度才不抖。
 */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / MS_PER_MINUTE))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  const clock = `${String(hours).padStart(2, '0')}h:${String(minutes).padStart(2, '0')}m`
  return days > 0 ? `${days}d:${clock}` : clock
}

/** 阶段边界的短文案 `09-19 23:00`，按浏览者本地时区（国内即北京时间）。 */
export function formatBoundary(ms: number): string {
  const at = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}
