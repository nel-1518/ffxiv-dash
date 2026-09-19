import { useCallback, useSyncExternalStore } from 'react'
import { readBoardDoc, readGroup, readGroupRows, subscribeBoard } from './board-store.ts'
import type { BoardDoc, Group } from '../core/storage/types.ts'
import type { GroupRow } from '../features/groups/group-types.ts'

/**
 * 看板数据的**订阅入口**，全部走 `useSyncExternalStore`。
 *
 * 核心约定：每个 hook 只订阅自己需要的那一小片，快照按 `Object.is` 比较，
 * 没变就跳过这次渲染。因此"改一张卡片的进度"只会让那张卡片重渲染，
 * 顶栏、搜索、设置、其他分组一概不动。
 *
 * 用什么粒度：
 * - 只要分组**结构**（有几个组、怎么分行）→ `useBoardGroupRows`
 * - 要某个分组的**内容** → `useBoardGroup(groupId)`
 * - 要**整份文档** → `useBoardDoc`（⚠️ 见它的注释，有明确的禁用场景）
 *
 * 只写不读的组件（事件处理器、`boardActions`）**不需要任何 hook**，
 * 直接从 `board-store.ts` import `boardActions` 即可。
 */

/**
 * 按行切开的分组结构。`BoardSurface` 用它决定每一行放几个分组。
 *
 * 行结构未变时引用不变（与分组 id 序列同一份缓存与判定），
 * 因此卡片内容变化不会让看板这一层重渲染。
 */
export function useBoardGroupRows(): GroupRow[] {
  return useSyncExternalStore(subscribeBoard, readGroupRows)
}

/**
 * 单个分组。该分组未变时快照引用不变，组件不重渲染。
 *
 * ⚠️ selector 必须用 `useCallback` 固定：`useSyncExternalStore` 会在
 * `getSnapshot` 变化时重新取值，每次渲染新建箭头函数会让它一直"在变"。
 */
export function useBoardGroup(groupId: string): Group | undefined {
  const select = useCallback(() => readGroup(groupId), [groupId])
  return useSyncExternalStore(subscribeBoard, select)
}

/**
 * 整份文档。
 *
 * ⚠️ **只有在确实需要全文时才用**：导出 JSON、统计分组/条目总数这类一次性读取。
 * 一旦在卡片或看板里用它，就等于让那个组件订阅整个看板 —— 本次重构的收益会被
 * 整体抹掉（又回到"改一张卡片刷新一整片"）。卡片请用 `useBoardItem`。
 */
export function useBoardDoc(): BoardDoc {
  return useSyncExternalStore(subscribeBoard, readBoardDoc)
}
