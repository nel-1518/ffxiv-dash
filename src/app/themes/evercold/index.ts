import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
// 亮卡翻色的共享令牌块（本主题只补 --dash-lightcard-* 取值，见 theme.css）
import '../light-card.css'
import './theme.css'

/**
 * 银海（Evercold）。取色见 `docs/themes.md`（来源：官方专题站计算样式：近黑冷底 + 冰蓝 + 钢蓝标题）。
 * ⚠️ 卡片是亮色玻璃（站点的「信息卡」），卡内文字整体翻深色（见 `theme.css`）；顶栏另走半透明白玻璃 + 白字。
 */
export const evercoldSpec: ThemeSpec = {
  key: 'evercold',
  label: '银海',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#73bfe6',
      colorInfo: '#73bfe6',
      colorLink: '#73bfe6',
      colorWarning: '#d9bf57',
      colorBgLayout: '#18191a',
      colorBgContainer: '#22262b',
      colorBgElevated: '#2a2f35',
      colorText: '#cccccc',
      colorTextHeading: '#ffffff',
      colorTextSecondary: '#999999',
      colorTextQuaternary: '#7a7a7a',
      colorBorder: 'rgba(255, 255, 255, 0.18)',
      colorBorderSecondary: 'rgba(255, 255, 255, 0.12)',
      colorSplit: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 8,
    },
  },
  background: { url: '/bg/8-evercold.jpg', brightness: 60, blur: 1 },
  cards: { alpha: 85, blur: 1 },
}
