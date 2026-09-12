/**
 * 主题偏好。
 *
 * 这里只负责"用户选了哪一个"以及把它记住，**不负责**把它变成实际配色：
 * 目前选择结果仅持久化，界面仍固定浅色。真正的接入点是
 * `src/app/theme-config.ts`（切 `theme.darkAlgorithm`）+
 * `global.css` 里 html/body 的底色（antd 变量挂在组件自身，`html/body` 取不到，
 * 所以深色落地时得额外用 `data-theme` 属性兜底）。
 *
 * 取值刻意与 how-much 的 `ff14_theme_mode` 保持一致（auto/light/dark），
 * 将来两边接同一套主题方案时不用再做映射。
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto']

/** 默认跟随系统：与参考实现的默认值一致。 */
export const DEFAULT_THEME_MODE: ThemeMode = 'auto'

const STORAGE_KEY = 'ffxiv-dash:theme:v1'

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/** 读取主题偏好；非法值或不可读时回退默认值。 */
export function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isThemeMode(raw) ? raw : DEFAULT_THEME_MODE
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取主题偏好，使用默认值', error)
    return DEFAULT_THEME_MODE
  }
}

/** 写入主题偏好；失败只告警，不影响界面使用。 */
export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (error) {
    console.warn('[ffxiv-dash] 主题偏好未能保存', error)
  }
}
