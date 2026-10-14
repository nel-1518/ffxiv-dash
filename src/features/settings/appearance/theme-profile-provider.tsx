import { useMemo } from 'react'
import { useThemePatch } from '../../../core/appearance/hooks.ts'
import { setThemeProfile } from '../../../core/appearance/store.ts'
import { resetThemeAppearance } from '../../../core/appearance/image-store.ts'
import { factoryProfile } from '../../../app/themes/appearance-sync.ts'
import { ThemeProfileScope } from './theme-profile.ts'
import type { ThemeProfilePatch } from '../../../core/appearance/store.ts'
import type { ThemeKey } from '../../../core/theme-preference.ts'

export type ThemeProfileScopeProviderProps = {
  /** 编辑对象。 */
  themeKey: ThemeKey
  children: React.ReactNode
}

/**
 * 把「当前编辑对象」换成指定主题（「主题编辑」用），背景 / 卡片控件改的就是它。
 * ⚠️ 调用方必须同时给 `key={themeKey}`：换编辑对象要重挂整棵子树，否则背景地址输入框草稿（`useDraft` 本地 state）会串到另一套主题上。
 */
export function ThemeProfileScopeProvider({
  themeKey,
  children,
}: ThemeProfileScopeProviderProps): React.ReactNode {
  const patch = useThemePatch(themeKey)

  const value = useMemo(
    () => ({
      key: themeKey,
      profile: { ...factoryProfile(themeKey), ...patch },
      set: (next: ThemeProfilePatch) => setThemeProfile(themeKey, next),
      reset: () => resetThemeAppearance(themeKey),
    }),
    [themeKey, patch],
  )

  return <ThemeProfileScope.Provider value={value}>{children}</ThemeProfileScope.Provider>
}
