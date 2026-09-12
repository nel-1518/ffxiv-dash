import { useEffect, useMemo, useReducer, useRef } from 'react'
import { App } from 'antd'
import type { ReactNode } from 'react'
import { BoardContext } from './board-context.ts'
import type { BoardContextValue } from './board-context.ts'
import { boardReducer } from './board-reducer.ts'
import { loadInitialDoc, persistDoc } from './board-storage.ts'

/** 写盘防抖：拖拽排序会在短时间内连续派发 action，合并成一次写入。 */
const PERSIST_DEBOUNCE_MS = 300

export function BoardProvider({ children }: { children: ReactNode }): ReactNode {
  const { message } = App.useApp()
  // 惰性初始化：只在首次挂载时读取 localStorage
  const [doc, dispatch] = useReducer(boardReducer, undefined, loadInitialDoc)
  const saveErrorNotified = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = persistDoc(doc)
      if (!result.ok) {
        // 只在第一次失败时提示，避免每个 action 都弹一次
        if (!saveErrorNotified.current) {
          saveErrorNotified.current = true
          message.error(`本地保存失败：${result.reason}`)
        }
        return
      }
      saveErrorNotified.current = false
    }, PERSIST_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [doc, message])

  const value = useMemo<BoardContextValue>(() => ({ doc, dispatch }), [doc])

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}
