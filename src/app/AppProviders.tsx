import { useEffect } from 'react'
import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BoardPersistence } from '../state/board-persistence.tsx'
import { AutoOpenLinks } from './AutoOpenLinks.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { createAppTheme } from './theme-config.ts'
import { useTheme } from '../core/appearance/hooks.ts'
import type { ReactNode } from 'react'

/**
 * 全局 Provider 装配，顺序有意义：
 * ConfigProvider 在 App 之上（App 才能消费 Design Token）；BoardPersistence / AutoOpenLinks /
 * ErrorBoundary 在 App 之内（要用 App.useApp() 的提示）。ErrorBoundary 包住整个子树，
 * 渲染错误降级为错误页而非白屏（数据在 localStorage，见 app/ErrorBoundary.tsx）。
 *
 * 看板状态在模块级 store（state/board-store.ts），消费侧按需订阅，不需要 Provider；
 * BoardPersistence 只负责落盘、AutoOpenLinks 只负责启动跳转，都不向下传数据。
 */
export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  const themeKey = useTheme()

  /*
   * 主题 CSS 变量定义在 `[data-dash-theme='<key>']` 上，属性必须挂到 <html>：
   * 这样 html/body 与 portal 弹窗都能命中。main.tsx 已在渲染前设过一次（避免闪默认配色），
   * 这里负责后续切换。
   */
  useEffect(() => {
    document.documentElement.dataset.dashTheme = themeKey
  }, [themeKey])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={createAppTheme(themeKey)}
      // 表单校验的默认文案走 antd 中文包，这里只补两条项目内更常用的
      form={{
        validateMessages: {
          required: '请填写${label}',
        },
      }}
    >
      <App message={{ maxCount: 3, duration: 2 }}>
        {/* 不给 resetKey：整站崩溃没有"改完自动重试"的单一信号，重试交给按钮 */}
        <ErrorBoundary>
          <BoardPersistence>{children}</BoardPersistence>
          {/* 每天首次进入页面自动打开设置里的链接（渲染 null，纯副作用） */}
          <AutoOpenLinks />
        </ErrorBoundary>
      </App>
    </ConfigProvider>
  )
}
