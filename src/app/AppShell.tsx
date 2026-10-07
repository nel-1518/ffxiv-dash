import { Layout } from 'antd'
import { DashboardPage } from '../views/DashboardPage.tsx'
import { useTheme, useThemeImageUrl } from '../core/appearance/hooks.ts'
import { getThemeSpec } from './themes/index.ts'
import { useThemeProfile } from './themes/hooks.ts'
import { describeBackground } from './background-layer.ts'

/**
 * 应用外壳。当前只有一个视图（仪表盘）；将来接路由时把 DashboardPage 换成路由出口即可。
 *
 * 没有背景层时 Layout 用主题的 colorBgLayout，与 body 兜底背景一致；一旦有背景，
 * 外壳让出底色，改由固定铺满视口的背景层来画（样式算法见 `./background-layer.ts`）。
 */
export function AppShell(): React.ReactNode {
  const themeKey = useTheme()
  /*
   * 上传图逐主题一份，外壳只取生效主题那一张。
   * ⚠️ 不能拿 `useAppearance().imageUrls` 再取下标：那样任何外观变化都会让整棵看板重渲染。
   */
  const imageUrl = useThemeImageUrl(themeKey)
  /* 生效主题档案的引用在编辑别的主题时不变，外壳与看板不会因此重渲染。 */
  const profile = useThemeProfile(themeKey)
  const background = describeBackground(profile, imageUrl, getThemeSpec(themeKey).background)

  return (
    <Layout
      className={`dash-shell${background ? ' has-custom-bg' : ''}`}
      style={
        {
          minHeight: '100svh',
          /*
           * 卡片透明度与毛玻璃经 CSS 变量下发给 global.css：卡片样式写在样式表里
           * （antd Card 规则优先级高于 inline style，且链接卡 / 组件卡要共用）。
           * 模糊为 0 时给 `none` 而非 `blur(0px)`：后者仍会生成一次背景快照、留下层叠上下文。
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
        {/* 内容列（`.dash-container`）由页面自己包：顶栏要待在它外面才能铺满视口 */}
        <DashboardPage />
      </Layout.Content>
    </Layout>
  )
}
