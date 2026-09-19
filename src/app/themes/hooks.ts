import { useMemo } from 'react'
import { useThemePatch } from '../../core/appearance/hooks.ts'
import { factoryProfile } from './appearance-sync.ts'
import type { ThemeProfile } from '../../core/appearance/store.ts'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 某套主题**实际生效**的档案（出厂档案 + 用户改动）。
 *
 * ⚠️ `useMemo` 的依赖是 `useThemePatch` 返回的**那个对象本身**（引用稳定：store 只替换
 * 被改的那个键）。因此改别的主题不会让这里算出新对象 —— `AppShell` 拿它算背景层与
 * 卡片变量，引用一变整棵树都会重渲染，这条稳定性是"改非生效主题时页面不动"的一部分。
 */
export function useThemeProfile(key: ThemeKey): ThemeProfile {
  const patch = useThemePatch(key)

  return useMemo(() => ({ ...factoryProfile(key), ...patch }), [key, patch])
}
