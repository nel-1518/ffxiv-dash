import { defineWidget } from '../../types.ts'
import type { WidgetSpec } from '../../types.ts'
import { normalizeStatsConfig, STATS_DEFAULT_CONFIG } from './config.ts'
import { StatsFormFields, StatsRender } from './fields.tsx'
import type { StatsConfig } from './config.ts'

export const statsWidgetSpec: WidgetSpec<StatsConfig> = defineWidget<StatsConfig>({
  key: 'stats',
  label: '进度卡',
  description: '*可用于跟踪进度的卡片，记录当前数值和目标上限，适合计数、日常打卡、成就进度等场景。圆环就是完成度，点击数字可直接修改当前值，鼠标移到卡片上，左右两侧会浮出加减按钮。',
  defaultTitle: '进度卡',
  defaultConfig: STATS_DEFAULT_CONFIG,
  normalizeConfig: normalizeStatsConfig,
  FormFields: StatsFormFields,
  Render: StatsRender,
})
