import type { ThemeConfig } from 'antd'

/**
 * 页面底色（浅灰）。
 *
 * 用设计令牌而不是散落各处的颜色值，是为了让卡片、面板与页面背景形成层次：
 * 页面浅灰、卡片纯白，边界一眼可见。
 * 想更浅或更深时只改这一个值，或直接覆盖 token.colorBgLayout。
 */
const PAGE_BACKGROUND = '#eeece9'

/**
 * antd 主题配置。
 *
 * 目前只改了页面底色，其余沿用 antd 默认主题。
 * 后续要随主题切换（暗色、自定义主色、FFXIV 配色）时，**只需改这里**：
 * - 暗色：theme.algorithm = theme.darkAlgorithm（此时上面的浅灰会被算法替换）
 * - 主色/圆角：token.colorPrimary / token.borderRadius
 */
export function createAppTheme(): ThemeConfig {
  return {
    token: {
      colorBgLayout: PAGE_BACKGROUND,
    },
    components: {},
  }
}
