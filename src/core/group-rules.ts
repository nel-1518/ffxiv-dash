import type { BoardDoc, GroupType, ItemKind } from './storage/types.ts'

/**
 * 分组类型注册表 —— 各类分组的能力规则，全站唯一的声明处。
 *
 * 放在 core 而不是 features/groups：`core/storage/schema.ts` 与 `state/board-reducer.ts`
 * 都要用它，这两层不允许反向依赖 features；消费方只依赖这些能力，不要为每个类型加 isXxx 分支。
 */
export const GROUP_TYPE_META: Record<
  GroupType,
  {
    label: string
    description: string
    allowedKinds: readonly ItemKind[]
    /** 是否显示分组内卡片的列数设置。 */
    columnsVisible: boolean
    defaultColumns: number
    perRow: number
  }
> = {
  widget: {
    label: '组件',
    description: '只允许放置组件',
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

/** 一行最多并排几个该类型的分组。 */
export function groupsPerRow(type: GroupType): number {
  return GROUP_TYPE_META[type].perRow
}

/**
 * 某组件类型在整块看板上的实例数（跨分组的全局口径）。
 *
 * 实例上限（`features/widgets/types.ts` 的 `maxCount`）按看板全局计数，与放在哪个分组无关；
 * `state/board-reducer.ts` 与卡片表单共用这里的口径。
 */
export function countWidgetInstances(doc: BoardDoc, widgetKey: string): number {
  let count = 0
  for (const group of doc.groups) {
    for (const item of group.items) {
      if (item.kind === 'widget' && item.widget === widgetKey) {
        count += 1
      }
    }
  }
  return count
}
