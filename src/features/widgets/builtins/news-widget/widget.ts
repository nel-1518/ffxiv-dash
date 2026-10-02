import { defineWidget } from '../../types.ts'
import { NEWS_DEFAULT_CONFIG, normalizeNewsConfig } from './config.ts'
import { NewsFormFields, NewsRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { NewsConfig } from './config.ts'

export const newsWidgetSpec: WidgetSpec<NewsConfig> = defineWidget<NewsConfig>({
  key: 'news',
  label: '公告活动',
  description:
    '*展示官网最新的公告与活动列表。可设置展示数量、高亮数量以及关键字筛选。点击条目打开官网详情页。',
  defaultTitle: '公告活动',
  defaultConfig: NEWS_DEFAULT_CONFIG,
  maxCount: 1,
  normalizeConfig: normalizeNewsConfig,
  FormFields: NewsFormFields,
  Render: NewsRender,
})
