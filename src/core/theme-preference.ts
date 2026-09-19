/**
 * 主题键的**类型与清单** —— 只有"有哪些可选"与"两个槽位的默认值"，没有存储。
 *
 * 用户实际选了哪几套存在 `core/appearance/store.ts` 的 `AppearanceState` 里：
 * `lightTheme` / `darkTheme` 两个槽位各存一个主题键，再加一个色调模式（浅色 / 深色 / 跟随系统）。
 * 每套主题自己的背景与卡片则存在 `AppearanceState.profiles`（逐主题一份档案）。
 *
 * ⚠️ 本模块是**唯一**的主题键清单（`app/themes/index.ts` 用
 * `Record<ThemeKey, ThemeSpec>` 对齐它，少一套主题会直接编译报错）；
 * 展示顺序就是 `THEME_KEYS` 的顺序。
 */
export type ThemeKey =
  | 'default-light'
  | 'default-dark'
  | 'heavensward'
  | 'stormblood'
  | 'shadowbringers'
  | 'endwalker'
  | 'dawntrail'
  | 'evercold'

/** 展示顺序即此处的顺序；键一旦发布不要改（会写进 localStorage）。 */
export const THEME_KEYS: readonly ThemeKey[] = [
  'default-light',
  'default-dark',
  'heavensward',
  'stormblood',
  'shadowbringers',
  'endwalker',
  'dawntrail',
  'evercold',
]

/** 色调（解析之后的二选一）。 */
export type ColorScheme = 'light' | 'dark'

/** 色调模式：固定浅色 / 固定深色 / 跟随系统。 */
export type ColorMode = ColorScheme | 'system'

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark', 'system']

/** 新用户（或存储值非法时）的色调模式：与"新装就是浅色基线"保持一致。 */
export const DEFAULT_COLOR_MODE: ColorMode = 'light'

/** 浅色槽位的默认主题。 */
export const DEFAULT_LIGHT_THEME: ThemeKey = 'default-light'

/** 深色槽位的默认主题。 */
export const DEFAULT_DARK_THEME: ThemeKey = 'default-dark'

/** 校验存储值是否是可识别的主题键；不认识的一律回落到默认主题。 */
export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value)
}

/** 校验色调模式（浅色 / 深色 / 跟随系统）。 */
export function isColorMode(value: unknown): value is ColorMode {
  return typeof value === 'string' && (COLOR_MODES as readonly string[]).includes(value)
}
