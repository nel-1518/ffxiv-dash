import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { App } from 'antd'
import { subscribeBoard } from '../../state/board-store.ts'
import { useSearchEngines } from '../../core/search/hooks.ts'
import { buildEngineUrl, toSearchEngine } from './engines.tsx'
import { getLinkIndex } from './link-index.ts'
import { searchLinks } from './searchLinks.ts'
import { parseCommand } from './commands/parse.ts'
import { buildWikiUrl } from './commands/item.ts'
import { COMMANDS } from './commands/index.ts'
import type { ActionRow, CommandRow, SearchMode } from './commands/types.ts'

/** 远程检索的防抖间隔：连续输入只发最后一次请求。 */
const REMOTE_DEBOUNCE_MS = 250

/** 远程检索的结果，连同它属于哪个查询串（用于判废乱序回来的旧结果）。 */
type RemoteState =
  | { query: string; rows: CommandRow[] }
  | { query: string; error: string }

/** 结果列表里的一条已保存链接。 */
export type LinkRow = {
  key: string
  kind: 'link'
  title: string
  /** 链接的缩写（没设就不渲染）。 */
  abbreviation?: string
  /** 次文案：链接显示描述（缺省回退网址）。 */
  subtitle?: string
  url: string
}

/** 结果列表里的一个搜索引擎跳转。 */
export type EngineRow = {
  key: string
  kind: 'engine'
  title: string
  url: string
  icon?: React.ReactNode
}

/** 结果列表里的一行：跳转链接 / 搜索引擎，或命令产出的动作行、物品行。 */
export type SearchRow = LinkRow | EngineRow | CommandRow

export type UseLinkSearchOptions = {
  /** 为 true 时完全不接管快捷键（编辑弹窗打开时须传 true：Tab 要留给表单字段移动）。 */
  suspended: boolean
}

export type LinkSearch = {
  keyword: string
  open: boolean
  /** 本次打开是否要把输入框已有内容全选（仅「点击搜索框 / Tab」时为 true）。 */
  selectAllOnOpen: boolean
  /** 当前所处的模式：普通链接搜索，还是某个斜杠命令。 */
  mode: SearchMode
  rows: SearchRow[]
  /** 命令模式下的空态 / 状态提示（links 模式或结果非空时为 null）。 */
  commandNotice: string | null
  /** 刚执行成功的行 key，用于行内「已复制」反馈；无则为 null。 */
  copiedKey: string | null
  /** 非空 = 已钻入某项的动作面板，值为该项标题（用于表头）。 */
  drillTitle: string | null
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
  /** 从动作面板退回上一层结果列表。 */
  handleBack: () => void
}

/** IME 组合首键。`keyCode === 229` 是老写法，部分浏览器/输入法至今仍在用。 */
function isImeStart(event: KeyboardEvent): boolean {
  if (event.key === 'Process') {
    return true
  }
  return (event as KeyboardEvent & { keyCode: number }).keyCode === 229
}

/** 清除 FF14 私有区字符（物品名称自带，粘贴接管前先剔除）。 */
function cleanPastedText(text: string): string {
  return text.replace(/[\uE03C\uE0BB]/g, '')
}

/** 剪贴板兜底：非安全上下文（http）下 `navigator.clipboard` 可能不可用，退回隐藏 textarea + `execCommand('copy')`，返回是否成功。 */
function copyTextFallback(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '-9999px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(area)
  return ok
}

/**
 * 搜索弹窗的状态中枢：关键词、模式、结果行、高亮下标，以及全局键盘（对齐 how-much 的 SearchCard）。
 * 键盘契约：Esc 先退钻取层再关窗；Tab 无条件开/关窗（suspended 时让位给表单字段）；空白处敲字母、
 * 数字、`/` 或 IME 起手都开窗并接管输入；↑↓ 循环回绕移高亮，Enter 执行当前行。
 * 斜杠命令与二级动作面板在这里统一接入，本层对具体命令无感知。
 */
