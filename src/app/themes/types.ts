import type { ThemeConfig } from 'antd'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 主题规格。
 *
 * 一套主题 = 一个文件夹（`src/app/themes/<key>/`）：`index.ts` 放 antd 令牌与元信息，
 * `theme.css`（按需）放 antd 管不到的 `--dash-*` 变量。只改令牌的主题不需要 theme.css。
 *
 * 新增/删除主题的步骤、变量约定、八套速查表：见 `docs/themes.md`。
 */

/** 主题自带的背景预设（用户没自己选背景时用它）。固定“铺满裁切”（cover），不提供铺法选项。 */
export type ThemeBackground = {
  /** `public/` 下的绝对路径，例如 `/bg/8-evercold.webp`。 */
  url: string
  /** 模糊 0-20（px）。 */
  blur?: number
  /** 亮度 20-150（%），压暗用 <100 的值。 */
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
