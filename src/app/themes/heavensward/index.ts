import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 苍穹（Heavensward）。
 *
 * 色值取自官方专题站 <https://na.finalfantasyxiv.com/heavensward/> 的样式表：
 * 主内容区 `#141414` + 正文 `#bfbfbf` + 表头深蓝黑 `#1f2633` + 面板描边深蓝 `#324366`，
 * 标题是冰蓝白 `#e5f4ff`、导航 hover/选中是淡冰蓝 `#cceaff`、子导航蓝灰 `#5c7f99`。
 *
 * ⚠️ 官网模板里那个 `#73bfe6`（Lodestone 公共站的蓝）与左侧 `#e30613`（SE 品牌红）
 * 都不是本主题的色（见 `docs/themes.md`）。
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
  background: { url: '/bg/3-heavensward.webp', brightness: 70, blur: 0 },
  cards: { alpha: 100, blur: 0 },
}
