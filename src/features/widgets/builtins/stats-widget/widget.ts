import { defineWidget } from '../../types.ts'
import type { WidgetSpec } from '../../types.ts'
import { normalizeStatsConfig, STATS_DEFAULT_CONFIG } from './config.ts'
import { StatsFormFields, StatsRender } from './fields.tsx'
import type { StatsConfig } from './config.ts'

export const statsWidgetSpec: WidgetSpec<StatsConfig> = defineWidget<StatsConfig>({
  key: 'stats',
  label: '进度',
  description:
    '*跟踪一个任务推进到哪个阶段的卡片，可自定义阶段名称。',
  defaultTitle: '进度',
  defaultConfig: STATS_DEFAULT_CONFIG,
  maxCount: 20,
  normalizeConfig: normalizeStatsConfig,
  FormFields: StatsFormFields,
  Render: StatsRender,
})
