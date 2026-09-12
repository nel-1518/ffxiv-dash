import { Layout } from 'antd'
import { DashboardPage } from '../views/DashboardPage.tsx'

/**
 * 应用外壳。
 *
 * 当前只有一个视图（仪表盘）。将来要接路由时，把 DashboardPage 换成
 * 路由出口即可，其余布局与 Provider 不用动。
 *
 * 背景不在这里写死：Layout 默认就会用主题的 colorBgLayout（浅灰），
 * 与 body 的兜底背景一致，因此卡片（白色）能明显区分出来。
 */
export function AppShell(): React.ReactNode {
  return (
    <Layout style={{ minHeight: '100svh' }}>
      <Layout.Content>
        <div className="dash-container">
          <DashboardPage />
        </div>
      </Layout.Content>
    </Layout>
  )
}
