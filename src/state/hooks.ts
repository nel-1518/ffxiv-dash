import { useCallback, useSyncExternalStore } from 'react'
import { readBoardDoc, readGroup, readGroupRows, subscribeBoard } from './board-store.ts'
import type { BoardDoc, Group } from '../core/storage/types.ts'
import type { GroupRow } from './group-rows.ts'

/**
 * 看板数据的订阅入口，全部走 `useSyncExternalStore`。
 * 核心约定：每个 hook 只订阅自己一小片，快照按 `Object.is` 比较，没变就跳过渲染——改一张卡片
 * 只重渲染那张卡片。粒度：行结构 → `useBoardGroupRows`；分组 → `useBoardGroup`；
 * 整份文档 → `useBoardDoc`（有明确禁用场景）。只写不读的组件直接 import `boardActions`。
 */

/** 按行切开的分组结构（`BoardSurface` 布局用）。行结构未变时引用不变，卡片内容变化不惊动看板这一层。 */
export function useBoardGroupRows(): GroupRow[] {
  return useSyncExternalStore(subscribeBoard, readGroupRows)
}

/**
 * 单个分组；该分组未变时快照引用不变，组件不重渲染。
 * ⚠️ selector 必须 `useCallback` 固定：`getSnapshot` 变了会重新取值，每次渲染新建箭头函数等于一直「在变」。
 */
export function useBoardGroup(groupId: string): Group | undefined {
  const select = useCallback(() => readGroup(groupId), [groupId])
  return useSyncExternalStore(subscribeBoard, select)
}

/**
 * 整份文档。⚠️ 只在确实需要全文时用（导出 JSON、统计条目数这类一次性读取）：在卡片或看板里用
 * ＝让该组件订阅整个看板（回到「改一张卡片刷新一整片」）；卡片数据应经 `useBoardGroup` 按分组下发。
 */
export function useBoardDoc(): BoardDoc {
  return useSyncExternalStore(subscribeBoard, readBoardDoc)
}
