/**
 * 主题偏好（纯逻辑，无 React；消费侧见 `src/app/themes/hooks.ts` 的 `useTheme()`）。
 *
 * 两套中性底色（默认-浅色 / 默认-深色）+ 六套资料片配色。这里只负责"用户选了哪一个"，
 * 具体配色在 `src/app/themes/<key>/` 里（每套主题一个文件夹）。
 *
 * 主题属于**外观偏好而不是看板数据**：独立键保存，因此不进导出，导入别人的看板也不会被冲掉。
 *
 * ⚠️ 本模块是**唯一**的主题键清单（注册表用 `Record<ThemeKey, ThemeSpec>` 对齐它，
 * 少一套主题会直接编译报错）；展示顺序就是 `THEME_KEYS` 的顺序。
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

/**
 * 键沿用 v1：老版本在这里存的是 light/dark/auto，那些值都过不了 `isThemeKey`，
 * 会自然回落到默认主题，不需要额外的迁移代码。
 */
const STORAGE_KEY = 'ffxiv-dash:theme:v1'

function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (THEME_KEYS as readonly string[]).includes(value)
}

/**
 * 模块级快照。
 *
 * ⚠️ 必须返回缓存的这个值，不能每次现读 localStorage：useSyncExternalStore
 * 每次渲染都拿快照做比较，现算会永远"变了"，直接无限重渲染（时钟那边踩过）。
 */
let theme: ThemeKey = DEFAULT_THEME
let loaded = false

type Listener = () => void
const listeners = new Set<Listener>()

/** 读取主题偏好；幂等，重复调用只读一次存储。应用启动时先调它。 */
export function loadTheme(): ThemeKey {
  if (!loaded) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      theme = isThemeKey(raw) ? raw : DEFAULT_THEME
    } catch (error) {
      console.warn('[ffxiv-dash] 无法读取主题偏好，使用默认值', error)
      theme = DEFAULT_THEME
    }
    loaded = true
  }
  return theme
}

export function getTheme(): ThemeKey {
  loadTheme()
  return theme
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 换主题：落盘 + 通知订阅者（AppProviders 会据此重建 ConfigProvider 的令牌）。 */
export function setTheme(next: ThemeKey): ThemeKey {
  theme = isThemeKey(next) ? next : DEFAULT_THEME
  loaded = true
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch (error) {
    // 存不下只告警：主题是锦上添花的东西，不该因为它打断使用
    console.warn('[ffxiv-dash] 主题偏好未能保存', error)
  }
  for (const listener of listeners) {
    listener()
  }
  return theme
}
