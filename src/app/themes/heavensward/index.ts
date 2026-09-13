import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 苍穹（Heavensward）。
 *
 * 取色自官方专题站 <https://na.finalfantasyxiv.com/heavensward/>
 * 站点是老版官网的「近黑底 + 冰蓝」：主内容区 `#141414`（+ 一张 repeat-y 的背景图）
 * 上的正文是 `#bfbfbf`；表头是深蓝黑 `#1f2633` + 白字；面板描边是深蓝 `#324366`；
 * **标题是冰蓝白 `#e5f4ff`**、导航 hover/选中是淡冰蓝 `#cceaff`、新闻与子导航的文字是蓝灰 `#5c7f99`；
 * 提示文字用玫红 `#bf2659`（带 1px 同色描边 + 圆角 6）；次级标题是暖灰金 `#bfb38f`。
 */
export const heavenswardSpec: ThemeSpec = {
  key: 'heavensward',
  label: '苍穹',
  antd: {
    // 近黑底靠 darkAlgorithm 派生整套中性色，再按站点色值覆盖关键项
    algorithm: antdTheme.darkAlgorithm,
    token: {
      /*
       * 冰蓝（站点导航的淡冰蓝 `#cceaff` 与蓝灰 `#5c7f99` 之间那一档）。
       * 两端的原色都不适合当主色：`#cceaff` 太白（白字压上去只剩 1.4:1），
       * `#5c7f99` 偏灰。取色相往亮里提一档（种子渲染后会暗一档，同其余几套）。
       */
      colorPrimary: '#9fd2ef',
      /* 链接用站点那个**导航 hover / 选中**的淡冰蓝 —— 它就是站点里"强调文字"的色 */
      colorInfo: '#cceaff',
      colorLink: '#cceaff',
      /* 站点金系里频率最高的那支 `#bfa34c` 提亮一档 */
      colorWarning: '#d9b85e',
      /* 站点提示文字的玫红 `#bf2659`：直接用会渲染得更深，卡上只有 2:1 上下，往亮里提 */
      colorError: '#f05a8a',
      /* 页面底：站点主内容区就是 `#141414`，这里再往冷里偏一档 */
      colorBgLayout: '#12141a',
      /* 卡片的不透明底色：直接取站点表头那个深蓝黑 `#1f2633` */
      colorBgContainer: '#1f2633',
      colorBgElevated: '#2a3348',
      /* 站点正文就是 `#bfbfbf`（压在 `#141414` 上） */
      colorText: '#bfbfbf',
      /* ⚠️ 标题色是这套主题的签名：站点的 h3/h4 是冰蓝白 `#e5f4ff` */
      colorTextHeading: '#e5f4ff',
      colorTextSecondary: '#999999',
      /*
       * ⚠️ `type="secondary"` 的副标题读的是 **description** 而不是 secondary：
       * 深色算法默认给 `rgba(255,255,255,.45)`，在深蓝卡上只有 4.3:1（12px 小字偏弱），
       * 抬到 .6 ≈ 6.6:1。
       */
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      /* 站点子导航的蓝灰 `#5c7f99` 提亮一档，用在最弱一级文字上 */
      colorTextQuaternary: '#8a93a6',
      /* 蓝灰发丝边（站点面板用的是深蓝实线 `#324366`，压到发丝强度） */
      colorBorder: 'rgba(92, 127, 153, 0.32)',
      colorBorderSecondary: 'rgba(92, 127, 153, 0.2)',
      colorSplit: 'rgba(92, 127, 153, 0.16)',
      /* 站点自己的圆角：提示框 6px、快速面框 10px */
      borderRadius: 6,
    },
  },
  background: {
    url: '/bg/3-heavensward.webp',
    brightness: 70,
    blur: 0,
  },
  cards: { alpha: 100, blur: 0 },
}
