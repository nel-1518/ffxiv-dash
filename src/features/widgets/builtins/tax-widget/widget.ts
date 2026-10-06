import { defineWidget } from '../../types.ts'
import { TAX_DEFAULT_CONFIG, normalizeTaxConfig } from './config.ts'
import { TaxFormFields, TaxRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { TaxConfig } from './config.ts'

export const taxWidgetSpec: WidgetSpec<TaxConfig> = defineWidget<TaxConfig>({
  key: 'tax',
  label: '市场税率',
  description:
    '*查询某个服务器各主城市场的当前交易税率，只显示正在减税的城市；输入金额后按各城市税率估算卖出与买入实付的金额。数据来自 Universalis。打开页面时获取一次，结果缓存 8 小时。',
  defaultTitle: '市场税率',
  defaultConfig: TAX_DEFAULT_CONFIG,
  maxCount: 5,
  normalizeConfig: normalizeTaxConfig,
  FormFields: TaxFormFields,
  Render: TaxRender,
})
