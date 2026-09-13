import { theme as antdTheme } from 'antd'
import type { ThemeSpec } from '../types.ts'
import './theme.css'

/**
 * 暗影（Shadowbringers）。
 *
 * 取色自官方专题站 <https://jp.finalfantasyxiv.com/shadowbringers/> 的计算样式，
 * 以及它加载的那几份样式表（`lds-img.finalfantasyxiv.com` 的 `promo/h/` 目录下，
 * 下载成文件后可以全文搜色值）里的原始色值。
 * 站点是**近黑底 + 紫罗兰**的三层结构（实测）：
 * 区块底 `#20202e` / 面板 `#282640` / 导航 `#272729`，主紫 `#5047b2`（实心按钮底色），
 * 标题亮紫罗兰 `#968cff`，选中态淡紫 `#a299ff`，提示洋红 `#bf3054`，正文 `#cccccc`。
 *
 * 卡片另参考首页那一排 `.new_content__list`，见 `theme.css` 顶部的说明。
 */
export const shadowbringersSpec: ThemeSpec = {
  key: 'shadowbringers',
  label: '暗影',
  antd: {
    // 近黑底靠 darkAlgorithm 派生整套中性色，再按站点色值覆盖关键项
    algorithm: antdTheme.darkAlgorithm,
    token: {
      /*
       * 亮紫罗兰（站点 `#968cff`，用于区块标题与 `.new_content__list` 的 "LEARN MORE"）。
       * 种子渲染后会变暗一档（同银海/金曦/晓月）：
       * 目标是渲染后 ≈ `#918ae0`，压在紫黑卡上约 4.5:1。
       */
      colorPrimary: '#a79dff',
      /* 淡紫 —— 站点专门用它标记"选中/可点"（导航选中态、弹窗菜单选中项） */
      colorInfo: '#a299ff',
      colorLink: '#a299ff',
      /* 站点没有明显的警告色，取那两支古铜金 `#b38c3e` 提亮一档 */
      colorWarning: '#d9a44e',
      /*
       * 洋红（站点 `.notes` / `.product__lead span` 的提示色 `#bf3054`）。
       * 直接用会渲染成 `#a62a49`，压在紫黑卡上只有 2.6:1，往亮里提一档抵消那次变暗。
       */
      colorError: '#ff6b8f',
      colorBgLayout: '#0f0d15',
      /* 卡片的不透明底色：直接取站点的面板色 `#282640` */
      colorBgContainer: '#282640',
      colorBgElevated: '#302d40',
      colorText: '#cccccc',
      colorTextHeading: '#ffffff',
      colorTextSecondary: '#999999',
      /*
       * ⚠️ `type="secondary"` 的副标题读的是 **description** 而不是 secondary：
       * 深色算法默认给 `rgba(255,255,255,.45)`，在紫黑卡上只有 4.3:1（12px 小字偏弱），
       * 抬到 .6 ≈ 6.6:1。
       */
      colorTextDescription: 'rgba(255, 255, 255, 0.6)',
      /* 导航未激活态的紫灰（站点 `#5d5d66`），提亮一档用在最弱一级文字上 */
      colorTextQuaternary: '#6b6880',
      /* 紫罗兰发丝边（强度提到能看清；站点的 `rgba(255,255,255,.2)` 只用在分区上边线） */
      colorBorder: 'rgba(150, 140, 255, 0.22)',
      colorBorderSecondary: 'rgba(150, 140, 255, 0.14)',
      colorSplit: 'rgba(150, 140, 255, 0.12)',
      /* 站点自己的圆角就是 8px（实心按钮 400×48、面板、tab 都是它） */
      borderRadius: 8,
    },
  },
  background: {
    url: '/bg/5-shadowbringers.webp',
    brightness: 35,
    blur: 1,
  },
  cards: { alpha: 50, blur: 1 },
}
