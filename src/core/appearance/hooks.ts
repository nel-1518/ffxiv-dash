import { useSyncExternalStore } from 'react'
import { getAppearance, subscribeAppearance } from './store.ts'
import type { AppearanceSnapshot } from './store.ts'

/**
 * 当前外观（含上传图片的 object URL）。
 *
 * 与时钟一样走 useSyncExternalStore：不需要 Provider、不重渲染整棵树。
 * 快照是模块级缓存对象，只有真正变化时引用才会变（见 store.ts 的 rebuildSnapshot）。
 */
export function useAppearance(): AppearanceSnapshot {
  return useSyncExternalStore(subscribeAppearance, getAppearance)
}
