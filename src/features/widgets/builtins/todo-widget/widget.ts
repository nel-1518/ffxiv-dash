import { defineWidget } from '../../types.ts'
import { TODO_DEFAULT_CONFIG, normalizeTodoConfig } from './config.ts'
import { TodoFormFields, TodoRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { TodoConfig } from './config.ts'

export const todoWidgetSpec: WidgetSpec<TodoConfig> = defineWidget<TodoConfig>({
  key: 'todo',
  label: '待办',
  description:
    '待办清单，可以设置刷新周期与时刻，到点后所有待办自动变回未完成。',
  defaultTitle: '待办',
  defaultConfig: TODO_DEFAULT_CONFIG,
  normalizeConfig: normalizeTodoConfig,
  FormFields: TodoFormFields,
  Render: TodoRender,
})
