import { useState } from 'react'
import { Modal } from 'antd'
import { DatabaseOutlined, SettingOutlined } from '@ant-design/icons'
import { GeneralSettingsPanel } from './GeneralSettingsPanel.tsx'
import { DataSettingsPanel } from './DataSettingsPanel.tsx'

export type SettingsSectionKey = 'general' | 'data'

type SettingsSection = {
  key: SettingsSectionKey
  label: string
  icon: React.ReactNode
}

/**
 * 左侧分组。
 *
 * **扩展点**：新增一组设置只需要往这里追加一项，并在下面的面板分发里补一个分支。
 */
const SECTIONS: readonly SettingsSection[] = [
  { key: 'general', label: '通用设置', icon: <SettingOutlined /> },
  { key: 'data', label: '数据管理', icon: <DatabaseOutlined /> },
]

export type SettingsDialogProps = {
  onClose: () => void
}

/**
 * 系统设置弹窗：左侧分组导航 + 右侧内容。
 *
 * 用 antd `Modal` 而不是像搜索弹窗那样自绘浮层：这里不需要 visualViewport 适配，
 * 也没有"边打字边保持焦点"的需求，交给 Modal 处理焦点陷阱与 Esc 更省事。
 * antd 的 cssVar 类会打在 `.ant-modal` 自身上，因此弹窗内部照样能用 `var(--ant-color-*)`。
 */
export function SettingsDialog({ onClose }: SettingsDialogProps): React.ReactNode {
  const [active, setActive] = useState<SettingsSectionKey>('general')

  return (
    <Modal
      className="dash-settings-modal"
      open
      title="系统设置"
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
          {active === 'general' ? <GeneralSettingsPanel /> : <DataSettingsPanel />}
        </div>
      </div>
    </Modal>
  )
}
