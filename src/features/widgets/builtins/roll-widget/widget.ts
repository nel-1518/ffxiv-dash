import { defineWidget } from '../../types.ts'
import type { WidgetSpec } from '../../types.ts'
import { normalizeRollConfig, ROLL_DEFAULT_CONFIG } from './config.ts'
import { RollFormFields, RollRender } from './fields.tsx'
import type { RollConfig } from './config.ts'

export const rollWidgetSpec: WidgetSpec<RollConfig> = defineWidget<RollConfig>({
  key: 'roll',
  label: '掷骰',
  description: '*掷出随机数，骰子数量与面数都可自定。',
  defaultTitle: '掷骰',
  defaultConfig: ROLL_DEFAULT_CONFIG,
  maxCount: 20,
  normalizeConfig: normalizeRollConfig,
  FormFields: RollFormFields,
  Render: RollRender,
})
