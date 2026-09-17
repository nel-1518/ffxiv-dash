import { defineWidget } from '../../types.ts'
import { MARKET_DEFAULT_CONFIG, normalizeMarketConfig } from './config.ts'
import { MarketFormFields, MarketRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { MarketConfig } from './config.ts'

export const marketWidgetSpec: WidgetSpec<MarketConfig> = defineWidget<MarketConfig>({
  key: 'market',
  label: '物品价格',
  description: '*查询某个物品在指定区服的价格，适合用于速览当前行情，详细查价建议使用原网站 Universalis。展示数据包括最低价格、平均售价、最近成交价，NQ 与 HQ 分开显示。数据来自 Universalis，打开页面时获取一次，结果缓存 1 小时。',
  defaultTitle: '物品价格',
  defaultConfig: MARKET_DEFAULT_CONFIG,
  normalizeConfig: normalizeMarketConfig,
  FormFields: MarketFormFields,
  Render: MarketRender,
})
