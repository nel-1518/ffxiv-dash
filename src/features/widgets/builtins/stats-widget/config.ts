/** 统计卡的配置类型、默认值与归一化（纯数据，无组件）。 */
export type StatsConfig = {
  /** 当前数值。 */
  value: number
  /** 数值上限；进度 = value / max，实时算出来，不再手填。 */
  max: number
}

export const STATS_DEFAULT_CONFIG: StatsConfig = {
  value: 0,
  max: 100,
}

function toInteger(raw: unknown, fallback: number): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

export function normalizeStatsConfig(raw: unknown): StatsConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  // 上限至少为 1：既避免进度除零，也让"上限"这件事始终成立
  const max = Math.max(1, toInteger(source.max, STATS_DEFAULT_CONFIG.max))
  const value = Math.min(max, Math.max(0, toInteger(source.value, STATS_DEFAULT_CONFIG.value)))
  return { value, max }
}
