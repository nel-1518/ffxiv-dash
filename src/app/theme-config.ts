import { getThemeSpec } from './themes/index.ts'
import type { ThemeConfig } from 'antd'
import type { ThemeKey } from '../core/theme-preference.ts'

/** 页面底色（浅灰）：页面浅灰、卡片纯白，形成层次。 */
const PAGE_BACKGROUND = '#efeaea'

/**
 * 基线主题：所有主题都以它为底，各主题只声明覆盖项（见 `src/app/themes/<key>/`），
 * 未声明配色的主题（`antd: {}`）即等于基线。
 *
 * ⚠️ 卡片底色、投影等 antd 变量管不到的部分不在这里，走各主题的 `theme.css`
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
