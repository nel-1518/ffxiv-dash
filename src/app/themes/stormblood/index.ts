import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 红莲（Stormblood）。
 *
 * 色值取自官方专题站（老版官网）的样式表，是"深红打底 + 金"的成套配色：
 * 区块/导航底 `#801111` + 浮层 `#660a0a` + 强调块 `#990f0f`，
 * 压在红底上的文字用金 `#e5d473` / `#ffcc33`。
 *
 * ⚠️ 红色主色压在深红卡上天然对比不足，这里让主色只服务实心图形、
 * 可点的文字一律走金色的 `colorLink`（见 `docs/themes.md`）。
 */
export const stormbloodSpec: ThemeSpec = {
  key: 'stormblood',
  label: '红莲',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#da4646',
      colorInfo: '#e5d473',
      colorLink: '#e5d473',
      colorWarning: '#ffcc33',
      colorError: '#ff6b6b',
      colorBgLayout: '#6f1111',
      colorBgContainer: '#5e1111',
      colorBgElevated: '#5e1111',
      colorText: '#f5f5f5',
      colorTextHeading: '#ffffff',
      colorTextSecondary: '#cccccc',
      colorTextDescription: 'rgba(255, 255, 255, 0.62)',
      colorTextQuaternary: '#a89a9a',
      colorBorder: 'rgba(229, 212, 115, 0.22)',
      colorBorderSecondary: 'rgba(229, 212, 115, 0.14)',
      colorSplit: 'rgba(229, 212, 115, 0.12)',
      borderRadius: 4,
    },
  },
  background: { url: '/bg/4-stormblood.webp', brightness: 70, blur: 0 },
  cards: { alpha: 100, blur: 0 },
}
