import { useSyncExternalStore } from 'react'
import {
  getAppearance,
  getThemeImageUrl,
  getThemePatch,
  resolveTheme,
  subscribeAppearance,
} from './store.ts'
import type { AppearanceSnapshot, ThemeProfilePatch } from './store.ts'
import type { ThemeKey } from '../theme-preference.ts'

/**
 * 当前外观（含系统色调与上传图的 object URL）。快照是模块级缓存对象，
 * 只有真正变化时引用才变（见 store.ts 的 rebuildSnapshot）。
 *
 * ⚠️ 这里拿到的是状态本身，不是"当前生效主题的档案"：后者要合并出厂值
 * （用到 app 层的 `getThemeSpec`），合并视图在 `app/themes/hooks.ts` 的 `useThemeProfile`。
 */
export function useAppearance(): AppearanceSnapshot {
  return useSyncExternalStore(subscribeAppearance, getAppearance)
}

/**
 * 当前生效主题（由色调模式 + 两个槽位解析出来）。
 *
 * ⚠️ 快照必须是那个字符串本身，不能返回整个外观对象：否则每次改背景都会让
 * `AppProviders` 重建令牌、把整棵树重新配色。
 */
export function useTheme(): ThemeKey {
  return useSyncExternalStore(subscribeAppearance, resolveTheme)
}

/**
 * 某套主题"用户改过的项"；从没改过就是 undefined。
 * 快照是那一个对象本身：store 只替换被改的键，其余引用稳定，
 * 改 A 主题不会让盯着 B 主题的组件重渲染。
 */
export function useThemePatch(key: ThemeKey): ThemeProfilePatch | undefined {
  return useSyncExternalStore(subscribeAppearance, () => getThemePatch(key))
}

/**
 * 某套主题上传图的 object URL（`null` = 没上传过 / 还没从 IndexedDB 读回来）。
 *
 * ⚠️ 快照是那个字符串本身：换背景图只让盯着这套主题的组件重渲染，
 * 不像 `useAppearance()` 那样把整份快照拉进依赖。
 */
export function useThemeImageUrl(key: ThemeKey): string | null {
  return useSyncExternalStore(subscribeAppearance, () => getThemeImageUrl(key))
}
