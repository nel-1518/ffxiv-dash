import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { subscribeBoard } from '../../state/board-store.ts'
import { useSearchEngines } from '../../core/search/hooks.ts'
import { buildEngineUrl, toSearchEngine } from './engines.tsx'
import { getLinkIndex } from './link-index.ts'
import { searchLinks } from './searchLinks.ts'

/** 结果列表里的一行：一条已保存的链接，或一个搜索引擎跳转。 */
export type SearchRow = {
  key: string
  kind: 'link' | 'engine'
  /** 主文案。链接是名称，引擎是「用 xxx 搜索 …」。 */
  title: string
  /** 次文案：链接显示描述（缺省回退网址），引擎不需要。 */
  subtitle?: string
  /** 点击 / 回车要打开的地址。 */
  url: string
  icon?: React.ReactNode
}

export type UseLinkSearchOptions = {
  /**
   * 为 true 时完全不接管快捷键。
   * 编辑弹窗打开时必须传 true：那时 Tab 要留给表单字段之间的移动。
   */
  suspended: boolean
}

export type LinkSearch = {
  keyword: string
  open: boolean
  /** 本次打开是否要把输入框已有内容全选（仅「点击搜索框 / Tab」时为 true）。 */
  selectAllOnOpen: boolean
  rows: SearchRow[]
  activeIndex: number
  handleKeywordChange: (value: string) => void
  /** 「点击搜索框 / 按 Tab」：全选已有内容，直接输入即可替换。 */
  handleOpenForReplace: () => void
  /** 「开始打字」：光标留在末尾，否则会把紧接着的下一个按键替换掉。 */
  handleOpenForTyping: () => void
  handleClose: () => void
  handleMoveActive: (delta: number) => void
  handleActivate: (index: number) => void
  handleSelect: (index: number) => void
}

/** IME 组合首键。`keyCode === 229` 是老写法，部分浏览器/输入法至今仍在用。 */
function isImeStart(event: KeyboardEvent): boolean {
  if (event.key === 'Process') {
    return true
  }
  return (event as KeyboardEvent & { keyCode: number }).keyCode === 229
}

/** 清除 FF14 物品名称中的特殊字符。 */
function cleanPastedText(text: string): string {
  return text.replace(/[\uE03C\uE0BB]/g, '')
}

/**
 * 搜索弹窗的状态中枢：关键词、结果行、高亮下标，以及全局键盘。
 *
 * 键盘行为对齐 how-much 的 SearchCard 方案：
 * - `Esc` 关窗；`Tab` 无条件开关（编辑弹窗打开时整体让位，见 `suspended`）；
 * - 页面任意空白处敲字母/数字、或用输入法起手，都会开窗并接管后续输入；
 * - `↑`/`↓` 移动高亮（首尾循环回绕），`Enter` 打开当前行。
 */
