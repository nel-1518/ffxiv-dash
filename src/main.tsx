/*
 * dayjs 语言包必须显式注册（副作用导入）：antd 的 ConfigProvider 只带界面文案，
 * DatePicker 面板的星期与月份名来自 dayjs 自己的 locale，缺了这一行面板会中英混杂。
 */
import 'dayjs/locale/zh-cn'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installBuiltinWidgets } from './features/widgets/builtins/index.ts'
import { loadAppearance, resolveTheme } from './core/appearance/store.ts'
import { initSystemFollow } from './app/themes/appearance-sync.ts'
import { initAppearanceImage } from './core/appearance/image-store.ts'

/*
 * 全局兜底：未处理的 Promise 拒绝只记录、不打断。
 * 各 widget 的请求自己有 catch，这一层只接住漏网的异步抛错（缓存序列化、IndexedDB 回调等）；
 * 渲染期错误由 app/ErrorBoundary.tsx 负责。
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('[ffxiv-dash] 未处理的 Promise 拒绝', event.reason)
})

/*
 * 必须早于首次渲染注册：看板 store 在首次渲染时惰性读取 localStorage
 * （见 state/board-store.ts），那一刻需要用注册表归一化各组件配置。
 */
installBuiltinWidgets()

/*
 * 外观偏好同样早于渲染读取：localStorage 是同步的，首屏即可用；
 * 上传图存在 IndexedDB 只能异步读，单独触发、不 await，颜色与外链背景先可见，上传图晚一两帧套上。
 */
loadAppearance()
initSystemFollow()
initAppearanceImage()

/*
 * `data-dash-theme` 要赶在首屏之前挂到 <html> 上，否则刷新时会先按默认主题画一帧再跳变。
 * 挂的是解析后的生效主题；之后的切换由 AppProviders 里的 effect 负责。
 */
document.documentElement.dataset.dashTheme = resolveTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
