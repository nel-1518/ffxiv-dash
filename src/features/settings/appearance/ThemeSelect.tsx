import { Flex, Select, Typography } from 'antd'
import { THEME_KEYS } from '../../../core/theme-preference.ts'
import { getThemeSpec } from '../../../app/themes/index.ts'
import type { ThemeKey } from '../../../core/theme-preference.ts'

/**
 * 八套主题的下拉选项；顺序即 `THEME_KEYS`。
 *
 * **不按浅 / 深过滤**：八套一视同仁地列出来，用户可以自由组合
 * （实测只有「默认-浅色」是浅色算法，过滤的话浅色那档就只剩一个选项了）。
 */
const THEME_OPTIONS = THEME_KEYS.map((key) => ({ value: key, label: getThemeSpec(key).label }))

export type ThemeSelectProps = {
  /** 左侧的说明文字（「浅色」/「深色」/「主题」）。 */
  label: string
  value: ThemeKey
  onChange: (key: ThemeKey) => void
  /** 当前**生效**的那套主题，给它加一个「使用中」后缀。 */
  activeKey?: ThemeKey
}

/**
 * 「标签 + 主题下拉」一行。
 *
 * 受控组件：读什么、写什么全由调用方决定 ——
 * 「外观」里写的是两个槽位，`「主题编辑」`里只是切换编辑对象（不改页面）。
 * 名字取自主题注册表（`app/themes/`），所以这里不再自带一份 label 表。
 */
export function ThemeSelect({ label, value, onChange, activeKey }: ThemeSelectProps): React.ReactNode {
  const options = activeKey
    ? THEME_OPTIONS.map((option) =>
        option.value === activeKey ? { ...option, label: `${option.label} · 使用中` } : option,
      )
    : THEME_OPTIONS

  return (
    <Flex align="center" gap={12}>
      <Typography.Text type="secondary" style={{ flex: 'none', width: 56, fontSize: 12 }}>
        {label}
      </Typography.Text>
      <Select
        style={{ flex: 1, minWidth: 0 }}
        value={value}
        onChange={onChange}
        options={options}
        aria-label={`${label}主题`}
      />
    </Flex>
  )
}
