import { useState } from 'react'
import { Modal } from 'antd'
import { BgColorsOutlined, DatabaseOutlined, ExportOutlined, HighlightOutlined, SearchOutlined } from '@ant-design/icons'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel.tsx'
import { AutoOpenSettingsPanel } from './AutoOpenSettingsPanel.tsx'
import { DataSettingsPanel } from './DataSettingsPanel.tsx'
import { ThemeEditorPanel } from './theme/ThemeEditorPanel.tsx'
import { SearchSettingsPanel } from './SearchSettingsPanel.tsx'

type SettingsSection = {
  key: string
  label: string
  icon: React.ReactNode
  Panel: () => React.ReactNode
}

/**
 * 左侧分组。
 *
 * **扩展点**：新增一组设置只需要往这里追加一项（label / icon / 面板各一个）——
 * 面板与 tab 是同一份数据驱动的，不必再去下面补分支。
 * 「外观」只管色调与两个槽位选哪套主题，改动落在**哪套主题的档案**上由「主题编辑」决定。
 */
const SECTIONS = [
  { key: 'appearance', label: '外观', icon: <BgColorsOutlined />, Panel: AppearanceSettingsPanel },
  { key: 'theme', label: '主题编辑', icon: <HighlightOutlined />, Panel: ThemeEditorPanel },
  { key: 'auto-open', label: '跳转', icon: <ExportOutlined />, Panel: AutoOpenSettingsPanel },
  { key: 'search', label: '搜索', icon: <SearchOutlined />, Panel: SearchSettingsPanel },
  { key: 'data', label: '数据管理', icon: <DatabaseOutlined />, Panel: DataSettingsPanel },
] as const satisfies readonly SettingsSection[]

/** 分区键由 `SECTIONS` 推导，保证"导航里有、面板分发里没有"这种空档不可能出现。 */
export type SettingsSectionKey = (typeof SECTIONS)[number]['key']

export type SettingsDialogProps = {
  onClose: () => void
}

/**
 * 设置弹窗：左侧分组导航 + 右侧内容。
 *
 * 用 antd `Modal` 而不是像搜索弹窗那样自绘浮层：这里不需要 visualViewport 适配，
 * 也没有"边打字边保持焦点"的需求，交给 Modal 处理焦点陷阱与 Esc 更省事。
 * antd 的 cssVar 类会打在 `.ant-modal` 自身上，因此弹窗内部照样能用 `var(--ant-color-*)`。
 */
export function SettingsDialog({ onClose }: SettingsDialogProps): React.ReactNode {
  const [active, setActive] = useState<SettingsSectionKey>('appearance')
  const { Panel } = SECTIONS.find((section) => section.key === active) ?? SECTIONS[0]

  return (
    <Modal
      className="dash-settings-modal"
      open
      title="设置"
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
      mask={{ closable: true }}
    >
      <div className="dash-settings">
        <nav className="dash-settings-nav" role="tablist" aria-orientation="vertical" aria-label="设置分组">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              role="tab"
              id={`dash-settings-tab-${section.key}`}
              aria-selected={active === section.key}
              aria-controls={`dash-settings-panel-${section.key}`}
              className={`dash-settings-nav-item${active === section.key ? ' is-active' : ''}`}
              onClick={() => setActive(section.key)}
            >
              <span className="dash-settings-nav-icon" aria-hidden="true">
                {section.icon}
              </span>
              {section.label}
            </button>
          ))}
        </nav>

        <div
          className="dash-settings-panel"
          role="tabpanel"
          id={`dash-settings-panel-${active}`}
          aria-labelledby={`dash-settings-tab-${active}`}
          tabIndex={0}
        >
          <Panel />
        </div>
      </div>
    </Modal>
  )
}
