import { useSyncExternalStore } from 'react'
import { getAppearance, getThemePatch, resolveTheme, subscribeAppearance } from './store.ts'
import type { AppearanceSnapshot, ThemeProfilePatch } from './store.ts'
import type { ThemeKey } from '../theme-preference.ts'

/**
 * 当前外观（含系统色调与上传图片的 object URL）。
 *
 * 与时钟一样走 useSyncExternalStore：不需要 Provider、不重渲染整棵树。
 * 快照是模块级缓存对象，只有真正变化时引用才会变（见 store.ts 的 rebuildSnapshot）。
 *
 * ⚠️ 这里拿到的是**状态本身**，不是"当前生效主题的档案"：
 * 后者要把出厂值合并进来，而算出厂值要用 `getThemeSpec`（app 层），
 * 所以那份合并视图在 `app/themes/hooks.ts` 的 `useThemeProfile`。
 * 只用一两个字段（比如色调选中态、上传图的文件名）的组件订阅这个就够。
 */
export function useAppearance(): AppearanceSnapshot {
  return useSyncExternalStore(subscribeAppearance, getAppearance)
}

/**
 * 当前**生效主题**（由色调模式 + 两个槽位解析出来的那一套）。
 *
 * ⚠️ 快照必须是那个字符串本身，不能直接返回整个外观对象：`AppProviders` 拿它
 * 重建 ConfigProvider 的令牌，返回对象会在每次改背景时把整棵树重新配色。
 * `AppShell` 也用它：`[data-dash-theme]` 与主题自带的背景预设都要认这个名字。
 */
export function useTheme(): ThemeKey {
  return useSyncExternalStore(subscribeAppearance, resolveTheme)
}

/**
 * 某套主题"用户改过的项"；从没改过就是 undefined。
 *
 * 快照是那**一个对象本身**：store 只替换被改的那个键的对象，其余保持引用稳定，
 * 因此改 A 主题的背景不会让盯着 B 主题的组件重渲染。
 * （"这套主题有没有改过"的判断已经从界面上拿掉了 —— 「恢复默认」常驻可用。）
 */
export function useThemePatch(key: ThemeKey): ThemeProfilePatch | undefined {
  return useSyncExternalStore(subscribeAppearance, () => getThemePatch(key))
}
