import { defineWidget } from '../../types.ts'
import { PVP_MAP_DEFAULT_CONFIG, normalizePvpMapConfig } from './config.ts'
import { PvpMapFormFields, PvpMapRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { PvpMapConfig } from './config.ts'

export const pvpMapWidgetSpec: WidgetSpec<PvpMapConfig> = defineWidget<PvpMapConfig>({
  key: 'pvp-map',
  label: 'PvP 地图轮换',
  description: '*显示纷争前线与水晶冲突的当前地图、下一张地图，并进行轮换倒计时（纷争前线每 24 小时一换，水晶冲突每 60 分钟一换）。按本地时间推算，可能和服务器时间有所出入。',
  defaultTitle: 'PvP 地图轮换',
  defaultConfig: PVP_MAP_DEFAULT_CONFIG,
  maxCount: 20,
  normalizeConfig: normalizePvpMapConfig,
  FormFields: PvpMapFormFields,
  Render: PvpMapRender,
})
