import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 晓月（Endwalker）。
 *
 * 色值取自官方专题站 <https://na.finalfantasyxiv.com/endwalker/> 的计算样式与样式表：
 * 冷黑底 `#18181a` + 月光白标题 `#f0f0f0` + 灰紫发丝边 `#bcbccc`；
 * 站点真正的签名是 `.endwalker-btn` 上那支三色渐变
 * `#3d4d99 → #3689b3 → #cc7a29`（蓝紫 / 青 / 琥珀）—— 只取它的色相方向：
 * 主色是靛蓝紫、链接与警告取琥珀端，中间的青端不用（与银海的冰蓝撞色）。
 *
 * ⚠️ 卡片是**亮色**（与页面、顶栏的暗色分三层），卡内文字在 `theme.css` 里整体翻深色，
 * 所以这里看到 `colorBgContainer` 是深色并不矛盾 —— 那是弹窗等暗处用的。
 */
export const endwalkerSpec: ThemeSpec = {
  key: 'endwalker',
  label: '晓月',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#9aa8ff',
      colorInfo: '#9aa8ff',
      colorLink: '#d9a05c',
      colorWarning: '#cc7a29',
      colorError: '#ff7a90',
      colorBgLayout: '#18181a',
      colorBgContainer: '#1f2126',
      colorBgElevated: '#26282e',
      colorText: '#cccccc',
      colorTextHeading: '#f0f0f0',
      colorTextSecondary: '#999999',
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      colorTextQuaternary: '#6e7180',
      colorBorder: 'rgba(188, 188, 204, 0.22)',
      colorBorderSecondary: 'rgba(188, 188, 204, 0.14)',
      colorSplit: 'rgba(188, 188, 204, 0.12)',
      borderRadius: 8,
    },
  },
  background: { url: '/bg/6-endwalker.jpg', brightness: 75, blur: 1 },
  cards: { alpha: 90, blur: 0 },
}
