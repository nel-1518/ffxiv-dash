import { SearchOutlined } from '@ant-design/icons'
import type { SearchEngineConfig } from '../../core/search/store.ts'

/**
 * 一个外部搜索引擎。
 *
 * 搜索设置里的配置会补上图标；搜索弹窗只消费这个统一形状。
 */
export type SearchEngine = {
  /** 稳定标识，用作 React key 与去重依据。 */
  key: string
  /** 展示名，用在「用 xxx 搜索 …」的文案里。 */
  name: string
  /**
  * 跳转地址模板。`%s` 是关键词占位符。
   *
  * 替换前会做 `encodeURIComponent`，所以模板里不要再自己编码。
   */
  urlTemplate: string
  /** 行首图标；缺省时用通用搜索图标。 */
  icon?: React.ReactNode
}

/** 关键词占位符。 */
export const KEYWORD_PLACEHOLDER = '%s'

export function toSearchEngine(config: SearchEngineConfig): SearchEngine {
  return { ...config, icon: <SearchOutlined /> }
}

/** 把模板里的占位符替换成编码后的关键词。 */
export function buildEngineUrl(engine: SearchEngine, keyword: string): string {
  return engine.urlTemplate.replace(KEYWORD_PLACEHOLDER, encodeURIComponent(keyword))
}
