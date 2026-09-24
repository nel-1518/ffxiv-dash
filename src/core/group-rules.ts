import type { BoardDoc, GroupType, ItemKind } from './storage/types.ts'

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

/**
 * 某组件类型在**整块看板**上的实例数（跨全部分组的全局口径）。
 *
 * 组件实例上限（见 `features/widgets/types.ts` 的 `maxCount`）按看板全局计数，
 * 而不是按分组：同一类型放几个只取决于"整块板上已有几个"，与放在哪个分组无关。
 * `state/board-reducer.ts`（落库把关）与项目表单（禁用选项）共用这里的口径。
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
