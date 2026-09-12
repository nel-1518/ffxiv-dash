import { useState } from 'react'
import { Flex, Typography } from 'antd'
import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { loadThemeMode, saveThemeMode } from '../../core/theme-preference.ts'
import type { ThemeMode } from '../../core/theme-preference.ts'

type ThemeOption = { value: ThemeMode; label: string; icon: React.ReactNode }

const THEME_OPTIONS: readonly ThemeOption[] = [
  { value: 'light', label: '浅色', icon: <SunOutlined /> },
  { value: 'dark', label: '深色', icon: <MoonOutlined /> },
  { value: 'auto', label: '跟随系统', icon: <DesktopOutlined /> },
]

/**
 * 通用设置。
 *
 * 目前只有主题一项：选择结果会写进 localStorage 并记住，
 * 但**深色主题尚未接入配色**（接入点是 app/theme-config.ts），
 * 因此下面留了一行说明，避免用户选了"深色"却以为坏了。
 */
export function GeneralSettingsPanel(): React.ReactNode {
  // 面板每次打开都是新挂载的，惰性初始化直接读一次存储即可
  const [mode, setMode] = useState<ThemeMode>(loadThemeMode)

  const handleSelect = (next: ThemeMode) => {
    setMode(next)
    saveThemeMode(next)
  }

  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          主题
        </Typography.Title>

        <div className="dash-settings-options" role="radiogroup" aria-label="主题">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              className={`dash-settings-option${mode === option.value ? ' is-active' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className="dash-settings-option-icon" aria-hidden="true">
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>

        <Typography.Text className="dash-settings-hint" type="secondary">
          已记住你的选择。深色主题还在适配，暂时不影响当前配色。
        </Typography.Text>
      </section>
    </Flex>
  )
}
