import './dashboard.css'
import { useEffect, useRef } from 'react'
import { Button, Flex, Input, Tooltip } from 'antd'
import { CheckOutlined, EditOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { TopbarClock } from './TopbarClock.tsx'
import type { InputRef } from 'antd'

export type TopbarProps = {
  keyword: string
  onKeywordChange: (value: string) => void
  /** 点击搜索框：打开弹窗并全选，直接输入即可替换。 */
  onOpenSearch: () => void
  /** 开始打字：打开弹窗，光标留在末尾。 */
  onStartTyping: () => void
  /** 是否编辑模式：决定「新建分组」与编辑开关的外观。 */
  editMode: boolean
  onToggleEditMode: () => void
  onCreateGroup: () => void
  /** 打开设置。 */
  onOpenSettings: () => void
}

/** 顶栏：品牌 + 全局操作。 */
export function Topbar({
  keyword,
  onKeywordChange,
  onOpenSearch,
  onStartTyping,
  editMode,
  onToggleEditMode,
  onCreateGroup,
  onOpenSettings,
}: TopbarProps): React.ReactNode {
  const searchRef = useRef<InputRef>(null)

  // 进页即聚焦搜索框；用 focus({ preventScroll: true }) 而非 autoFocus——刷新恢复滚动位置时会把页面拽回顶部
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true })
  }, [])

  /**
   * 顶栏一有输入就打开弹窗；用光标置末尾的 `onStartTyping` 而非全选版——
   * 全选会把用户紧接着敲的下一个字符替掉。
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    onKeywordChange(value)
    // 清空（点 ✕ 或删光）不是「要搜索」，不叫弹窗
    if (value === '') {
      return
    }
    // 输入法组合期间不抢焦点：移焦点会打断候选词
    const composing = (event.nativeEvent as Event & { isComposing?: boolean }).isComposing === true
    if (composing) {
      return
    }
    onStartTyping()
  }

  /**
   * 点击搜索框即开弹窗。挂在外层 div 而非 Input：`@rc-component/input` 包装层自带 click 处理、
   * 会把焦点还给自己的 input；挂外层靠冒泡顺序我们总是最后聚焦的一个。
   */
  const handleSearchBoxClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.ant-input-clear-icon')) {
      return
    }
    onOpenSearch()
  }

  return (
    // 顶栏铺满视口宽度、内容靠 padding-inline 卡进内容列；`dash-card-surface` 让底色/投影/毛玻璃与卡片同源（见 global.css），换主题时自动跟随
    <Flex
      className="dash-topbar dash-card-surface"
      align="center"
      justify="space-between"
      gap={18}
      wrap
    >
      <Flex className="dash-topbar-brand" align="center" gap={12}>
        <span className="dash-topbar-accent" aria-hidden="true" />
        <TopbarClock />
      </Flex>

      <Flex className="dash-topbar-actions" gap={12} align="center">
        <div className="dash-topbar-search" onClick={handleSearchBoxClick}>
          <Input
            ref={searchRef}
            allowClear
            value={keyword}
            onChange={handleChange}
            // 组合输入结束后再开窗（组合期间已在 handleChange 跳过）；同样用光标置末尾的版本
            onCompositionEnd={onStartTyping}
            placeholder="搜索已保存的链接…"
            prefix={<SearchOutlined />}
            // Tab 键帽：把「按 Tab 打开搜索弹窗」摆到明面；纯装饰（aria-hidden），说明在 Tooltip；窄屏无 Tab 键由 CSS 隐藏
            suffix={
              <Tooltip title="按 Tab 键打开搜索弹窗">
                <span className="dash-topbar-kbd" aria-hidden="true">
                  Tab
                </span>
              </Tooltip>
            }
            aria-label="搜索已保存的链接"
          />
        </div>

        {editMode ? (
          <Tooltip key="done" title="完成编辑">
            <Button
              type="primary"
              className="dash-topbar-primary"
              icon={<CheckOutlined />}
              onClick={onToggleEditMode}
              aria-label="完成编辑"
            />
          </Tooltip>
        ) : (
          <Tooltip key="edit" title="编辑">
            <Button
              type="text"
              className="dash-topbar-icon"
              icon={<EditOutlined />}
              onClick={onToggleEditMode}
              aria-label="编辑"
            />
          </Tooltip>
        )}

        {editMode ? (
          <Tooltip title="新建分组">
            <Button
              type="primary"
              className="dash-topbar-primary"
              icon={<PlusOutlined />}
              onClick={onCreateGroup}
              aria-label="新建分组"
            />
          </Tooltip>
        ) : null}

        <Tooltip title="设置">
          <Button
            type="text"
            className="dash-topbar-icon"
            icon={<SettingOutlined />}
            onClick={onOpenSettings}
            aria-label="设置"
          />
        </Tooltip>
      </Flex>
    </Flex>
  )
}
