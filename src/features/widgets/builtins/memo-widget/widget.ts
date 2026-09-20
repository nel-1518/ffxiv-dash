import { defineWidget } from '../../types.ts'
import { MEMO_DEFAULT_CONFIG, normalizeMemoConfig } from './config.ts'
import { MemoFormFields, MemoRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { MemoConfig } from './config.ts'

export const memoWidgetSpec: WidgetSpec<MemoConfig> = defineWidget<MemoConfig>({
  key: 'memo',
  label: '便签',
  description:
    '*卡片按 Markdown 渲染，双击卡片正文可以直接修改原文；失焦保存，Esc 放弃，Ctrl+Enter 保存。',
  defaultTitle: '便签',
  defaultConfig: MEMO_DEFAULT_CONFIG,
  normalizeConfig: normalizeMemoConfig,
  FormFields: MemoFormFields,
  Render: MemoRender,
})
