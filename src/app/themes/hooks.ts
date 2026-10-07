import { useMemo } from 'react'
import { useThemePatch } from '../../core/appearance/hooks.ts'
import { factoryProfile } from './appearance-sync.ts'
import type { ThemeProfile } from '../../core/appearance/store.ts'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 某套主题实际生效的档案（出厂档案 + 用户改动）。
 *
 * ⚠️ `useMemo` 依赖 `useThemePatch` 返回的对象本身（引用稳定：store 只替换被改的键），
 * 改别的主题不会算出新对象。`AppShell` 拿它算背景层与卡片变量，这条稳定性是
 * "改非生效主题时页面不动"的前提。
 */
export function useThemeProfile(key: ThemeKey): ThemeProfile {
  const patch = useThemePatch(key)

  return useMemo(() => ({ ...factoryProfile(key), ...patch }), [key, patch])
}
