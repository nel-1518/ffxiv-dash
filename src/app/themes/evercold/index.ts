import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 银海（Evercold）。
 *
 * 取色自官方专题站 <https://na.finalfantasyxiv.com/evercold/> 的计算样式（实测采样）：
 * 近黑的冷底 `#18191a`、冰蓝强调 `#73bfe6`、正文 `#cccccc`、钢蓝标题 `#6b83b3`、
 * 金色点缀 `#f5d349`；分区靠"上缘亮线 + 柔和辉光"而不是实边框。
 *
 * 只取颜色/边框/阴影，站点里的图片与视频一概不用；背景用本地那张
 * `public/bg/8-evercold.webp`（整体是偏暗的蓝灰冰原，与深色底正好搭）。
 */
export const evercoldSpec: ThemeSpec = {
  key: 'evercold',
  label: '银海',
  antd: {
    // 深色底靠 darkAlgorithm 派生整套中性色，再按站点色值覆盖关键项
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
  background: {
    url: '/bg/8-evercold.webp',
    // 站点本身就是压暗的深色基调：亮度压到 60%（= 旧的「蒙版 40%」，两者逐像素等价）
    brightness: 60,
    blur: 1,
  },
  // 浅色玻璃压在冰原图上：要透出一点底（alpha < 100），又不能糊到看不清卡里的字
  cards: { alpha: 80, blur: 1 },
}
