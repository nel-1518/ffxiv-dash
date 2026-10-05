import { defineWidget } from '../../types.ts'
import { EXCHANGE_DEFAULT_CONFIG, normalizeExchangeConfig } from './config.ts'
import { ExchangeFormFields, ExchangeRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { ExchangeConfig } from './config.ts'

export const exchangeWidgetSpec: WidgetSpec<ExchangeConfig> = defineWidget<ExchangeConfig>({
  key: 'exchange',
  label: '汇率',
  description:
    '*查询两种常用货币之间的汇率（默认人民币 → 日元）。数据来自 Frankfurter（非实时数据，仅供参考）。打开页面时获取一次，结果缓存 8 小时。',
  defaultTitle: '汇率',
  defaultConfig: EXCHANGE_DEFAULT_CONFIG,
  maxCount: 5,
  normalizeConfig: normalizeExchangeConfig,
  FormFields: ExchangeFormFields,
  Render: ExchangeRender,
})
