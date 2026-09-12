import type { ThemeConfig } from 'antd'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 主题规格。
 *
 * 一套主题 = 一个文件夹（`src/app/themes/<key>/`）：
 * - `index.ts`（必需）：antd 令牌（颜色、圆角、字体等）与本主题的元信息；
 * - `theme.css`（按需）：antd 变量管不到的那部分，写成 `[data-dash-theme='<key>']`
 *   作用域的 `--dash-*` 变量（页面底色、卡片底色、投影、描边…）。
 *   只改 antd 令牌的主题不需要这个文件。
 *
 * 这样"换/改一套主题"只动一个文件夹；新增主题 = 复制文件夹 + 在 `THEME_KEYS` 与
 * 注册表里各加一行（漏了会编译报错）。
 */

/** 主题自带的背景预设：用户没自己选背景时用它。 */
export type ThemeBackground = {
  /** `public/` 下的绝对路径，例如 `/bg/8-evercold.webp`。固定“铺满裁切”（cover），不提供铺法选项。 */
  url: string
  /** 模糊 0-20（px）。 */
  blur?: number
  /** 亮度 20-150（%）。压暗用 <100 的值（相当于旧的“蒙版”）。 */
  brightness?: number
}

/** 主题自带的卡片外观（组件卡与导航卡共用的半透明 + 毛玻璃）。 */
export type ThemeCards = {
  /** 卡片底色不透明度 0-100（%）。 */
  alpha?: number
  /** 卡片背后那层的模糊 0-30（px）。 */
  blur?: number
}

export type ThemeSpec = {
  key: ThemeKey
  /** 设置面板里显示的名字。 */
  label: string
  /**
   * 本主题**覆盖**在基线之上的 antd 配置（见 `app/theme-config.ts` 的合成逻辑）：
   * 没写的项沿用基线，因此只做了一半的主题也不会把界面改坏。
   */
  antd: ThemeConfig
  /** 默认背景；不写就是"纯主题色，无图"。 */
  background?: ThemeBackground
  /** 默认卡片外观；不写就沿用 `DEFAULT_APPEARANCE`（62 / 12）。 */
  cards?: ThemeCards
}
