import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 默认-深色：antd 深色算法（`darkAlgorithm`）的原生观感，不带资料片色调。
 *
 * 只覆盖一个令牌、只写三条 CSS 变量 —— 其余全部交给算法派生，
 * 所以它跟随 antd 自己的深色规范。
 *
 * ⚠️ **不需要**银海那套"把卡片内文字整体翻成浅色"的写法（`evercold/theme.css` 里
 * 那一大段 `*` 选择器规则）：那边是"深色主题 + 浅色卡片"的错配才要补；
 * 这里卡片底色与页面同属深色系，正文色直接来自深色令牌，天然统一。
 */
export const defaultDarkSpec: ThemeSpec = {
  key: 'default-dark',
  label: '默认-深色',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      /*
       * 基线里的 colorBgLayout 是浅灰（`app/theme-config.ts` 的 PAGE_BACKGROUND），
       * 深色主题必须覆盖它，否则会得到"浅色页面 + 深色卡片"。
       */
      colorBgLayout: '#0A0A0A',
    },
  },
  cards: {
    alpha: 100,
    blur: 0,
  },
}
