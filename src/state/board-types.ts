import type { BoardDoc, GroupType, Item } from '../core/storage/types.ts'

/** state 层支持的全部操作。 */
export type BoardAction =
  | { type: 'addGroup'; title: string; groupType: GroupType; columns: number }
  /** 改分组只改名称与列数：刻意不收 groupType，让「创建后不能改类型」成为数据层硬约束。 */
  | { type: 'updateGroup'; groupId: string; title: string; columns: number }
  | { type: 'removeGroup'; groupId: string }
  | { type: 'reorderGroups'; orderedIds: string[] }
  | { type: 'addItem'; groupId: string; item: Item }
  | { type: 'updateItem'; groupId: string; item: Item }
  /** 只改某组件自己的 config：组件只知道自己的 item.id，按 id 反查所属分组（统计卡 +1 这类就地修改）。 */
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
  /** 整体替换看板（唯一调用方＝「导入」）；doc 必须已过 `parseBoardDocValue` 校验（reducer 纯函数，不做 IO 不抛错）。 */
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