export function useLinkSearch({ suspended }: UseLinkSearchOptions): LinkSearch {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectAllOnOpen, setSelectAllOnOpen] = useState(false)
  const searchEngines = useSearchEngines()

  /*
   * 搜索只关心链接，所以订阅拍平后的索引而不是整份 doc：
   * 索引在链接集合未变时引用不变（见 link-index.ts），
   * 因此组件卡片的任何改动都不会惊动这里的调用方（`DashboardPage`）。
   */
  const links = useSyncExternalStore(subscribeBoard, getLinkIndex)

  /**
   * 开窗并同步交出焦点。
   *
   * `flushSync` 是刻意的：IME 的 composition 事件必须落在"已经聚焦"的元素上，
   * 而焦点得在本次按键处理里就交出去；等 effect 再聚焦就晚了，
   * 中文会打不进弹窗输入框。
   *
   * `selectAll` 只在"点击搜索框 / 按 Tab"时为 true。打字开窗时必须传 false：
   * 弹窗输入框挂载后如果全选，用户紧接着敲的下一个字符会替掉整个选区，
   * 看起来就像吞了一个字母。
   */
  const openDialog = useCallback((selectAll: boolean) => {
    flushSync(() => {
      setSelectAllOnOpen(selectAll)
      setOpen(true)
      setActiveIndex(0)
    })
  }, [])

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value)
    setActiveIndex(0)
  }, [])

  const handleOpenForReplace = useCallback(() => {
    if (open) {
      return
    }
    openDialog(true)
  }, [open, openDialog])

  const handleOpenForTyping = useCallback(() => {
    if (open) {
      return
    }
    openDialog(false)
  }, [open, openDialog])

  const handleClose = useCallback(() => setOpen(false), [])

  const handleActivate = useCallback((index: number) => setActiveIndex(index), [])

  const rows = useMemo<SearchRow[]>(() => {
    const linkRows = searchLinks(links, keyword).map<SearchRow>((hit) => ({
      key: `link:${hit.item.id}`,
      kind: 'link',
      title: hit.item.name,
      subtitle: hit.item.desc || hit.item.url,
      url: hit.item.url,
    }))

    // 没有关键词就没有可跳转的查询，引擎行整体不出现
    const trimmed = keyword.trim()
    const engineRows =
      trimmed === ''
        ? []
        : searchEngines.filter((config) => config.enabled && config.urlTemplate.includes('%s')).map<SearchRow>((config) => {
            const engine = toSearchEngine(config)
            return {
              key: `engine:${engine.key}`,
              kind: 'engine',
              title: `用『${engine.name}』搜索 “${trimmed}”`,
              url: buildEngineUrl(engine, trimmed),
              icon: engine.icon,
            }
          })

    return [...linkRows, ...engineRows]
  }, [links, keyword, searchEngines])

  // 结果条数变化时把高亮收回范围内。
  // 用"渲染期间调整 state"而不是 effect：effect 里同步 setState 会被
  // react-hooks/set-state-in-effect 拦下（本仓库已有先例）。
  const [prevRowCount, setPrevRowCount] = useState(0)
  if (prevRowCount !== rows.length) {
    setPrevRowCount(rows.length)
    if (activeIndex > rows.length - 1) {
      setActiveIndex(Math.max(0, rows.length - 1))
    }
  }

  const handleMoveActive = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        const count = rows.length
        if (count === 0) {
          return 0
        }
        // 循环回绕：最后一条再往下回到第一条，第一条再往上跳到最一条。
        // 取模两次是为了让负的 delta 也落在 [0, count) 里
        return (((prev + delta) % count) + count) % count
      })
    },
    [rows.length],
  )

  const handleSelect = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row) {
        return
      }
      window.open(row.url, '_blank', 'noopener,noreferrer')
      setOpen(false)
    },
    [rows],
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!open) {
          return
        }
        event.preventDefault()
        setOpen(false)
        return
      }

      // 编辑弹窗打开时整体让位：那时 Tab 必须在表单字段之间正常移动
      if (suspended) {
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      if (event.key === 'Tab') {
        // 刻意无条件劫持 Tab：关窗时开窗、开窗时关窗
        event.preventDefault()
        if (open) {
          setOpen(false)
          return
        }
        openDialog(true)
        return
      }

      if (open) {
        return
      }

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }
      if (event.isComposing) {
        return
      }

      // IME 组合首键：只开窗并把焦点交出去，**不**阻止默认行为，
      // 让后续的 composition 事件直接落在弹窗输入框里
      if (isImeStart(event)) {
        openDialog(false)
        return
      }

      if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
        // 这里必须阻止默认行为：开窗后焦点已经移到弹窗输入框，
        // 不拦住的话浏览器会把同一个字符再插一遍，变成两个字母
        event.preventDefault()
        openDialog(false)
        setKeyword(event.key)
        setActiveIndex(0)
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, suspended, openDialog])

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      if (suspended) {
        return
      }

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }

      const text = cleanPastedText(event.clipboardData?.getData('text') ?? '')
      if (text === '') {
        return
      }

      event.preventDefault()
      if (!open) {
        openDialog(false)
      }
      setKeyword(text)
      setActiveIndex(0)
    }

    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [open, suspended, openDialog])

  return {
    keyword,
    open,
    selectAllOnOpen,
    rows,
    activeIndex,
    handleKeywordChange,
    handleOpenForReplace,
    handleOpenForTyping,
    handleClose,
    handleMoveActive,
    handleActivate,
    handleSelect,
  }
}
