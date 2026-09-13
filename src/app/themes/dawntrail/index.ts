import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 金曦（Dawntrail）。
 *
 * 取色自官方专题站 <https://na.finalfantasyxiv.com/dawntrail/> 的计算样式采样（实测）：
 * 暖黑底 `#1a1918`、亮金标题 `#ffd966`、古金链接 `#d9bf57`、暖灰次级文字 `#66645e`、
 * 橙 `#e57e17` 与绯红 `#e52e4d` 作点缀；分区靠一条**淡金发丝边** `rgba(255,244,128,.1)`
 * 划界，而不是实线。
 *
 * 只取颜色/边框/阴影，站点里的图片与视频一概不用；背景用本地那张
 * `public/bg/7-dawntrail.webp`（1920×1080，均色 `#7d7255`、平均亮度 .448，
 * 主色块是暖深棕 `#2b1810` / `#17110b` / `#332717`）。
 */
export const dawntrailSpec: ThemeSpec = {
  key: 'dawntrail',
  label: '金曦',
  antd: {
    // 深色底靠 darkAlgorithm 派生整套中性色，再按站点色值覆盖关键项
    algorithm: antdTheme.darkAlgorithm,
    token: {
      // 亮金：站点 h3 就是这个色。⚠️ 渲染出来会比种子深一档（实测 #dcbb5a，同银海那套规矩）
      colorPrimary: '#ffd966',
      colorInfo: '#d9bf57',
      colorLink: '#d9bf57',
      colorWarning: '#e57e17',
      /*
       * 绯红（站点点缀色 `#e52e4d`）：直接用会渲染成 `#c62a44`，压在暖棕卡上只有 2.8:1
       * （删除图标看不清），所以把种子往亮里提一档抵消那次变暗。
       */
      colorError: '#ff6b7d',
      colorBgLayout: '#1a1918',
      colorBgContainer: '#242019',
      colorBgElevated: '#2c2720',
      colorText: '#cccccc',
      colorTextHeading: '#f0ece4',
      colorTextSecondary: '#999999',
      /*
       * ⚠️ `type="secondary"` 的副标题读的是 **description** 而不是 secondary：
       * 深色算法默认给 `rgba(255,255,255,.45)`，在暖棕卡上只有 4.3:1（12px 小字偏弱），抬到 .6 ≈ 6.6:1。
       */
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      colorTextQuaternary: '#7a7a7a',
      // 淡金发丝边（站点是 .1，这里提到能看清的强度）；导航卡的描边也吃这一档
      colorBorder: 'rgba(255, 244, 128, 0.22)',
      colorBorderSecondary: 'rgba(255, 244, 128, 0.14)',
      colorSplit: 'rgba(255, 244, 128, 0.12)',
      borderRadius: 10,
    },
  },
  background: {
    url: '/bg/7-dawntrail.webp',
    // 图本身是暖深棕底（均色 #7d7255、亮度 .448），压一档让卡上的字稳下来
    brightness: 70,
    blur: 1,
  },
  /*
   * 卡片与页面同属暖深色系（站点自己的面板就是 `rgba(26,16,5,.9)` 的暖棕黑）
   */
  cards: { alpha: 85, blur: 1 },
}
