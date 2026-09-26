/** 统计卡的配置类型、默认值与归一化（纯数据，无组件）。 */
export type StatsConfig = {
  /** 事项名称：卡片正文里展示的名字，与卡片标题相互独立。 */
  name: string
  /** 阶段名列表，按填写顺序依次推进。 */
  stages: string[]
  /** 当前阶段下标，0 起；进度 = stageIndex / (stages.length - 1)。 */
  stageIndex: number
}

/** 事项名称的长度上限（输入框与归一化共用，别各写一份）。 */
export const MAX_STATS_NAME_LENGTH = 30

export const STATS_DEFAULT_CONFIG: StatsConfig = {
  name: '',
  stages: [],
  stageIndex: 0,
}

function toIndex(raw: unknown, fallback: number): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

export function normalizeStatsConfig(raw: unknown): StatsConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  const name =
    typeof source.name === 'string' ? source.name.trim().slice(0, MAX_STATS_NAME_LENGTH) : ''

  // 阶段：只收非空行。整体为空时回退默认三阶段，卡片永远不会"没有阶段可推进"
  const stages = Array.isArray(source.stages)
    ? source.stages
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item !== '')
    : []
  const finalStages = stages.length > 0 ? stages : STATS_DEFAULT_CONFIG.stages

  // 单阶段没有"推进"可言，下标恒为 0；多阶段夹取到 [0, length-1]
  const maxIndex = finalStages.length - 1
  const stageIndex = Math.min(maxIndex, Math.max(0, toIndex(source.stageIndex, 0)))

  return { name, stages: finalStages, stageIndex }
}
