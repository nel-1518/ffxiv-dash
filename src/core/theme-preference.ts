/**
 * 主题键的**类型与清单** —— 只有"有哪些可选"与"默认是哪个"，没有存储。
 *
 * 用户实际选了哪一套存在 `core/appearance/store.ts` 的 `AppearanceState.theme` 里：
 * 主题只是"外观偏好"的一个字段，与背景、卡片参数共用同一个键、同一套订阅。
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

/** 默认主题（首次进入或存储值非法时用它）。就是基线主题，不需要维护色值。 */
export const DEFAULT_THEME: ThemeKey = 'default-light'

/** 校验存储值是否是可识别的主题键；不认识的一律回落到默认主题。 */
export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value)
}
