import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useAppearance } from '../../../core/appearance/hooks.ts'
import { setColorMode } from '../../../core/appearance/store.ts'
import type { ColorMode } from '../../../core/theme-preference.ts'

const MODES: readonly { value: ColorMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: '浅色', icon: <SunOutlined /> },
  { value: 'dark', label: '深色', icon: <MoonOutlined /> },
  { value: 'system', label: '跟随系统', icon: <DesktopOutlined /> },
]

/**
 * 色调模式三选一。
 *
 * 只改 `AppearanceState.colorMode` —— 两个槽位（各自用哪套主题）不动，
 * 因此切回原来的色调时，那套主题与它自己的档案都还在。
 * 样式沿用设置面板里那套"大按钮"（`.dash-settings-option`），比下拉更好点。
 */
export function ColorModePicker(): React.ReactNode {
  const { colorMode } = useAppearance()

  return (
    <div className="dash-settings-options" role="radiogroup" aria-label="色调模式">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="radio"
          aria-checked={colorMode === mode.value}
          className={`dash-settings-option${colorMode === mode.value ? ' is-active' : ''}`}
          onClick={() => setColorMode(mode.value)}
        >
          <span className="dash-settings-option-icon" aria-hidden="true">
            {mode.icon}
          </span>
          {mode.label}
        </button>
      ))}
    </div>
  )
}
