import { defineWidget } from '../../types.ts'
import { COUNTDOWN_DEFAULT_CONFIG, normalizeCountdownConfig } from './config.ts'
import { CountdownFormFields, CountdownRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { CountdownConfig } from './config.ts'

export const countdownWidgetSpec: WidgetSpec<CountdownConfig> = defineWidget<CountdownConfig>({
  key: 'countdown',
  label: '倒数日',
  description:
    '*记录还有多少天到某件事：填上事件名称与日期，卡片就会显示「距【事件】还有 XX 日」。日期一律按本地日历日计算，跨天自动刷新。',
  defaultTitle: '倒数日',
  defaultConfig: COUNTDOWN_DEFAULT_CONFIG,
  maxCount: 20,
  normalizeConfig: normalizeCountdownConfig,
  FormFields: CountdownFormFields,
  Render: CountdownRender,
})
