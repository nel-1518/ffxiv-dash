import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 晓月（Endwalker）。
 *
 * 取色自官方专题站 <https://na.finalfantasyxiv.com/endwalker/> 的计算样式，
 * 以及站点那三份样式表（`lds-img.finalfantasyxiv.com/promo/h/…css`）里的原始色值：
 * 冷黑底 `#18181a`、月光白标题 `#f0f0f0`、正文 `#cccccc`、导航灰紫 `#5d5d66`、
 * 发丝描边 `#bcbccc`（站点按钮一律是 `box-shadow: 0 0 0 1px #bcbccc inset`）、
 * 古铜金 `#b38c3e`、提示绯红 `#f03050`。
 *
 * 站点真正的"签名"是那支**三色渐变** —— `.endwalker-btn::before` 与 `.endwalker-bt_media` 上的
 * `linear-gradient(to right, #3d4d99 0%, #3689b3 50%, #cc7a29 100%)`（蓝紫 → 青 → 琥珀）。
 * 但它不能直接当主色：靛蓝端 `#3d4d99` 压在我们的卡片底上只有 1.8:1，整支都偏暗。
 * 所以只取它的**色相方向**再往亮处提：主色是靛蓝紫，琥珀端给链接与警告，
 * 中间的青端不采用 —— 它和银海的冰蓝 `#73bfe6` 是同一片色域，用了会撞脸。
 *
 * 只取颜色/边框/阴影，站点里的图片与视频一概不用；背景用本地那张
 * `public/bg/6-endwalker.webp`（2500×1312，青蓝天空 + 月亮，均色 `#8b989e`）。
 *
 * ⚠️ 层次是"暗页面 + 暗顶栏 + **亮卡片**"（八套主题里只有它和银海是亮卡）：
 * 下面的令牌只管页面、顶栏、弹窗这些**暗处**；卡片的底色与卡内文字在 `theme.css` 里
 * 另起一套（冷白玻璃 + 浅色岛）。所以这里看到 `colorBgContainer` 是深色并不矛盾。
 */
export const endwalkerSpec: ThemeSpec = {
  key: 'endwalker',
  label: '晓月',
  antd: {
    // 深色底靠 darkAlgorithm 派生整套中性色，再按站点色值覆盖关键项
    algorithm: antdTheme.darkAlgorithm,
    token: {
      /*
       * 靛蓝紫（站点渐变起点 `#3d4d99` 的色相）。种子渲染后会变暗一档（同银海/金曦），
       * 因此往亮里给：目标是渲染后 ≈ `#8492e8`，压在冷黑卡上约 4.7:1。
       */
      colorPrimary: '#9aa8ff',
      colorInfo: '#9aa8ff',
      /*
       * 链接与警告取渐变的琥珀端（站点原值 `#cc7a29`）：冷底上跳得出来，
       * 也补上站点那组"冷紫 ↔ 暖橙"的对比。
       * 链接色必须往亮提一档才够读 —— 原值压在卡上只有 3.4:1（同金曦把绯红提亮的理由）。
       */
      colorLink: '#d9a05c',
      colorWarning: '#cc7a29',
      /*
       * 绯红（站点 `.notes` 的 `#f03050`）：直接用会渲染成 `#d02a46`，
       * 压在冷黑卡上只有 2.7:1（删除图标看不清），往亮里提一档抵消那次变暗。
       */
      colorError: '#ff7a90',
      colorBgLayout: '#18181a',
      colorBgContainer: '#1f2126',
      colorBgElevated: '#26282e',
      colorText: '#cccccc',
      colorTextHeading: '#f0f0f0',
      colorTextSecondary: '#999999',
      /*
       * ⚠️ `type="secondary"` 的副标题读的是 **description** 而不是 secondary：
       * 深色算法默认给 `rgba(255,255,255,.45)`，在冷黑卡上只有 4.3:1（12px 小字偏弱），
       * 抬到 .6 ≈ 6.6:1。
       */
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      /* 站点导航未激活态就是灰紫 `#5d5d66`，提亮一档用在最弱一级文字上 */
      colorTextQuaternary: '#6e7180',
      /* 发丝描边取自站点按钮/导航的 `#bcbccc`，压到能看清的强度 */
      colorBorder: 'rgba(188, 188, 204, 0.22)',
      colorBorderSecondary: 'rgba(188, 188, 204, 0.14)',
      colorSplit: 'rgba(188, 188, 204, 0.12)',
      /* 站点自己的圆角就是 8px（`endwalker-xiv_link li a`），比金曦/银海都利落 */
      borderRadius: 8,
    },
  },
  background: {
    url: '/bg/6-endwalker.webp',
    brightness: 75,
    blur: 1,
  },
  cards: { alpha: 90, blur: 0 },
}
