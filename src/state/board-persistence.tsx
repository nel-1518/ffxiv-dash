import { useEffect } from 'react'
import { App } from 'antd'
import { readBoardDoc, subscribeBoard } from './board-store.ts'
import { persistDoc } from './board-storage.ts'
import type { ReactNode } from 'react'

/** 写盘防抖：拖拽排序、连点加减会在短时间内连续派发 action，合并成一次写入。 */
const PERSIST_DEBOUNCE_MS = 300

/**
 * 落盘闸门：订阅 store，把变更防抖后写进 localStorage。
 *
 * ⚠️ 这里**刻意用命令式 `subscribeBoard`，而不是 `useSyncExternalStore`**。
 *
 * 它渲染的是 `children`（整棵应用），一旦它自己因为 `doc` 变化而重渲染，
 * 整棵树就会跟着重渲染 —— 细粒度订阅的收益会被这一行全部抵消。
 * 订阅只用来"知道该写盘了"，它与渲染无关，所以正确做法是命令式订阅 + 不持有任何 state。
 *
 * 它需要 `App.useApp()` 的 message 提示写入失败，因此必须挂在 `<App>` 内部。
 */
export function BoardPersistence({ children }: { children: ReactNode }): ReactNode {
  const { message } = App.useApp()

  useEffect(() => {
    let timer: number | undefined
    /** 只在连续失败的第一枪提示，避免每个 action 都弹一次。 */
    let notified = false

    const unsubscribe = subscribeBoard(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const result = persistDoc(readBoardDoc())
        if (!result.ok) {
          if (!notified) {
            notified = true
            message.error(`本地保存失败：${result.reason}`)
          }
          return
        }
        notified = false
      }, PERSIST_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [message])

  return children
}
