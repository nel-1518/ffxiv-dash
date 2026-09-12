import { defineWidget } from '../../types.ts'
import { PVP_MAP_DEFAULT_CONFIG, normalizePvpMapConfig } from './config.ts'
import { PvpMapFormFields, PvpMapRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { PvpMapConfig } from './config.ts'

export const pvpMapWidgetSpec: WidgetSpec<PvpMapConfig> = defineWidget<PvpMapConfig>({
  key: 'pvp-map',
  label: 'PvP 地图轮换',
  defaultTitle: '',
  defaultConfig: PVP_MAP_DEFAULT_CONFIG,
  normalizeConfig: normalizePvpMapConfig,
  FormFields: PvpMapFormFields,
  Render: PvpMapRender,
})
