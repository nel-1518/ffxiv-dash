import { useEffect } from 'react'
import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BoardPersistence } from '../state/board-persistence.tsx'
import { AutoOpenLinks } from './AutoOpenLinks.tsx'
import { createAppTheme } from './theme-config.ts'
import { useTheme } from '../core/appearance/hooks.ts'
import type { ReactNode } from 'react'

/**
 * 全局 Provider 装配。
 *
 * 顺序很重要：ConfigProvider 必须在 App 之上，App 才能消费 Design Token；
 * BoardPersistence 与 AutoOpenLinks 在 App 之内，它们要用 App.useApp() 的提示。
 *
 * 看板状态住在 `state/board-store.ts` 这个模块级 store 里，消费侧各自按需订阅
 * （见 `state/hooks.ts`），不需要 Provider 包着。
 * 留在树里的 `BoardPersistence` 只负责落盘、`AutoOpenLinks` 只负责页面启动时的「跳转」，
 * 两者都不向下传任何数据。
 */
export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  const themeKey = useTheme()

  /*
   * 主题的 CSS 变量按 `[data-dash-theme='<key>']` 定义在样式表里，属性要挂在
   * `<html>` 上 —— 这样 `html/body` 与 portal 到 body 的弹窗都能命中
   * （`.dash-shell` 之外的元素拿不到挂在壳子上的变量）。
   * `main.tsx` 已在渲染前设过一次（避免刷新时闪一下默认配色），这里负责后续切换。
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
        <BoardPersistence>{children}</BoardPersistence>
        {/* 「跳转」：每天首次进入页面时自动打开设置里填的链接（渲染 null，纯副作用） */}
        <AutoOpenLinks />
      </App>
    </ConfigProvider>
  )
}
