import { defineWidget } from '../../types.ts'
import { REST_DEFAULT_CONFIG, normalizeRestConfig } from './config.ts'
import { RestFormFields, RestRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { RestConfig } from './config.ts'

export const restWidgetSpec: WidgetSpec<RestConfig> = defineWidget<RestConfig>({
  /*
   * key 用 `pomodoro`：`rest` 太泛（将来难保不会有别的"休息"类卡片），
   * 而 `pomodoro` 与 `countdown` 一样是单个语义词。写进用户数据后不要再改。
   */
  key: 'pomodoro',
  label: '休息提醒',
  description:
    '可用于提醒休息的番茄钟，专注与休息交替倒计时。时段结束会使用系统通知提醒。',
  defaultTitle: '休息提醒',
  defaultConfig: REST_DEFAULT_CONFIG,
  normalizeConfig: normalizeRestConfig,
  FormFields: RestFormFields,
  Render: RestRender,
})
