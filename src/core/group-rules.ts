import type { GroupType, ItemKind } from './storage/types.ts'

/**
 * 项目类型注册表 —— 分组类型的**能力规则**，全站唯一的声明处。
 *
 * 放在 core 而不是 features/groups：`core/storage/schema.ts`（校验落盘数据）
 * 与 `state/board-reducer.ts`（落位把关）都要用它，这两个层不允许反向依赖
 * features；表单、看板和拖拽逻辑也只依赖这些能力，不要为每个类型增加 isXxx 分支。
 */
export const GROUP_TYPE_META: Record<
  GroupType,
  {
    label: string
    description: string
    allowedKinds: readonly ItemKind[]
    /** 是否显示项目内卡片的列数设置。 */
    columnsVisible: boolean
    defaultColumns: number
    perRow: number
  }
> = {
  widget: {
    label: '小组件',
    description: '只允许放置小组件',
    allowedKinds: ['widget'],
    columnsVisible: true,
    defaultColumns: 4,
    perRow: 1,
  },
  link: {
    label: '网页导航',
    description: '只允许放置网页链接',
    allowedKinds: ['link'],
    columnsVisible: true,
    defaultColumns: 3,
    perRow: 4,
  },
}

export function canPlaceItem(type: GroupType, kind: ItemKind): boolean {
  return GROUP_TYPE_META[type].allowedKinds.includes(kind)
}

/** 一行最多并排几个该类型的项目。 */
export function groupsPerRow(type: GroupType): number {
  return GROUP_TYPE_META[type].perRow
}
