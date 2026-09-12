import type { GroupType, ItemKind } from '../../core/storage/types.ts'

/**
 * 项目类型注册表。
 *
 * 新项目类型应优先在这里声明能力，表单、看板和拖拽逻辑只依赖这些能力，
 * 不要再为每个类型增加 isXxx 分支。
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

export const GROUP_TYPE_OPTIONS = (Object.keys(GROUP_TYPE_META) as GroupType[]).map((value) => ({
  value,
  label: GROUP_TYPE_META[value].label,
}))

export function groupTypeLabel(type: GroupType): string {
  return GROUP_TYPE_META[type].label
}

/** 当前项目类型允许的内容种类。 */
export function allowedItemKinds(type: GroupType): { label: string; value: ItemKind }[] {
  return GROUP_TYPE_META[type].allowedKinds.map((kind) => ({
    value: kind,
    label: kind === 'widget' ? '小组件' : '网页链接',
  }))
}

export function canPlaceItem(type: GroupType, kind: ItemKind): boolean {
  return GROUP_TYPE_META[type].allowedKinds.includes(kind)
}

export function showsColumns(type: GroupType): boolean {
  return GROUP_TYPE_META[type].columnsVisible
}

/** 一行最多并排几个该类型的项目。 */
export function groupsPerRow(type: GroupType): number {
  return GROUP_TYPE_META[type].perRow
}
