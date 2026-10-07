import './dashboard.css'
import { useEffect, useRef } from 'react'
import { Button, Flex, Input, Tooltip } from 'antd'
import { CheckOutlined, EditOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { TopbarClock } from './TopbarClock.tsx'
import type { InputRef } from 'antd'

export type TopbarProps = {
  keyword: string
  onKeywordChange: (value: string) => void
  /** 点击搜索框：打开弹窗并全选已有内容，直接输入即可替换。 */
  onOpenSearch: () => void
  /** 开始打字：打开弹窗，但光标留在末尾。 */
  onStartTyping: () => void
  /** 是否处于编辑模式：决定「新建分组」与编辑开关的外观。 */
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

  /*
   * 进页就把光标放进搜索框，省掉"先点一下再打字"。
   * 用 focus({ preventScroll: true }) 而不是 autoFocus：刷新后浏览器会恢复滚动位置，
   * autoFocus 会把页面拽回顶部。
   */
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true })
  }, [])

  /**
   * 在顶栏输入时打开弹窗。
   * 键盘事件由浏览器插进顶栏输入框，这里只负责"一动手就把弹窗叫出来"。
   * 用 `onStartTyping`（光标置末尾）而不是 `onOpenSearch` 的全选版：
   * 全选会把用户紧接着敲的下一个字符替掉。
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    onKeywordChange(value)
    // 清空（点 ✕ 或删光）不是"要搜索"，别把弹窗叫出来
    if (value === '') {
      return
    }
    // 输入法还在组合时不抢焦点：这时把焦点移到弹窗会打断候选词
    const composing = (event.nativeEvent as Event & { isComposing?: boolean }).isComposing === true
    if (composing) {
      return
    }
    onStartTyping()
  }

  /**
   * 点击搜索框即打开弹窗。
   *
   * 处理挂在外层 div 而不是 Input 上：`@rc-component/input` 的包装层自带 click 处理，
   * 会把焦点还给它自己的 input；挂在外层靠冒泡顺序，我们总是最后聚焦的那一个。
   * 清空按钮的点击不算"要搜索"，单独放行。
   */
  const handleSearchBoxClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.ant-input-clear-icon')) {
      return
    }
    onOpenSearch()
  }

  return (
    /*
     * 顶栏是页面顶端的一整条元素：自己铺满视口宽度，内容靠 CSS padding-inline 卡进内容列。
     * `dash-card-surface` 让顶栏的底色/投影/毛玻璃与卡片同源（见 global.css），
     * 换主题时顶栏自动跟着走。
     */
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
