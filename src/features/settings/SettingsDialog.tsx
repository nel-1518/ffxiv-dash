import './settings.css'
import { useState } from 'react'
import { Modal } from 'antd'
import { BgColorsOutlined, DatabaseOutlined, ExportOutlined, GithubOutlined, HighlightOutlined, ImportOutlined, InfoCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel.tsx'
import { AutoOpenSettingsPanel } from './AutoOpenSettingsPanel.tsx'
import { DataSettingsPanel } from './DataSettingsPanel.tsx'
import { ThemeEditorPanel } from './theme/ThemeEditorPanel.tsx'
import { SearchSettingsPanel } from './SearchSettingsPanel.tsx'
import { BatchLinksSettingsPanel } from './BatchLinksSettingsPanel.tsx'
import { AboutSettingsPanel } from './AboutSettingsPanel.tsx'

type SettingsSection = {
  key: string
  label: string
  icon: React.ReactNode
  Panel: () => React.ReactNode
}

/**
 * 左侧分组。
 *
 * **扩展点**：新增一组只需在 `SECTIONS` 追加一项（label / icon / 面板），面板与 tab 由同一份数据驱动，无需补分支。
 * 「外观」只管色调与两个槽位选哪套主题；改动落在哪套主题的档案上由「主题编辑」决定。
 */
const SECTIONS = [
  { key: 'appearance', label: '外观', icon: <BgColorsOutlined />, Panel: AppearanceSettingsPanel },
  { key: 'theme', label: '主题编辑', icon: <HighlightOutlined />, Panel: ThemeEditorPanel },
  { key: 'batch-links', label: '批量添加链接', icon: <ImportOutlined />, Panel: BatchLinksSettingsPanel },
  { key: 'search', label: '搜索引擎', icon: <SearchOutlined />, Panel: SearchSettingsPanel },
  { key: 'auto-open', label: '每日自动跳转', icon: <ExportOutlined />, Panel: AutoOpenSettingsPanel },
  { key: 'data', label: '数据管理', icon: <DatabaseOutlined />, Panel: DataSettingsPanel },
  { key: 'about', label: '关于', icon: <InfoCircleOutlined />, Panel: AboutSettingsPanel },
] as const satisfies readonly SettingsSection[]

/** 分区键由 `SECTIONS` 推导，保证导航里有、面板分发里也有的键不会出现空档。 */
export type SettingsSectionKey = (typeof SECTIONS)[number]['key']

export type SettingsDialogProps = {
  /**
   * 打开时落在哪一页；缺省「外观」。由调用方决定而不是弹窗自己推：
   * 读盘失败的提示条要把用户直接送到「数据管理」（见 `views/DashboardPage.tsx`）。
   */
  initialSection?: SettingsSectionKey
  onClose: () => void
}

/**
 * 设置弹窗：左侧分组导航 + 右侧内容。
 *
 * 用 antd `Modal` 而非自绘浮层：无需 visualViewport 适配与打字焦点保持，焦点陷阱与 Esc 交给 Modal。
 * Portal 上的 `.ant-modal-root` 保留 antd CSS 变量作用域，弹窗内仍可用 `var(--ant-color-*)`。
 */
export function SettingsDialog({ initialSection, onClose }: SettingsDialogProps): React.ReactNode {
  const [active, setActive] = useState<SettingsSectionKey>(initialSection ?? 'appearance')
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
        <div className="dash-settings-nav">
          <nav className="dash-settings-nav-items" role="tablist" aria-orientation="vertical" aria-label="设置分组">
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

          {/* 仓库入口不切面板，刻意留在 tablist 外，避免多出能选中却无内容的 tab */}
          <a className="dash-settings-nav-item" href={'https://github.com/nel-1518/ffxiv-dash'} target="_blank" rel="noopener noreferrer">
            <span className="dash-settings-nav-icon" aria-hidden="true">
              <GithubOutlined />
            </span>
            GitHub
          </a>
        </div>

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
