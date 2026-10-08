import { defineWidget } from '../../types.ts'
import {
  ACTIVITY_CALENDAR_DEFAULT_CONFIG,
  normalizeActivityCalendarConfig,
} from './config.ts'
import { ActivityCalendarFormFields, ActivityCalendarRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { ActivityCalendarConfig } from './config.ts'

export const activityCalendarWidgetSpec: WidgetSpec<ActivityCalendarConfig> =
  defineWidget<ActivityCalendarConfig>({
    key: 'activityCalendar',
    label: '活动日历',
    description:
      '*展示官方活动的倒计时列表，数据来自石之家活动日历，距结束不超过指定天数（默认 3 天）转强调色，已结束置灰。点击条目跳到活动专题页。',
    defaultTitle: '活动日历',
    defaultConfig: ACTIVITY_CALENDAR_DEFAULT_CONFIG,
    // 全局信息卡：同一块看板上有一张就够，多张只会重复同一个接口结果
    maxCount: 1,
    normalizeConfig: normalizeActivityCalendarConfig,
    FormFields: ActivityCalendarFormFields,
    Render: ActivityCalendarRender,
  })
