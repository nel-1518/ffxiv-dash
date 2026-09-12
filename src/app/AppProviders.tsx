import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BoardProvider } from '../state/BoardProvider.tsx'
import { createAppTheme } from './theme-config.ts'
import type { ReactNode } from 'react'

/**
 * 全局 Provider 装配。
 *
 * 顺序很重要：ConfigProvider 必须在 App 之上，App 才能消费 Design Token；
 * BoardProvider 在 App 之内，它要用 App.useApp() 的 message 提示保存失败。
 */
export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={createAppTheme()}
      // 表单校验的默认文案走 antd 中文包，这里只补两条项目内更常用的
      form={{
        validateMessages: {
          required: '请填写${label}',
        },
      }}
    >
      <App message={{ maxCount: 3, duration: 2 }}>
        <BoardProvider>{children}</BoardProvider>
      </App>
    </ConfigProvider>
  )
}
