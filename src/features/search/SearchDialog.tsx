import './search.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Card, Input, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import type { InputRef } from 'antd'
import type { SearchMode } from './commands/types.ts'
import type { SearchRow } from './useLinkSearch.ts'

export type SearchDialogProps = {
  keyword: string
  /** 打开时是否全选已有内容；打字开窗时必须为 false（语义见 useLinkSearch）。 */
  selectAllOnOpen: boolean
  mode: SearchMode
  rows: SearchRow[]
  commandNotice: string | null
  copiedKey: string | null
  drillTitle: string | null
  activeIndex: number
  onKeywordChange: (value: string) => void
  onMoveActive: (delta: number) => void
  onActivate: (index: number) => void
  onSelect: (index: number) => void
  /** 从动作面板退回上一层结果列表。 */
  onBack: () => void
  onClose: () => void
}

function rowId(index: number): string {
  return `dash-search-row-${index}`
}

/**
 * 搜索弹窗：居中悬浮的结果卡片。
 * 刻意不用 antd 的 Modal：自绘 overlay 才能按 visualViewport 调整移动端键盘弹出时的尺寸，
 * 并把输入、结果列表与键盘导航作为一个整体控制（Esc 由 useLinkSearch 统一监听）。
 * 结果区按模式分发：links = 已保存链接 + 搜索引擎；command = 命令产出的行，两层命令（如 /i）选中即钻取。
 */
