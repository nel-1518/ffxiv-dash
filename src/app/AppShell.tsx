import { Layout } from 'antd'
import { DashboardPage } from '../views/DashboardPage.tsx'
import { useAppearance, useTheme } from '../core/appearance/hooks.ts'
import { getThemeSpec } from './themes/index.ts'
import { useThemeProfile } from './themes/hooks.ts'
import { describeBackground } from './background-layer.ts'

/**
 * 应用外壳。
 *
 * 当前只有一个视图（仪表盘）。将来要接路由时，把 DashboardPage 换成
 * 路由出口即可，其余布局与 Provider 不用动。
 *
 * 没有背景层时，Layout 默认就用主题的 colorBgLayout，与 body 的兜底背景一致，
 * 卡片能明显区分出来；一旦有背景，外壳自身让出底色，改由固定铺满视口的背景层来画
 * （背景层的样式算法在 `./background-layer.ts`）。
 */
export function AppShell(): React.ReactNode {
  const { imageUrl } = useAppearance()
  const themeKey = useTheme()
  /*
   * 生效主题的档案（出厂值 + 用户改过的那几项）。改别的主题时它的引用不变，
   * 因此"编辑另一套主题"不会让外壳（以及整棵看板）重渲染。
   */
  const profile = useThemeProfile(themeKey)
  const background = describeBackground(profile, imageUrl, getThemeSpec(themeKey).background)

  return (
    <Layout
      className={`dash-shell${background ? ' has-custom-bg' : ''}`}
      style={
        {
          minHeight: '100svh',
          /*
           * 卡片的半透明与毛玻璃参数下发给 global.css：
           * 卡片自己的 background / backdrop-filter 写在样式表里（antd 的 Card 规则也在那儿，
           * inline style 打不过它，而且要给"链接卡"和"组件卡"两种元素共用同一套值）。
           * 模糊为 0 时给 `none` 而不是 `blur(0px)`：后者仍会让浏览器生成一次背景快照，
           * 无谓地留下一个层叠上下文。
           */
          '--dash-card-alpha': String(profile.cardAlpha / 100),
          '--dash-card-backdrop': profile.cardBlur > 0 ? `blur(${profile.cardBlur}px)` : 'none',
        } as React.CSSProperties
      }
    >
      {background ? (
        <div className="dash-bg" aria-hidden="true">
          <div className="dash-bg-image" style={background} />
        </div>
      ) : null}
      <Layout.Content>
        {/*
         * 内容列（`.dash-container`）由页面自己包 —— 顶栏要待在它外面才能铺满整个视口。
         * 这里只负责把视图放进 Layout 里。
         */}
        <DashboardPage />
      </Layout.Content>
    </Layout>
  )
}
