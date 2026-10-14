import { useState } from 'react'
import { App, Button, Flex, Popconfirm, Typography } from 'antd'
import { UndoOutlined } from '@ant-design/icons'
import { getThemeSpec } from '../../../app/themes/index.ts'
import { useTheme } from '../../../core/appearance/hooks.ts'
import { resetThemeAppearance } from '../../../core/appearance/image-store.ts'
import { BackgroundSection } from '../appearance/BackgroundSection.tsx'
import { ThemeProfileScopeProvider } from '../appearance/theme-profile-provider.tsx'
import { ThemeSelect } from '../appearance/ThemeSelect.tsx'
import { CardTuning } from '../appearance/Tunings.tsx'
import type { ThemeKey } from '../../../core/theme-preference.ts'

/**
 * 主题编辑：挑一套主题，改它自己的背景与卡片（每套主题一份档案，互不影响）。
 * 编辑对象只是 UI 状态（初值 = 当前生效主题），换它不改页面；页面上用哪套由「外观」的色调 + 两个槽位决定。
 * 编辑的是生效主题时改动立刻可见，否则只落进那套主题的档案，切过去即可看到；每套主题有常驻的「恢复默认」（见 `ResetProfileButton`）。
 * 实现上是一层 `ThemeProfileScopeProvider`：背景 / 卡片控件从中读写档案，可服务任意一套主题。
 */
export function ThemeEditorPanel(): React.ReactNode {
  const activeKey = useTheme()
  const [editKey, setEditKey] = useState<ThemeKey>(activeKey)

  const spec = getThemeSpec(editKey)
  const editingActive = editKey === activeKey

  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          编辑对象
        </Typography.Title>
        <ThemeSelect label="主题" value={editKey} activeKey={activeKey} onChange={setEditKey} />
        <Typography.Text type="secondary" className="dash-settings-hint">
          {editingActive
            ? `「${spec.label}」是当前正在使用的主题，改动会立即反映在页面上。`
            : `「${spec.label}」当前未使用，改动会保存下来，在「外观」中切换至该主题即可看到效果。`}
        </Typography.Text>
      </section>

      {/* ⚠️ `key={editKey}` 必须有：换编辑对象重挂子树，否则背景地址输入框草稿会串到另一套主题 */}
      <ThemeProfileScopeProvider key={editKey} themeKey={editKey}>
        <section>
          <Flex align="center" justify="space-between" gap={12}>
            <Typography.Text strong>{spec.label}</Typography.Text>
            <ResetProfileButton themeKey={editKey} />
          </Flex>
        </section>

        <BackgroundSection />

        <section>
          <Typography.Title className="dash-settings-label" level={5}>
            卡片
          </Typography.Title>
          <CardTuning />
        </section>
      </ThemeProfileScopeProvider>
    </Flex>
  )
}

/**
 * 「恢复默认」：清掉这套主题的全部改动（走 `resetThemeAppearance`，同时清 store 与 IndexedDB、把上传的图片一并删掉），
 * 读时自然回落主题出厂档案。
 * 按钮不做可用性判断：逐字段比对出厂值的判断会随主题预设调整翻动，而本动作幂等、无副作用（没改过就什么都不发生）。
 * ⚠️ 会删掉用户的图片文件，确认文案里必须说清楚——这是全仓唯一动用户上传内容的按钮。
 */
function ResetProfileButton({ themeKey }: { themeKey: ThemeKey }): React.ReactNode {
  const { message } = App.useApp()

  return (
    <Popconfirm
      title="恢复这套主题的默认外观？"
      description="本主题上传的图片也会一并删除。"
      okText="恢复"
      cancelText="取消"
      onConfirm={() => {
        resetThemeAppearance(themeKey)
        message.success('已恢复默认外观')
      }}
    >
      <Button size="small" icon={<UndoOutlined />}>
        恢复默认
      </Button>
    </Popconfirm>
  )
}