export function SearchDialog({
  keyword,
  selectAllOnOpen,
  mode,
  rows,
  commandNotice,
  copiedKey,
  drillTitle,
  activeIndex,
  onKeywordChange,
  onMoveActive,
  onActivate,
  onSelect,
  onBack,
  onClose,
}: SearchDialogProps): React.ReactNode {
  const overlayRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const activeIndicatorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<InputRef>(null)

  // 跟踪可视视口：移动端键盘弹出时可视区缩小，卡片要跟着缩，否则被顶出屏幕
  const [viewport, setViewport] = useState(() => ({
    height: window.visualViewport?.height ?? window.innerHeight,
    top: window.visualViewport?.offsetTop ?? 0,
  }))

  useEffect(() => {
    const vvp = window.visualViewport
    if (!vvp) {
      return
    }
    // 只在事件里 setState：初始值已由 useState 惰性初始化读过
    const update = () => setViewport({ height: vvp.height, top: vvp.offsetTop })
    vvp.addEventListener('resize', update)
    vvp.addEventListener('scroll', update)
    return () => {
      vvp.removeEventListener('resize', update)
      vvp.removeEventListener('scroll', update)
    }
  }, [])

  /*
   * 打开即聚焦输入框。用 useLayoutEffect：IME 的组合输入要求元素在本次按键处理里就已聚焦，
   * 等 paint 之后再聚焦会丢首键（配合 useLinkSearch 的 flushSync）。
   * 点击搜索框 / Tab 打开 → 全选；打字打开 → 光标放末尾，不能全选（否则下一个字符替掉整个选区）。
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

  // 高亮行跟随键盘移动（含钻取切换）时保持可见
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.dash-search-item.is-active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, rows, drillTitle])

  // 共享高亮条随当前行移动，避免逐行切 active 样式造成高亮闪跳
  useLayoutEffect(() => {
    const indicator = activeIndicatorRef.current
    const activeRow = listRef.current?.querySelector<HTMLElement>('.dash-search-item.is-active')
    if (!indicator || !activeRow) {
      indicator?.removeAttribute('data-ready')
      return
    }

    indicator.style.transform = `translateY(${activeRow.offsetTop}px)`
    indicator.style.height = `${activeRow.offsetHeight}px`
    indicator.setAttribute('data-ready', '')
  }, [activeIndex, rows, drillTitle])

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
  /** 当前命令（非命令模式为 null）；显式收窄一次，避免闭包里反复判 mode.kind。 */
  const command = mode.kind === 'command' ? mode.command : null

  /** 跳转类结果行（已保存链接 / 搜索引擎）：点击即关窗跳转。 */
  const renderLinkRow = (row: SearchRow, index: number) => (
    <a
      key={row.key}
      id={rowId(index)}
      className={`dash-search-item${index === activeIndex ? ' is-active' : ''}`}
      href={row.kind === 'link' || row.kind === 'engine' ? row.url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      title={row.kind === 'link' || row.kind === 'engine' ? row.url : undefined}
      onMouseEnter={() => onActivate(index)}
      onClick={onClose}
    >
      {row.kind === 'engine' && row.icon ? (
        <span className="dash-search-item-icon" aria-hidden="true">
          {row.icon}
        </span>
      ) : null}
      <span className="dash-search-item-text">
        <span className="dash-search-item-title">{row.title}</span>
        {row.kind === 'link' && row.abbreviation ? (
          <span className="dash-search-item-abbr">{row.abbreviation}</span>
        ) : null}
        {row.kind === 'link' && row.subtitle ? (
          <span className="dash-search-item-sub">{row.subtitle}</span>
        ) : null}
      </span>
      <span className="dash-search-item-enter" aria-hidden="true">
        ↵
      </span>
    </a>
  )

  /** 物品行：回车 / 点击进入该物品的动作面板（键帽提示「操作」）。 */
  const renderItemRow = (row: SearchRow, index: number) => {
    if (row.kind !== 'item') {
      return null
    }
    return (
      <div
        key={row.key}
        id={rowId(index)}
        className={`dash-search-item dash-search-action${index === activeIndex ? ' is-active' : ''}`}
        role="button"
        tabIndex={-1}
        title="查看可用操作"
        onMouseEnter={() => onActivate(index)}
        // mousedown 阻止默认行为：点击不把焦点从输入框抢走，键盘导航不中断
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(index)}
      >
        <span className="dash-search-item-text">
          <span className="dash-search-item-title">{row.title}</span>
          {/* 不可交易的物品上不了市场，查价无意义 —— 由接口的 IsUntradable 得出 */}
          {row.item.untradable ? <span className="dash-search-item-abbr">不可交易</span> : null}
          <span className="dash-search-item-sub">#{row.item.id}</span>
        </span>
        <span className="dash-search-item-enter" aria-hidden="true">
          操作
        </span>
      </div>
    )
  }

  /**
   * 动作行：copy 点击即复制（弹窗保持打开，可连续复制）并给行内反馈；
   * open 用真链接（可中键新标签），回车统一交状态中枢 window.open。
   */
  const renderActionRow = (row: SearchRow, index: number) => {
    if (row.kind !== 'action') {
      return null
    }
    const copied = copiedKey === row.key
    const content = (
      <>
        <span className="dash-search-item-text">
          <span className="dash-search-item-title">{row.title}</span>
        </span>
        {row.note ? <span className="dash-search-item-note">{row.note}</span> : null}
        <span className={`dash-search-item-enter${copied ? ' is-copied' : ''}`} aria-hidden="true">
          {copied ? '已复制' : row.run.type === 'copy' ? '复制' : row.run.type === 'fill' ? '输入' : '打开'}
        </span>
      </>
    )

    if (row.run.type === 'open') {
      return (
        <a
          key={row.key}
          id={rowId(index)}
          className={`dash-search-item${index === activeIndex ? ' is-active' : ''}`}
          href={row.run.url}
          target="_blank"
          rel="noopener noreferrer"
          title={row.run.url}
          onMouseEnter={() => onActivate(index)}
          onClick={onClose}
        >
          {content}
        </a>
      )
    }

    return (
      <div
        key={row.key}
        id={rowId(index)}
        className={`dash-search-item dash-search-action${index === activeIndex ? ' is-active' : ''}`}
        role="button"
        tabIndex={-1}
        title="点击复制"
        onMouseEnter={() => onActivate(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(index)}
      >
        {content}
      </div>
    )
  }

  /** 动作面板表头：返回入口 + 当前项标题 + Esc 提示。 */
  const renderDrillHead = () => (
    <div className="dash-search-section dash-search-drill-head">
      <button
        type="button"
        className="dash-search-back"
        // 与动作行同款：点击不抢走输入框焦点
        onMouseDown={(event) => event.preventDefault()}
        onClick={onBack}
      >
        ‹ 返回
      </button>
      <span className="dash-search-drill-title">{drillTitle}</span>
      <span className="dash-search-drill-hint">Esc 返回</span>
    </div>
  )

  /** 命令模式结果区：按第一行的类型决定渲染形态（每个命令每层只产出一种行）。 */
  const renderCommandResults = () => {
    if (command === null) {
      return null
    }
    if (rows.length === 0) {
      return (
        <div className="dash-search-hint">
          <Typography.Text type="secondary">{commandNotice ?? command.hint}</Typography.Text>
        </div>
      )
    }

    // 一层：物品列表（选中即钻取）
    if (rows[0].kind === 'item') {
      return (
        <>
          <div className="dash-search-section">{command.resultTitle}</div>
          {rows.map((row, index) => renderItemRow(row, index))}
        </>
      )
    }

    // 二层：动作面板；无二层的命令（税率）直接列动作行
    return (
      <>
        {drillTitle ? renderDrillHead() : <div className="dash-search-section">{command.resultTitle}</div>}
        {rows.map((row, index) => renderActionRow(row, index))}
      </>
    )
  }

  /** 链接模式结果区：保持「已保存的链接 + 搜索引擎」两段结构。 */
  const renderLinkResults = () => {
    if (trimmed === '') {
      // 空关键词时 rows 就是可用命令（fill 动作行），与普通结果一样可 ↑↓ 选中
      return (
        <>
          <div className="dash-search-hint is-tight">
            <Typography.Text type="secondary">输入关键词搜索，或选择下方命令：</Typography.Text>
          </div>
          {rows.map((row, index) => renderActionRow(row, index))}
        </>
      )
    }

    const engineStart = rows.findIndex((row) => row.kind === 'engine')
    const linkRows = engineStart < 0 ? rows : rows.slice(0, engineStart)
    const engineRows = engineStart < 0 ? [] : rows.slice(engineStart)

    return (
      <>
        {linkRows.length > 0 ? (
          <>
            <div className="dash-search-section">已保存的链接</div>
            {linkRows.map((row, index) => renderLinkRow(row, index))}
          </>
        ) : (
          <div className="dash-search-hint">
            <Typography.Text type="secondary">没有匹配的链接</Typography.Text>
          </div>
        )}

        {engineRows.length > 0 ? (
          <>
            <div className="dash-search-section">搜索引擎</div>
            {engineRows.map((row, index) => renderLinkRow(row, linkRows.length + index))}
          </>
        ) : null}
      </>
    )
  }

  const placeholder = command?.placeholder ?? '搜索已保存的链接…'
  const ariaLabel = command?.placeholder ?? '搜索已保存的链接'

  return (
    <div
      className="dash-search-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
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
            placeholder={placeholder}
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onKeyDown={handleKeyDown}
            prefix={<SearchOutlined />}
            allowClear
            aria-label={ariaLabel}
            aria-activedescendant={rows.length === 0 ? undefined : rowId(activeIndex)}
          />
        </div>

        <div className="dash-search-results" ref={listRef}>
          <div className="dash-search-active-indicator" ref={activeIndicatorRef} aria-hidden="true" />
          {command === null ? renderLinkResults() : renderCommandResults()}
        </div>
      </Card>
    </div>
  )
}
