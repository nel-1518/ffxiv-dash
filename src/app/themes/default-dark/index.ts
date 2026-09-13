import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 默认-深色：antd 深色算法的原生观感，不带资料片色调，只覆盖一个令牌。
 */
export const defaultDarkSpec: ThemeSpec = {
  key: 'default-dark',
  label: '默认-深色',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      /* 基线里的 colorBgLayout 是浅灰（app/theme-config.ts 的 PAGE_BACKGROUND），深色必须盖掉 */
      colorBgLayout: '#0A0A0A',
    },
  },
  cards: { alpha: 100, blur: 0 },
}
