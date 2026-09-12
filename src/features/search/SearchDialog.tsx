import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Card, Input, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { InputRef } from 'antd'
import type { SearchRow } from './useLinkSearch.ts'

export type SearchDialogProps = {
  keyword: string
  /** 打开时是否全选已有内容；打字开窗时必须为 false。 */
  selectAllOnOpen: boolean
  rows: SearchRow[]
  activeIndex: number
  onKeywordChange: (value: string) => void
  onMoveActive: (delta: number) => void
  onActivate: (index: number) => void
  onSelect: (index: number) => void
  onClose: () => void
}

function rowId(index: number): string {
  return `dash-search-row-${index}`
}

/**
 * 搜索弹窗：居中悬浮的结果卡片。
 *
 * 刻意**不用 antd 的 Modal**：Modal 会 portal 到 `document.body`，
 * 从而逃出 ConfigProvider 的 `.css-var-*` 容器，`var(--ant-color-*)` 全部取不到值。
 * 这里改成内联 overlay，既能继续用 antd 变量，也和参考实现一致。
 * 代价是焦点陷阱与 Esc 要自己处理（Esc 在 useLinkSearch 里统一监听）。
 */
export function SearchDialog({
  keyword,
  selectAllOnOpen,
  rows,
  activeIndex,
  onKeywordChange,
  onMoveActive,
  onActivate,
  onSelect,
  onClose,
}: SearchDialogProps): React.ReactNode {
  const overlayRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<InputRef>(null)

  // 跟踪可视视口：移动端键盘弹出时可视区会缩小，卡片要跟着缩，否则会被顶出屏幕
  const [viewport, setViewport] = useState(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  }))

  useEffect(() => {
    const vvp = window.visualViewport
    if (!vvp) {
      return
    }
    // 只在事件里 setState；初始值已经由 useState 的惰性初始化读过了
    const update = () => setViewport({ height: vvp.height, top: vvp.offsetTop })
    vvp.addEventListener('resize', update)
    vvp.addEventListener('scroll', update)
    return () => {
      vvp.removeEventListener('resize', update)
      vvp.removeEventListener('scroll', update)
    }
  }, [])

  /*
   * 打开即聚焦输入框。
   *
   * 用 useLayoutEffect 而不是 useEffect：IME 的组合输入要求元素在本次按键处理里
   * 就已经聚焦，等 paint 之后再聚焦会丢掉首键（配合 useLinkSearch 里的 flushSync）。
   *
   * 光标位置分两种：
   * - 点击搜索框 / 按 Tab 打开：全选，直接输入即可替换旧关键词；
   * - 打字打开：光标放末尾。这里**不能**全选，否则用户紧接着敲的下一个字符
   *   会替掉整个选区，看起来就像丢了一个字母。
   */
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) {
      return
    }
    el.focus()
    const len = el.input?.value.length ?? 0
    if (len === 0) {
      return
    }
    if (selectAllOnOpen) {
      el.setSelectionRange(0, len)
    } else {
      el.setSelectionRange(len, len)
    }
  }, [selectAllOnOpen])

  // 点击遮罩空白处关闭
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.target === overlayRef.current) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // 高亮行跟随键盘移动时保持可见
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.dash-search-item.is-active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, rows])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 输入法正在组合时（Enter 是在确认候选词）不参与结果选择
    if (event.nativeEvent.isComposing) {
      return
    }
    if (event.key === 'ArrowDown') {
      if (rows.length > 0) {
        event.preventDefault()
        onMoveActive(1)
      }
      return
    }
    if (event.key === 'ArrowUp') {
      if (rows.length > 0) {
        event.preventDefault()
        onMoveActive(-1)
      }
      return
    }
    if (event.key === 'Enter' && rows.length > 0) {
      event.preventDefault()
      onSelect(activeIndex)
    }
  }

  const trimmed = keyword.trim()
  const linkCount = rows.findIndex((row) => row.kind === 'engine')
  const linkRows = linkCount < 0 ? rows : rows.slice(0, linkCount)
  const engineRows = linkCount < 0 ? [] : rows.slice(linkCount)

  const renderRow = (row: SearchRow, index: number) => (
    <a
      key={row.key}
      id={rowId(index)}
      className={`dash-search-item${index === activeIndex ? ' is-active' : ''}`}
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      title={row.url}
      onMouseEnter={() => onActivate(index)}
      onClick={onClose}
    >
      {row.icon ? (
        <span className="dash-search-item-icon" aria-hidden="true">
          {row.icon}
        </span>
      ) : null}
      <span className="dash-search-item-text">
        <span className="dash-search-item-title">{row.title}</span>
        {row.subtitle ? <span className="dash-search-item-sub">{row.subtitle}</span> : null}
      </span>
      <span className="dash-search-item-enter" aria-hidden="true">
        ↵
      </span>
    </a>
  )

  return (
    <div
      className="dash-search-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="搜索已保存的链接"
      style={
        {
          '--vv-top': `${viewport.top}px`,
          '--vv-height': `${viewport.height}px`,
        } as React.CSSProperties
      }
    >
      <Card className="dash-search-card" variant="borderless">
        <div className="dash-search-input-row">
          <Input
            ref={inputRef}
            size="large"
            className="dash-search-input"
            placeholder="搜索已保存的链接…"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onKeyDown={handleKeyDown}
            prefix={<SearchOutlined />}
            allowClear
            aria-label="搜索已保存的链接"
            aria-activedescendant={trimmed === '' ? undefined : rowId(activeIndex)}
          />
        </div>

        <div className="dash-search-results" ref={listRef}>
          {trimmed === '' ? (
            <div className="dash-search-hint">
              <Typography.Text type="secondary">输入关键词，在已保存的链接里搜索</Typography.Text>
            </div>
          ) : (
            <>
              {linkRows.length > 0 ? (
                <>
                  <div className="dash-search-section">已保存的链接</div>
                  {linkRows.map((row, index) => renderRow(row, index))}
                </>
              ) : (
                <div className="dash-search-hint">
                  <Typography.Text type="secondary">没有匹配的链接</Typography.Text>
                </div>
              )}

              {engineRows.length > 0 ? (
                <>
                  <div className="dash-search-section">搜索引擎</div>
                  {engineRows.map((row, index) => renderRow(row, linkRows.length + index))}
                </>
              ) : null}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
