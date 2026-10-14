import { createContext, useContext, useMemo } from 'react'
import { useTheme, useThemePatch } from '../../../core/appearance/hooks.ts'
import { setThemeProfile } from '../../../core/appearance/store.ts'
import { resetThemeAppearance } from '../../../core/appearance/image-store.ts'
import { factoryProfile } from '../../../app/themes/appearance-sync.ts'
import type { ThemeProfile, ThemeProfilePatch } from '../../../core/appearance/store.ts'
import type { ThemeKey } from '../../../core/theme-preference.ts'

/**
 * 「设置面板里当前编辑的是哪套主题」的作用域。
 * 背景 / 卡片控件（`BackgroundSection` / `Tunings`）因此不必知道自己处于哪种上下文：读 `profile`、写 `set(patch)`，改哪套由 Provider 决定。
 * ⚠️ 无 Provider 时退回当前生效主题，此时 `profile` 就是页面上正在显示的档案；没有「预览开关」也不需要——生效主题的档案一改快照即变、页面立刻跟变，改别的主题快照不变、页面不动。
 * ⚠️ hook / context 与 Provider 组件必须分文件（Provider 在 ./theme-profile-provider.tsx），混在一起 Fast Refresh 会失效（oxlint `react(only-export-components)`）。
 */
export type ThemeProfileScope = {
  key: ThemeKey
  /** 该主题实际生效的档案（主题出厂值 + 用户改过的那几项）。 */
  profile: ThemeProfile
  /** 写档案：只传改动项，勿传整份档案。 */
  set: (patch: ThemeProfilePatch) => void
  /** 恢复默认（清掉这一整套主题的改动，并删掉它上传的图片）。 */
  reset: () => void

}

export const ThemeProfileScope = createContext<ThemeProfileScope | null>(null)

/** 当前编辑对象的档案读写；没有 Provider 时 = 当前生效主题。 */
export function useThemeProfile(): ThemeProfileScope {
  const scoped = useContext(ThemeProfileScope)

  // ⚠️ hooks 不能条件调用，总是先算一份「生效主题」作用域；有 Provider 时白算一次（`factoryProfile` 纯查表，被 useMemo 挡住）
  const activeKey = useTheme()
  const activePatch = useThemePatch(activeKey)

  const activeScope = useMemo<ThemeProfileScope>(
    () => ({
      key: activeKey,
      profile: { ...factoryProfile(activeKey), ...activePatch },
      set: (patch) => setThemeProfile(activeKey, patch),
      reset: () => resetThemeAppearance(activeKey),
    }),
    [activeKey, activePatch],
  )

  return scoped ?? activeScope
}
