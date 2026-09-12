import { Typography } from 'antd'
import { THEME_KEYS, setTheme } from '../../../core/theme-preference.ts'
import { getThemeSpec } from '../../../app/themes/index.ts'
import { syncAppearanceWithTheme } from '../../../app/themes/appearance-sync.ts'
import { useTheme } from '../../../app/themes/hooks.ts'
import type { ThemeKey } from '../../../core/theme-preference.ts'

/**
 * 主题：八选一。
 *
 * 选择结果直接落到 `core/theme-preference.ts` 的 store 里，AppProviders 订阅它重建
 * antd 令牌，全树跟着换配色；不需要在这里存本地 state。
 * 名字取自主题注册表（`app/themes/`），因此这里不再自带一份 label 表。
 *
 * 顺带把外观换成该主题的一套（`syncAppearanceWithTheme`）：背景、卡片的不透明度与模糊
 * 都取该主题声明的值（背景图会写进「图片链接」，这样那张图的参数还能接着调）。
 * 点到已选中的主题直接返回 —— 那不算"换主题"，不该把调过的滑块重置回预设值。
 */
export function ThemePicker(): React.ReactNode {
  const theme = useTheme()

  const handleSelect = (key: ThemeKey) => {
    if (key === theme) {
      return
    }
    setTheme(key)
    syncAppearanceWithTheme(key)
  }

  return (
    <>
      <div className="dash-settings-options is-grid" role="radiogroup" aria-label="主题">
        {THEME_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={theme === key}
            className={`dash-settings-option${theme === key ? ' is-active' : ''}`}
            onClick={() => handleSelect(key)}
          >
            {getThemeSpec(key).label}
          </button>
        ))}
      </div>
    </>
  )
}
