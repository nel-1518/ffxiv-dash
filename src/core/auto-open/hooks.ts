import { useSyncExternalStore } from 'react'
import { getAutoOpenLinks, subscribeAutoOpen } from './store.ts'

/**
 * 「跳转」输入框里的文本。快照就是那个字符串本身（原始值，`Object.is` 比对即可）。
 */
export function useAutoOpenLinks(): string {
  return useSyncExternalStore(subscribeAutoOpen, getAutoOpenLinks)
}
