import { defineWidget } from '../../types.ts'
import { COUNTDOWN_DEFAULT_CONFIG, normalizeCountdownConfig } from './config.ts'
import { CountdownFormFields, CountdownRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { CountdownConfig } from './config.ts'

export const countdownWidgetSpec: WidgetSpec<CountdownConfig> = defineWidget<CountdownConfig>({
  key: 'countdown',
  label: '倒数日',
  description:
    '*记录还有多少天到某件事：填上事件名称与日期，卡片就会显示「距【事件】还有 XX 日」。日期已经过去时改为显示「已过去 XX 日」。周期可选不重复、每周、每月、每年 —— 选了周期之后倒数会自动指向下一个日期（例如每月的 15 号过完了就指向下个月 15 号），不会停在过去。日期一律按本地日历日计算，跨天自动刷新。',
  defaultTitle: '倒数日',
  defaultConfig: COUNTDOWN_DEFAULT_CONFIG,
  normalizeConfig: normalizeCountdownConfig,
  FormFields: CountdownFormFields,
  Render: CountdownRender,
})
