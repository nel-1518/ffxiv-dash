import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 银海（Evercold）。
 *
 * 色值取自官方专题站 <https://na.finalfantasyxiv.com/evercold/> 的计算样式：
 * 近黑的冷底 `#18191a` + 冰蓝 `#73bfe6` + 正文 `#cccccc` + 钢蓝标题 `#6b83b3`。
 *
 * ⚠️ 卡片是**亮色玻璃**（站点的「信息卡」），卡内文字整体翻深色（见 `theme.css`）；
 * 顶栏另走一条半透明白玻璃 + 白字的路。
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
  background: { url: '/bg/8-evercold.webp', brightness: 60, blur: 1 },
  cards: { alpha: 85, blur: 1 },
}
