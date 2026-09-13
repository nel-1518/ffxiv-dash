import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 红莲（Stormblood）。
 *
 * 取色自官方专题站 <https://na.finalfantasyxiv.com/stormblood/> 的道面样式表
 * 站点是**深红打底**：导航条 `.menu`、内容区 `.content`、底部固定条全是
 * `#801111` + 一层纹理图；浮层/弹窗是更深的 `#660a0a`；强调块（表头）是朱红 `#990f0f`，
 * 而**压在红底上的文字用金**：`#e5d473`（表头）、`#ffcc33`（注释）、`#b38c3e`（古铜）。
 * 正文 `#f5f5f5`、次级 `#cccccc` / `#999999`、内容面板底也是 `#f5f5f5`。
 *
 */
export const stormbloodSpec: ThemeSpec = {
  key: 'stormblood',
  label: '红莲',
  antd: {
    // 深红底靠 darkAlgorithm 派生整套中性色，再按站点色值覆盖关键项
    algorithm: antdTheme.darkAlgorithm,
    token: {
      /*
       * 朱红（站点强调块 `#990f0f` 的色相）。
       * 但那个红太深：压在深红卡上只有 1.7:1，连自己的底都压不过。
       * 所以只取色相方向、往亮里提（种子渲染后会暗一档，同银海/金曦/晓月）。
       * ⚠️ 实测：种子 `#ff7b7b` 渲染成 `#dc6c6c`，在深红卡上只有 2.65:1（低于非文本的 3:1），
       * 再提一档到 `#ff8f8f`（渲染 ≈ `#de7c7c`，约 3.0:1）—— 它主要用在 accent 竖条、
       * primary 按钮底这类实心图形上，而"可点的文字"一律走金色的 `colorLink`。
       */
      colorPrimary: '#da4646',
      /* 链接与信息色取站点的金 —— 那是"压在红底上"的可读色，实测约 10:1 */
      colorInfo: '#e5d473',
      colorLink: '#e5d473',
      /* 站点 `.content__list li.notes` 的亮金 */
      colorWarning: '#ffcc33',
      /* 站点 `.product__system_requirements` 里那支亮红 `#cc2929` 提亮一档 */
      colorError: '#ff6b6b',
      /* 页面底：站点是 `#801111`，这里压深一档 —— 它大面积可见，满屏凨艳的红会晃眼 */
      colorBgLayout: '#6f1111',
      /* 弹窗与搜索卡的底：比页面再深一档的纯色 `#6F0B0B` */
      colorBgContainer: '#5e1111',
      colorBgElevated: '#5e1111',
      colorText: '#f5f5f5',
      colorTextHeading: '#ffffff',
      colorTextSecondary: '#cccccc',
      /*
       * 深色算法默认给 `rgba(255,255,255,.45)`，在深红卡上只有 4.3:1（12px 小字偏弱），
       * 抬到 .62 ≈ 6.8:1。
       */
      colorTextDescription: 'rgba(255, 255, 255, 0.62)',
      colorTextQuaternary: '#a89a9a',
      /* 金色发丝边（红 + 金是站点成套的配色；导航条的上缘也是 `rgba(255,255,255,.1)` 亮线） */
      colorBorder: 'rgba(229, 212, 115, 0.22)',
      colorBorderSecondary: 'rgba(229, 212, 115, 0.14)',
      colorSplit: 'rgba(229, 212, 115, 0.12)',
      /* 站点自己的圆角就是 4px（内容面板、弹窗都是它）—— 方正一点，符合东方/阿拉米格的调性 */
      borderRadius: 4,
    },
  },
  background: {
    url: '/bg/4-stormblood.webp',
    brightness: 70,
    blur: 0,
  },
  cards: { alpha: 100, blur: 0 },
}
