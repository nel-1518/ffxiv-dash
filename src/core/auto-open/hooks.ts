import { useSyncExternalStore } from 'react'
import { getAutoOpenLinks, subscribeAutoOpen } from './store.ts'

/**
 * 「跳转」输入框里的文本。
 *
 * 与外观一样走 useSyncExternalStore：不需要 Provider，快照就是那个字符串本身
 * （原始值，`Object.is` 比对即可，不存在"每次现算新对象"的坑）。
 */
export function useAutoOpenLinks(): string {
  return useSyncExternalStore(subscribeAutoOpen, getAutoOpenLinks)
}
