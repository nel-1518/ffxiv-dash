import { defineWidget } from '../../types.ts'
import { GOLD_TRIAL_DEFAULT_CONFIG, normalizeGoldTrialConfig } from './config.ts'
import { GoldTrialFormFields, GoldTrialRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { GoldTrialConfig } from './config.ts'

export const goldTrialWidgetSpec: WidgetSpec<GoldTrialConfig> = defineWidget<GoldTrialConfig>({
  key: 'goldTrial',
  label: '黄金的试炼',
  description:
    '*展示本周「黄金的试炼」的挑战副本、挑战时段、登记截止倒计时与奖励。点击卡片跳到活动专题页登记。',
  defaultTitle: '黄金的试炼',
  defaultConfig: GOLD_TRIAL_DEFAULT_CONFIG,
  // 全局信息卡：同一块看板上有一张就够，多张只会重复同一个接口结果
  maxCount: 1,
  normalizeConfig: normalizeGoldTrialConfig,
  FormFields: GoldTrialFormFields,
  Render: GoldTrialRender,
})
