import { useSyncExternalStore } from 'react'
import { getTheme, subscribeTheme } from '../../core/theme-preference.ts'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 当前主题。
 *
 * 与时钟、外观一致走 useSyncExternalStore：选了主题后 AppProviders 会重建
 * ConfigProvider 的令牌，全树跟着换配色。快照是 core 层缓存的那个值，稳定可比较。
 */
export function useTheme(): ThemeKey {
  return useSyncExternalStore(subscribeTheme, getTheme)
}
