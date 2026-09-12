import { defineWidget } from '../../types.ts'
import { MARKET_DEFAULT_CONFIG, normalizeMarketConfig } from './config.ts'
import { MarketFormFields, MarketRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { MarketConfig } from './config.ts'

export const marketWidgetSpec: WidgetSpec<MarketConfig> = defineWidget<MarketConfig>({
  key: 'market',
  label: '物品价格',
  defaultTitle: '物品价格',
  defaultConfig: MARKET_DEFAULT_CONFIG,
  normalizeConfig: normalizeMarketConfig,
  FormFields: MarketFormFields,
  Render: MarketRender,
})
