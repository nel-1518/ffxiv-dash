import { useMemo, useSyncExternalStore } from 'react'
import { getNow, subscribe } from './store.ts'

/**
 * 全局时钟的当前毫秒时间戳，每秒（对齐整秒）更新一次。
 *
 * 用 useSyncExternalStore 而不是 Context：不需要 Provider、不重渲染整棵树，
 * 同一 tick 内所有订阅者读到的也一定是同一个值。
 */
export function useClock(): number {
  return useSyncExternalStore(subscribe, getNow)
}

/** 需要 Date 实例时的包装（rotation / 艾欧泽亚换算这类纯函数吃 Date）。 */
export function useNow(): Date {
  const ms = useClock()
  return useMemo(() => new Date(ms), [ms])
}
