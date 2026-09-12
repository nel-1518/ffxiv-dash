import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installBuiltinWidgets } from './features/widgets/builtins/index.ts'
import { loadAppearance } from './core/appearance/store.ts'
import { initAppearanceImage } from './core/appearance/image-store.ts'
import { loadTheme } from './core/theme-preference.ts'

/**
 * 在渲染之前注册内置组件。
 *
 * 必须早于 React 渲染：BoardProvider 首次读取 localStorage 时需要用注册表
 * 归一化各组件配置，因此注册表要先装配好。
 */
installBuiltinWidgets()

/**
 * 外观偏好（背景）也要早于渲染读取：它是同步的 localStorage，首屏就能用上。
 * 上传的图片存在 IndexedDB 里、只能异步读，因此单独触发一次、不 await ——
 * 颜色与外链背景立刻可见，上传图晚一两帧套上。
 */
loadAppearance()
initAppearanceImage()

/*
 * 主题的 `data-dash-theme` 属性同样要赶在首屏之前挂到 <html> 上，
 * 否则刷新时会先按默认主题画一帧再跳到目标主题（闪一下）。
 * 之后的切换由 AppProviders 里的 effect 负责。
 */
document.documentElement.dataset.dashTheme = loadTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
