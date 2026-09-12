import { SearchOutlined } from '@ant-design/icons'

/**
 * 一个外部搜索引擎。
 *
 * **扩展点**：新增引擎只需要往 `SEARCH_ENGINES` 里追加一项，
 * 搜索弹窗的「搜索引擎」段与键盘导航都会自动带上它，不需要改 UI 代码。
 */
export type SearchEngine = {
  /** 稳定标识，用作 React key 与去重依据。 */
  key: string
  /** 展示名，用在「用 xxx 搜索 …」的文案里。 */
  name: string
  /**
   * 跳转地址模板。`%%` 是关键词占位符。
   *
   * 替换前会做 `encodeURIComponent`，所以模板里不要再自己编码，
   * 也不要写成 `%25%25`。
   */
  urlTemplate: string
  /** 行首图标；缺省时用通用搜索图标。 */
  icon?: React.ReactNode
}

/** 关键词占位符。用 `%%` 而不是 `{q}`：它在 URL 里不会和查询参数撞车。 */
export const KEYWORD_PLACEHOLDER = '%%'

export const SEARCH_ENGINES: readonly SearchEngine[] = [
  {
    key: 'baidu',
    name: '百度',
    urlTemplate: 'https://www.baidu.com/s?ie=utf-8&wd=%%',
    icon: <SearchOutlined />,
  },
]

/** 把模板里的占位符替换成编码后的关键词。 */
export function buildEngineUrl(engine: SearchEngine, keyword: string): string {
  return engine.urlTemplate.replace(KEYWORD_PLACEHOLDER, encodeURIComponent(keyword))
}
