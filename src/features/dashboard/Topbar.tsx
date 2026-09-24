import './dashboard.css'
import { useEffect, useRef } from 'react'
import { Button, Flex, Input } from 'antd'
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
  /** 是否处于编辑模式：决定「新建项目」与编辑开关的外观。 */
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
   *
   * 用 focus({ preventScroll: true }) 而不是 autoFocus：刷新后浏览器会恢复滚动
   * 位置，autoFocus 会把页面拽回顶部，preventScroll 才不会把这个位置弄丢。
   */
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true })
  }, [])

  /**
   * 在顶栏输入时打开弹窗。
   *
   * 键盘事件本身由浏览器插进顶栏输入框，这里只负责"一动手就把弹窗叫出来"；
   * 插进去的那个字符已经在 keyword 里了，弹窗输入框一挂载就能看到。
   * 注意这里用的是 `onStartTyping`（光标置末尾），而不是 `onOpenSearch` 的全选版：
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
   * 处理挂在**外层 div** 而不是 Input 上：`@rc-component/input` 的包装层自带一个
   * click 处理，里面会把焦点还给它自己的 input。挂在 Input 上时我们的
   * "聚焦弹窗输入框"先执行、它后执行，焦点会被拓回顶栏；
   * 挂到外层之后靠冒泡顺序，我们总是最后聚焦的那一个。
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
     * 顶栏就是**页面顶端的一整条元素**：它自己铺满视口宽度，
     * 同时靠 CSS 的 padding-inline 把内容卡在内容列里（与看板左右对齐）。
     *
     * `dash-card-surface` 表示"这一层的底色/投影/毛玻璃跟卡片同源"（见 global.css）：
     * 于是换主题时顶栏自动跟着走，银海那种"深色主题 + 浅色表面"的适配也不用再写一份。
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
            // 组合输入结束后再开窗（组合期间已经在 handleChange 里跳过了），
            // 同样用光标置末尾的版本：用户很可能接着往下打
            onCompositionEnd={onStartTyping}
            placeholder="搜索已保存的链接…"
            prefix={<SearchOutlined />}
            aria-label="搜索已保存的链接"
          />
        </div>

        {/*
          编辑开关：浏览时是普通图标按钮，进入编辑模式后变成主色实心圆并按成"完成"。
          排在新项目与设置之间，设置仍是最右（沿用既有约定）。
        */}
        <Button
          type={editMode ? 'primary' : 'text'}
          className={editMode ? 'dash-topbar-primary' : 'dash-topbar-icon'}
          icon={editMode ? <CheckOutlined /> : <EditOutlined />}
          onClick={onToggleEditMode}
          title={editMode ? '完成编辑' : '编辑'}
          aria-label={editMode ? '完成编辑' : '编辑'}
          aria-pressed={editMode}
        />

        {editMode ? (
          <Button
            type="primary"
            className="dash-topbar-primary"
            icon={<PlusOutlined />}
            onClick={onCreateGroup}
            title="新建项目"
            aria-label="新建项目"
          />
        ) : null}

        <Button
          type="text"
          className="dash-topbar-icon"
          icon={<SettingOutlined />}
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
        />
      </Flex>
    </Flex>
  )
}
