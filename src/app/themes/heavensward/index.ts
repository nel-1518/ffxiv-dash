import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 苍穹（Heavensward）。取色见 `docs/themes.md`（来源：官方专题站 na.finalfantasyxiv.com/heavensward/ 的样式表）。
 * ⚠️ 官网模板的 `#73bfe6`（Lodestone 公共站蓝）与左侧 `#e30613`（SE 品牌红）都不是本主题的色。
 */
export const heavenswardSpec: ThemeSpec = {
  key: 'heavensward',
  label: '苍穹',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#9fd2ef',
      colorInfo: '#cceaff',
      colorLink: '#cceaff',
      colorWarning: '#d9b85e',
      colorError: '#f05a8a',
      colorBgLayout: '#12141a',
      colorBgContainer: '#1f2633',
      colorBgElevated: '#2a3348',
      colorText: '#bfbfbf',
      colorTextHeading: '#e5f4ff',
      colorTextSecondary: '#999999',
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      colorTextQuaternary: '#8a93a6',
      colorBorder: 'rgba(92, 127, 153, 0.32)',
      colorBorderSecondary: 'rgba(92, 127, 153, 0.2)',
      colorSplit: 'rgba(92, 127, 153, 0.16)',
      borderRadius: 6,
    },
  },
  background: { url: '/bg/3-heavensward.jpg', brightness: 70, blur: 0 },
  cards: { alpha: 100, blur: 0 },
}
