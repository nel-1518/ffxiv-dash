/*
 * dayjs 的语言包必须显式注册（副作用导入）。
 * antd 的 ConfigProvider 只带界面文案（今天 / 本月…），而日历面板里的星期与月份名
 * 来自 dayjs 自己的 locale 数据；少这一行，DatePicker 面板会是 "Su Mo Tu … / Oct"，
 * 底部按钮却是中文，两种语言混在一张面板上。
 */
import 'dayjs/locale/zh-cn'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installBuiltinWidgets } from './features/widgets/builtins/index.ts'
import { loadAppearance, resolveTheme } from './core/appearance/store.ts'
import { initSystemFollow } from './app/themes/appearance-sync.ts'
import { initAppearanceImage } from './core/appearance/image-store.ts'

/**
 * 在渲染之前注册内置组件。
 *
 * 必须早于 React 渲染：看板 store 在**首次渲染时**惰性读取 localStorage
 * （见 state/board-store.ts），那一刻需要用注册表归一化各组件的配置，
 * 因此注册表要先装配好。
 */
/*
 * 全局兜底：未处理的 Promise 拒绝只记录、不打断。
 * 各 widget 的请求自己有 catch（失败态呈现在卡面上），这一层接住漏网的
 * 异步抛错（缓存序列化、IndexedDB 回调等），避免它们无声消失。
 * 与渲染错误边界（app/ErrorBoundary.tsx）各管一头：那边管渲染期，这边管渲染期之外。
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('[ffxiv-dash] 未处理的 Promise 拒绝', event.reason)
})

installBuiltinWidgets()

/**
 * 外观偏好（色调 + 两个槽位 + 逐主题档案）也要早于渲染读取：它是同步的 localStorage，
 * 首屏就能用上。上传的图片存在 IndexedDB 里、只能异步读，因此单独触发一次、不 await ——
 * 颜色与外链背景立刻可见，上传图晚一两帧套上。
 *
 * `initSystemFollow()` 必须在 `loadAppearance()` 之后调：前者注册 `prefers-color-scheme`
 * 监听并把系统色调写进 store，后者只负责读一次（两个来源是同一个，所以顺序只是为了好读）。
 */
loadAppearance()
initSystemFollow()
initAppearanceImage()

/*
 * 主题的 `data-dash-theme` 属性同样要赶在首屏之前挂到 <html> 上，
 * 否则刷新时会先按默认主题画一帧再跳到目标主题（闪一下）。
 * 挂的是**解析后**的生效主题 —— 跟随系统时就是上面那步定下来的那套。
 * 之后的切换由 AppProviders 里的 effect 负责。
 */
document.documentElement.dataset.dashTheme = resolveTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
