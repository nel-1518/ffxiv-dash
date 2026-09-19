import { createContext, useContext, useMemo } from 'react'
import { useTheme, useThemePatch } from '../../../core/appearance/hooks.ts'
import { resetThemeProfile, setThemeProfile } from '../../../core/appearance/store.ts'
import { factoryProfile } from '../../../app/themes/appearance-sync.ts'
import type { ThemeProfile, ThemeProfilePatch } from '../../../core/appearance/store.ts'
import type { ThemeKey } from '../../../core/theme-preference.ts'

/**
 * 「设置面板里当前编辑的是哪套主题」的作用域。
 *
 * 背景 / 卡片那两组控件（`BackgroundSection` / `Tunings`）因此不必知道自己在哪种上下文里：
 * 读 `profile`、写 `set(patch)`，改的到底是哪套主题由 Provider 决定。
 *
 * ⚠️ **无 Provider 时退回"当前生效主题"**（`useThemeProfile` 的默认分支）——
 * 那时 `profile` 就是页面上正在显示的那份档案。
 *
 * ⚠️ 这里没有"预览开关"，也不需要：编辑对象是否生效完全由数据模型决定 ——
 * 生效主题的档案一改，快照就变、页面立刻跟着变；改别的主题，快照不变、页面样式一点不动。
 *
 * ⚠️ hook / context 与 Provider 组件**必须分文件**（Provider 在 ./theme-profile-provider.tsx）：
 * 混在一起会让 Fast Refresh 失效（oxlint `react(only-export-components)`）。
 */
export type ThemeProfileScope = {
  key: ThemeKey
  /** 该主题实际生效的档案（主题出厂值 + 用户改过的那几项）。 */
  profile: ThemeProfile
  /** 写档案：**只传改动的项**，别把整份档案传进来。 */
  set: (patch: ThemeProfilePatch) => void
  /** 恢复默认（清掉这一整套主题的改动）。 */
  reset: () => void

}

export const ThemeProfileScope = createContext<ThemeProfileScope | null>(null)

/** 当前编辑对象的档案读写；没有 Provider 时 = 当前生效主题。 */
export function useThemeProfile(): ThemeProfileScope {
  const scoped = useContext(ThemeProfileScope)

  // ⚠️ hooks 不能条件调用，所以这里总是先算一份"生效主题"的作用域；
  // 有 Provider 时它只是白算一次（`factoryProfile` 是纯查表，且被 useMemo 挡住）
  const activeKey = useTheme()
  const activePatch = useThemePatch(activeKey)

  const activeScope = useMemo<ThemeProfileScope>(
    () => ({
      key: activeKey,
      profile: { ...factoryProfile(activeKey), ...activePatch },
      set: (patch) => setThemeProfile(activeKey, patch),
      reset: () => resetThemeProfile(activeKey),
    }),
    [activeKey, activePatch],
  )

  return scoped ?? activeScope
}
