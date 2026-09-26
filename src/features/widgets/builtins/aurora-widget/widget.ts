import { defineWidget } from '../../types.ts'
import { AURORA_DEFAULT_CONFIG, normalizeAuroraConfig } from './config.ts'
import { AuroraFormFields, AuroraRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { AuroraConfig } from './config.ts'

export const auroraWidgetSpec: WidgetSpec<AuroraConfig> = defineWidget<AuroraConfig>({
  key: 'aurora',
  label: '极光预报',
  description:
    '*预报库尔札斯西部高地与旧萨雷安的极光天气。两地各列出接下来 6 次窗口。',
  defaultTitle: '极光预报',
  defaultConfig: AURORA_DEFAULT_CONFIG,
  maxCount: 5,
  normalizeConfig: normalizeAuroraConfig,
  FormFields: AuroraFormFields,
  Render: AuroraRender,
})
