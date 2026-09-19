import { Flex, Typography } from 'antd'
import { ColorModePicker } from './appearance/ColorModePicker.tsx'
import { ThemeSelect } from './appearance/ThemeSelect.tsx'
import { useAppearance, useTheme } from '../../core/appearance/hooks.ts'
import { setThemeSlot } from '../../core/appearance/store.ts'

/**
 * 外观设置：只管**用哪种色调**与**每种色调用哪套主题**（两节）。
 *
 * 主题自己的背景与卡片搬到「主题编辑」了 —— 每套主题一份档案，改哪套就编辑哪套。
 *
 * 改动即时生效（外壳直接吃生效主题的档案），没有"保存"按钮 ——
 * 这类偏好改一眼就知道对不对，多一步确认反而碍事。
 */
export function AppearanceSettingsPanel(): React.ReactNode {
  const { lightTheme, darkTheme } = useAppearance()
  const activeTheme = useTheme()

  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          配色方案
        </Typography.Title>
        <ColorModePicker />
        <Typography.Text type="secondary" className="dash-settings-hint">
          浅色与深色各固定一套主题；选「跟随系统」时由系统在两者之间自动切换。
        </Typography.Text>
      </section>

      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          对应主题
        </Typography.Title>
        <Flex vertical gap={12}>
          <ThemeSelect
            label="浅色"
            value={lightTheme}
            activeKey={activeTheme}
            onChange={(key) => setThemeSlot('light', key)}
          />
          <ThemeSelect
            label="深色"
            value={darkTheme}
            activeKey={activeTheme}
            onChange={(key) => setThemeSlot('dark', key)}
          />
        </Flex>
        <Typography.Text type="secondary" className="dash-settings-hint">
          每套主题可在「主题编辑」里单独设置。
        </Typography.Text>
      </section>
    </Flex>
  )
}
