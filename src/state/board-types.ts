import type { BoardDoc, GroupType, Item } from '../core/storage/types.ts'

/** state 层支持的全部操作。 */
export type BoardAction =
  | { type: 'addGroup'; title: string; groupType: GroupType; columns: number }
  /**
   * 改分组只改名称与列数：类型在创建时就定下来。
   * 这里刻意不接受 groupType，让"创建后不能改类型"成为数据层的硬约束，
   * 而不只是界面上的禁用。
   */
  | { type: 'updateGroup'; groupId: string; title: string; columns: number }
  | { type: 'removeGroup'; groupId: string }
  | { type: 'reorderGroups'; orderedIds: string[] }
  | { type: 'addItem'; groupId: string; item: Item }
  | { type: 'updateItem'; groupId: string; item: Item }
  /**
   * 只改某个组件自己的 config。
   * 组件内部只知道自己的 item.id，因此这里按 id 定位所属分组（用于统计卡 +1 这类就地修改）。
   */
  | { type: 'updateItemConfig'; itemId: string; patch: Record<string, unknown> }
  | { type: 'removeItem'; groupId: string; itemId: string }
  | { type: 'reorderItems'; groupId: string; orderedIds: string[] }
  | {
      type: 'moveItemToGroup'
      itemId: string
      sourceGroupId: string
      targetGroupId: string
      /** 目标分组内的参照卡片；缺省则追加到末尾。 */
      overItemId?: string
    }
  /**
   * 整体替换看板。
   *
   * 目前只有一个调用方：设置里的「导入」。传入的 doc 必须已经过
   * `parseBoardDoc` 校验，reducer 不再重复校验（它是纯函数，不做 IO 也不抛错）。
   */
  | { type: 'replaceDoc'; doc: BoardDoc }

/** 供 UI 使用的语义化操作集合。 */
export type BoardActions = {
  addGroup: (title: string, groupType: GroupType, columns: number) => void
  /** 只改名称与列数；类型创建后不可修改。 */
  updateGroup: (groupId: string, title: string, columns: number) => void
  removeGroup: (groupId: string) => void
  reorderGroups: (orderedIds: string[]) => void
  addItem: (groupId: string, item: Item) => void
  updateItem: (groupId: string, item: Item) => void
  /** 按条目 id 补丁式改组件配置（组件内部自改，如统计卡的 +1）。 */
  updateItemConfig: (itemId: string, patch: Record<string, unknown>) => void
  removeItem: (groupId: string, itemId: string) => void
  reorderItems: (groupId: string, orderedIds: string[]) => void
  moveItemToGroup: (
    itemId: string,
    sourceGroupId: string,
    targetGroupId: string,
    overItemId?: string,
  ) => void
  /** 整体替换看板（导入）。 */
  replaceDoc: (doc: BoardDoc) => void
}
