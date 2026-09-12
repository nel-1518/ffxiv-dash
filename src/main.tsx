import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installBuiltinWidgets } from './features/widgets/builtins/index.ts'

/**
 * 在渲染之前注册内置组件。
 *
 * 必须早于 React 渲染：BoardProvider 首次读取 localStorage 时需要用注册表
 * 归一化各组件配置，因此注册表要先装配好。
 */
installBuiltinWidgets()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
