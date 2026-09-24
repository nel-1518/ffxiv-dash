import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 暗影（Shadowbringers）。
 *
 * 色值取自官方专题站 <https://jp.finalfantasyxiv.com/shadowbringers/> 的样式表，
 * 是"近黑底 + 紫罗兰"的三层结构：区块底 `#20202e` / 面板 `#282640` / 导航 `#272729`，
 * 主紫 `#5047b2`（实心按钮底色）、标题亮紫罗兰 `#968cff`、选中态淡紫 `#a299ff`。
 *
 * ⚠️ 卡片另照首页 `.new_content__list` 做（半透明黑底 + 悬浮紫渐变 + 紫罗兰强调色），
 * 见 `theme.css`。
 */
export const shadowbringersSpec: ThemeSpec = {
  key: 'shadowbringers',
  label: '暗影',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#a79dff',
      colorInfo: '#a299ff',
      colorLink: '#a299ff',
      colorWarning: '#d9a44e',
      colorError: '#ff6b8f',
      colorBgLayout: '#0f0d15',
      colorBgContainer: '#282640',
      colorBgElevated: '#302d40',
      colorText: '#cccccc',
      colorTextHeading: '#ffffff',
      colorTextSecondary: '#999999',
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      colorTextQuaternary: '#6b6880',
      colorBorder: 'rgba(150, 140, 255, 0.22)',
      colorBorderSecondary: 'rgba(150, 140, 255, 0.14)',
      colorSplit: 'rgba(150, 140, 255, 0.12)',
      borderRadius: 8,
    },
  },
  background: { url: '/bg/5-shadowbringers.jpg', brightness: 35, blur: 1 },
  cards: { alpha: 60, blur: 1 },
}
