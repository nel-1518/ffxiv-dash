import { useContext, useMemo } from 'react'
import type { BoardDoc, GroupType, Item } from '../core/storage/types.ts'
import { BoardContext } from './board-context.ts'
import type { BoardActions } from './board-types.ts'

function useBoardContext() {
  const context = useContext(BoardContext)
  if (!context) {
    throw new Error('useBoard 必须在 <BoardProvider> 内部使用')
  }
  return context
}

/** 读取当前仪表盘数据。 */
export function useBoard(): BoardDoc {
  return useBoardContext().doc
}

/** 取得语义化的操作集合；dispatch 稳定，因此引用在组件生命周期内不变。 */
export function useBoardActions(): BoardActions {
  const { dispatch } = useBoardContext()

  return useMemo<BoardActions>(
    () => ({
      addGroup: (title: string, groupType: GroupType, columns: number) =>
        dispatch({ type: 'addGroup', title, groupType, columns }),
      updateGroup: (groupId: string, title: string, columns: number) =>
        dispatch({ type: 'updateGroup', groupId, title, columns }),
      removeGroup: (groupId: string) => dispatch({ type: 'removeGroup', groupId }),
      reorderGroups: (orderedIds: string[]) => dispatch({ type: 'reorderGroups', orderedIds }),
      addItem: (groupId: string, item: Item) => dispatch({ type: 'addItem', groupId, item }),
      updateItem: (groupId: string, item: Item) => dispatch({ type: 'updateItem', groupId, item }),
      updateItemConfig: (itemId: string, patch: Record<string, unknown>) =>
        dispatch({ type: 'updateItemConfig', itemId, patch }),
      removeItem: (groupId: string, itemId: string) => dispatch({ type: 'removeItem', groupId, itemId }),
      reorderItems: (groupId: string, orderedIds: string[]) =>
        dispatch({ type: 'reorderItems', groupId, orderedIds }),
      moveItemToGroup: (
        itemId: string,
        sourceGroupId: string,
        targetGroupId: string,
        overItemId?: string,
      ) => dispatch({ type: 'moveItemToGroup', itemId, sourceGroupId, targetGroupId, overItemId }),
      replaceDoc: (doc: BoardDoc) => dispatch({ type: 'replaceDoc', doc }),
    }),
    [dispatch],
  )
}