export function useLinkSearch({ suspended }: UseLinkSearchOptions): LinkSearch {
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectAllOnOpen, setSelectAllOnOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  /** 钻取到的结果行（非空 = 正在看它的动作面板）。 */
  const [drillRow, setDrillRow] = useState<CommandRow | null>(null)
  /** 异步命令的检索结果（同步命令恒为 null）。 */
  const [remote, setRemote] = useState<RemoteState | null>(null)
  const searchEngines = useSearchEngines()

  // 订阅拍平索引而非整份 doc：索引在链接集合未变时引用不变（见 link-index.ts），
  // 组件卡的其他改动不会惊动这里的调用方（DashboardPage）。
  const links = useSyncExternalStore(subscribeBoard, getLinkIndex)

  // 解析命令前缀：命中即进入命令模式（`parsed` 为 null 则是普通链接搜索）
  const parsed = useMemo(() => parseCommand(keyword), [keyword])
  const mode = useMemo<SearchMode>(
    () => (parsed ? { kind: 'command', command: parsed.command, query: parsed.query } : { kind: 'links' }),
    [parsed],
  )

  /*
   * 异步命令统一驱动：防抖 → 请求 → 判废。三要点：
   * ① 结果连查询串存，渲染时比对查询串即可判废，不在 effect 里手动清空；
   * ② AbortController 在依赖变化/卸载时中止上一次请求，失败回调先看 aborted 再报错；
   * ③ 查询为空直接不请求（避免了 effect 里同步 setState）。
   */
  const loadRows = parsed?.command.loadRows
  const commandQuery = parsed?.query ?? ''
  useEffect(() => {
    if (!loadRows || commandQuery.trim() === '') {
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadRows(commandQuery, controller.signal).then(
        (next) => {
          if (!controller.signal.aborted) {
            setRemote({ query: commandQuery, rows: next })
          }
        },
        (error: unknown) => {
          if (controller.signal.aborted) {
            return
          }
          setRemote({
            query: commandQuery,
            error: error instanceof Error ? error.message : '未知错误',
          })
        },
      )
    }, REMOTE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadRows, commandQuery])

  /** 复制成功后的行内反馈计时器；卸载时清理，避免在已卸载组件上 setState。 */
  const copyTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current)
      }
    },
    [],
  )

  const markCopied = useCallback((key: string) => {
    setCopiedKey(key)
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current)
    }
    copyTimer.current = window.setTimeout(() => setCopiedKey(null), 1200)
  }, [])

  /** 把文本（裸数字 / 物品名 / ID）复制到剪贴板。 */
  const handleCopy = useCallback(
    (key: string, text: string) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
          () => markCopied(key),
          () => {
            if (copyTextFallback(text)) {
              markCopied(key)
            } else {
              message.error('复制失败，请手动选取')
            }
          },
        )
        return
      }
      if (copyTextFallback(text)) {
        markCopied(key)
      } else {
        message.error('复制失败，请手动选取')
      }
    },
    [markCopied, message],
  )

  /**
   * 开窗并同步交焦点：flushSync 保证焦点在本次按键处理内交出 —— IME 的 composition 事件
   * 必须落在已聚焦元素上，异步（effect）聚焦会导致中文打不进输入框；
   * selectAll 仅「点击搜索框 / Tab」为 true，打字开窗必须 false（否则全选会替掉下一个字符）。
   */
  const openDialog = useCallback((selectAll: boolean) => {
    flushSync(() => {
      setSelectAllOnOpen(selectAll)
      setOpen(true)
      setActiveIndex(0)
      // 每次开窗都从一层开始，避免上次钻取的面板残留
      setDrillRow(null)
    })
  }, [])

  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value)
    setActiveIndex(0)
    // 关键词一变，钻取的那条结果可能已经不在列表里了，退回一层
    setDrillRow(null)
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

  const handleClose = useCallback(() => {
    setOpen(false)
    setDrillRow(null)
  }, [])

  const handleActivate = useCallback((index: number) => setActiveIndex(index), [])

  const handleBack = useCallback(() => {
    setDrillRow(null)
    setActiveIndex(0)
  }, [])

  /** 一层结果：命令产出，或原有的链接 + 引擎（空关键词时则是可用命令列表）。 */
  const primaryRows = useMemo<SearchRow[]>(() => {
    // 命令模式：整块结果由命令产出，链接与引擎行让位
    if (parsed) {
      // 远程命令：按查询串判废 —— 未回来（或回来的是上一次的）就先空着，不闪旧结果
      if (parsed.command.loadRows) {
        return remote && remote.query === parsed.query && !('error' in remote) ? remote.rows : []
      }
      return parsed.command.buildRows?.(parsed.query) ?? []
    }

    const trimmed = keyword.trim()

    // 空关键词时列出可用命令（开窗即见、可 ↑↓/Enter 选中），选中即 fill「/<命令> 」切入命令模式
    if (trimmed === '') {
      return COMMANDS.map<ActionRow>((item) => ({
        key: `command:${item.key}`,
        kind: 'action',
        title: item.placeholder,
        note: `/${item.key}`,
        run: { type: 'fill', text: `/${item.key} ` },
      }))
    }

    const linkRows = searchLinks(links, keyword).map<LinkRow>((hit) => ({
      key: `link:${hit.item.id}`,
      kind: 'link',
      title: hit.item.name,
      abbreviation: hit.item.abbreviation,
      subtitle: hit.item.desc || hit.item.url,
      url: hit.item.url,
    }))

    const engineRows = searchEngines
      .filter((config) => config.enabled && config.urlTemplate.includes('%s'))
      .map<EngineRow>((config) => {
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
  }, [parsed, links, keyword, searchEngines, remote])

  /** 二层动作面板：仅「已钻取 + 命令实现 buildActions + 动作非空」时成立；状态中枢不认识具体命令（泛化点）。 */
  const drillActions = useMemo<ActionRow[] | null>(() => {
    if (!drillRow || !parsed?.command.buildActions) {
      return null
    }
    const actions = parsed.command.buildActions(drillRow)
    return actions.length > 0 ? actions : null
  }, [drillRow, parsed])

  const rows = useMemo<SearchRow[]>(() => drillActions ?? primaryRows, [drillActions, primaryRows])

  const drillTitle = drillActions ? (drillRow?.title ?? null) : null

  /** 命令模式的空态 / 状态提示；命令自己的 `notice` 说不清时回退到通用 hint。 */
  const commandNotice = useMemo(() => {
    if (!parsed) {
      return null
    }
    const command = parsed.command

    // 远程命令：先报「搜索中 / 失败」，结果到了再交给命令自己的 notice 判断有没有匹配
    if (command.loadRows) {
      if (parsed.query.trim() === '') {
        return command.hint
      }
      const state = remote && remote.query === parsed.query ? remote : null
      if (state && 'error' in state) {
        return `搜索失败：${state.error}`
      }
      if (!state) {
        return '搜索中…'
      }
      return command.notice?.(parsed.query, state.rows.length) ?? command.hint
    }

    return command.notice?.(parsed.query, rows.length) ?? command.hint
  }, [parsed, remote, rows.length])

  // 结果条数变化时把高亮收回范围内；在渲染期间调整 state 而非 effect ——
  // effect 里同步 setState 会被 react-hooks/set-state-in-effect 拦下。
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
        // 取模两次：负 delta 也落回 [0, count)，实现首尾循环回绕
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

      // 动作行：命令只声明了「复制 / 打开 / 填入」，执行统一发生在这里
      if (row.kind === 'action') {
        if (row.run.type === 'copy') {
          handleCopy(row.key, row.run.text)
          return
        }
        // fill：把文本补进输入框（选一条命令 = 自动输入「/<命令> 」），弹窗原地不动
        if (row.run.type === 'fill') {
          handleKeywordChange(row.run.text)
          return
        }
        window.open(row.run.url, '_blank', 'noopener,noreferrer')
        setOpen(false)
        return
      }

      // 物品行：有二级动作就钻入动作面板，否则退回「打开 wiki」默认行为
      if (row.kind === 'item') {
        const actions = parsed?.command.buildActions?.(row) ?? []
        if (actions.length > 0) {
          setDrillRow(row)
          setActiveIndex(0)
          return
        }
        window.open(buildWikiUrl(row.item.name), '_blank', 'noopener,noreferrer')
        setOpen(false)
        return
      }

      window.open(row.url, '_blank', 'noopener,noreferrer')
      setOpen(false)
    },
    [rows, handleCopy, parsed, handleKeywordChange],
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!open) {
          return
        }
        event.preventDefault()
        // 在动作面板里 Esc 先退回一层，再按一次才关窗
        if (drillRow) {
          setDrillRow(null)
          setActiveIndex(0)
          return
        }
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

      // IME 组合首键：只开窗交焦点、不阻止默认行为，让后续 composition 事件直接落进弹窗输入框
      if (isImeStart(event)) {
        openDialog(false)
        return
      }

      // 字母、数字、命令前缀 `/`：直接开窗并从这里接管输入
      if (event.key.length === 1 && /[a-zA-Z0-9/]/.test(event.key)) {
        // 必须 preventDefault：开窗后焦点已移到弹窗输入框，不拦住同一字符会被再插一遍
        event.preventDefault()
        openDialog(false)
        setKeyword(event.key)
        setActiveIndex(0)
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, suspended, openDialog, drillRow])

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
      setDrillRow(null)
    }

    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [open, suspended, openDialog])

  return {
    keyword,
    open,
    selectAllOnOpen,
    mode,
    rows,
    commandNotice,
    copiedKey,
    drillTitle,
    activeIndex,
    handleKeywordChange,
    handleOpenForReplace,
    handleOpenForTyping,
    handleClose,
    handleMoveActive,
    handleActivate,
    handleSelect,
    handleBack,
  }
}
