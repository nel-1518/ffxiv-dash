import { useSyncExternalStore } from 'react'
import { getAppearance, getTheme, subscribeAppearance } from './store.ts'
import type { AppearanceSnapshot } from './store.ts'
import type { ThemeKey } from '../theme-preference.ts'

/**
 * 当前外观（含上传图片的 object URL）。
 *
 * 与时钟一样走 useSyncExternalStore：不需要 Provider、不重渲染整棵树。
 * 快照是模块级缓存对象，只有真正变化时引用才会变（见 store.ts 的 rebuildSnapshot）。
 */
export function useAppearance(): AppearanceSnapshot {
  return useSyncExternalStore(subscribeAppearance, getAppearance)
}

/**
 * 当前主题。与外观同一个 store、同一套订阅 —— 主题只是外观里的一个字段。
 *
 * ⚠️ 快照必须是那个字符串本身，不能直接返回整个外观对象：`AppProviders` 拿它
 * 重建 ConfigProvider 的令牌，返回对象会在每次改背景时把整棵树重新配色。
 */
export function useTheme(): ThemeKey {
  return useSyncExternalStore(subscribeAppearance, getTheme)
}
