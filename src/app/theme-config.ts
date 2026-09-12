import { getThemeSpec } from './themes/index.ts'
import type { ThemeConfig } from 'antd'
import type { ThemeKey } from '../core/theme-preference.ts'

/**
 * 页面底色（浅灰）。
 *
 * 用设计令牌而不是散落各处的颜色值，是为了让卡片、面板与页面背景形成层次：
 * 页面浅灰、卡片纯白，边界一眼可见。
 */
const PAGE_BACKGROUND = '#efeaea'

/**
 * 基线主题：**所有主题都以它为底**。
 *
 * 各主题只声明自己要覆盖的那几项（见 `src/app/themes/<key>/`），
 * 因此"还没做配色"的主题（`antd: {}`）自然就是这个基线，
 * 选了它界面与加主题系统之前完全一致。
 *
 * ⚠️ 卡片底色、投影这类 antd 变量管不到的东西不在这里，走各主题的 `theme.css`
 * （`--dash-*` 变量 + `[data-dash-theme]` 作用域）。
 */
const BASE_THEME: ThemeConfig = {
  token: {
    colorBgLayout: PAGE_BACKGROUND,
  },
  components: {},
}

/** 把主题规格合成 antd 的 ThemeConfig。 */
export function createAppTheme(key: ThemeKey): ThemeConfig {
  const { antd } = getThemeSpec(key)
  return {
    algorithm: antd.algorithm,
    token: { ...BASE_THEME.token, ...antd.token },
    components: { ...BASE_THEME.components, ...antd.components },
  }
}
