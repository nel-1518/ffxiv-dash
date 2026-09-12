import type { ThemeSpec } from '../types.ts'

/**
 * 默认-浅色：**就是基线主题本身**（`app/theme-config.ts` 的 `BASE_THEME`）。
 *
 * `antd: {}` + 不写 `theme.css`，所以它不需要维护任何色值 ——
 * 基线改了什么，"默认-浅色"跟着改什么。这也是它与其它主题的分工：
 * 那几套是"有性格"的资料片配色，这两套是干净的中性底色，用来托底与做对照。
 *
 */
export const defaultLightSpec: ThemeSpec = {
  key: 'default-light',
  label: '默认-浅色',
  antd: {},
  cards: {
    alpha: 100,
    blur: 0,
  },
}
