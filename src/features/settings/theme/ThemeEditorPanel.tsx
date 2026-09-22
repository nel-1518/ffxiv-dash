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
 *
 * - **编辑对象只是 UI 状态**（初值 = 当前生效主题），换它**不改页面** ——
 *   页面上用哪套由「外观」的色调 + 两个槽位决定；
 * - 于是"会不会看到效果"也不需要开关：编辑的正好是生效主题时改动立刻可见，
 *   是别的主题时改动只落进那套主题的档案（把它切过去就能看到）；
 * - 每套主题一个「恢复默认」（常驻可用，见 `ResetProfileButton`）。
 *
 * 实现上就一层 `ThemeProfileScopeProvider`：背景 / 卡片控件从那里面读档案、写改动，
 * 因此它们一行都不用改就能服务"任意一套主题"。
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

      {/*
        ⚠️ `key={editKey}` 是必须的：换编辑对象要重挂子树，
        否则背景地址输入框的草稿（`useDraft` 的本地 state）会串到另一套主题上。
      */}
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
 * 「恢复默认」：清掉这一整套主题的改动，读时自然回落主题出厂档案，
 * 并**把它上传的图片一并删掉**（走 `resetThemeAppearance`，它同时收 store 与 IndexedDB）。
 *
 * 按钮**不做**可用性判断（曾经按"有没有改过"置灰）：那个判断要拿档案逐字段与主题出厂值比，
 * 主题预设一调整按钮的灰/亮就跟着变；而这个动作本身是幂等的，点下去没有副作用（没改过就什么都不发生）。
 *
 * ⚠️ 它**会删掉用户的图片文件**，所以确认文案里要说清楚 —— 这是全仓唯一动用户上传内容的按钮。
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
