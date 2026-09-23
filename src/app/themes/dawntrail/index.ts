import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 金曦（Dawntrail）。
 *
 * 色值取自官方专题站 <https://na.finalfantasyxiv.com/dawntrail/> 的计算样式：
 * 暖黑底 `#1a1918` + 亮金 `#ffd966` + 古金 `#d9bf57` + 橙 `#e57e17`，
 * 分区靠一条淡金发丝边划界而不是实线。
 *
 * ⚠️ 站点上出现最多的那个蓝 `#73bfe6` 是官网模板 / Lodestone 公共站的色，不是本主题的 ——
 * 取色时都要先做这层甄别（见 `docs/themes.md`）。
 */
export const dawntrailSpec: ThemeSpec = {
  key: 'dawntrail',
  label: '金曦',
  antd: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#ffd966',
      colorInfo: '#d9bf57',
      colorLink: '#d9bf57',
      colorWarning: '#e57e17',
      colorError: '#ff6b7d',
      colorBgLayout: '#1a1918',
      colorBgContainer: '#242019',
      colorBgElevated: '#2c2720',
      colorText: '#cccccc',
      colorTextHeading: '#f0ece4',
      colorTextSecondary: '#999999',
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      colorTextQuaternary: '#7a7a7a',
      colorBorder: 'rgba(255, 244, 128, 0.22)',
      colorBorderSecondary: 'rgba(255, 244, 128, 0.14)',
      colorSplit: 'rgba(255, 244, 128, 0.12)',
      borderRadius: 10,
    },
  },
  background: { url: '/bg/7-dawntrail.jpg', brightness: 70, blur: 1 },
  cards: { alpha: 80, blur: 1 },
}
