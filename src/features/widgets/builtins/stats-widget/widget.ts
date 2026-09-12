import { defineWidget } from '../../types.ts'
import type { WidgetSpec } from '../../types.ts'
import { normalizeStatsConfig, STATS_DEFAULT_CONFIG } from './config.ts'
import { StatsFormFields, StatsRender } from './fields.tsx'
import type { StatsConfig } from './config.ts'

export const statsWidgetSpec: WidgetSpec<StatsConfig> = defineWidget<StatsConfig>({
  key: 'stats',
  label: '统计卡',
  defaultTitle: '',
  defaultConfig: STATS_DEFAULT_CONFIG,
  normalizeConfig: normalizeStatsConfig,
  FormFields: StatsFormFields,
  Render: StatsRender,
})
