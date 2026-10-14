import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
// 亮卡翻色的共享令牌块（本主题只补 --dash-lightcard-* 取值，见 theme.css）
import '../light-card.css'
import './theme.css'

/**
 * 晓月（Endwalker）。取色见 `docs/themes.md`（来源：官方专题站计算样式与样式表：冷黑底 + 月光白标题 + 灰紫发丝边）。
 * 签名的三色渐变 `#3d4d99 → #3689b3 → #cc7a29` 只取色相方向：主色靛蓝紫、链接与警告取琥珀端，中间青端不用（与银海冰蓝撞色）。
 * ⚠️ 卡片是亮色（与页面、顶栏的暗色分三层），卡内文字在 `theme.css` 整体翻深色；
 * `colorBgContainer` 是深色不矛盾——那是弹窗等暗处用的。
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
