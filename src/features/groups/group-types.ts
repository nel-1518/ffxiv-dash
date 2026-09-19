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

/**
 * 项目（分组）的位置调整方式。
 *
 * 四种方式共用一条链路（`GroupBoard` 的 `moveGroup`）：相邻换位是 `up` / `down`，
 * 直接跳到首尾是 `top` / `bottom`。表头的四个按钮因此只需要一个回调。
 */
export type GroupMove = 'up' | 'down' | 'top' | 'bottom'

/**
 * 一行内的分组切片：连续的同类型分组按该类型的 perRow 切片，类型切换时立即断行。
 *
 * ⚠️ 这里**只存 id，不存 `Group` 对象**。行结构由 store 按「id 序列未变就复用旧数组」
 * 缓存（见 `state/board-store.ts` 的 `rebuildStructure`），一旦行里挂着 Group 对象，
 * 缓存复用就意味着组件读到过期数据；只留 id 时，缓存里的东西是纯粹的**结构**，
 * 永远不会过期，分组内容由消费方按 id 各自订阅。
 */
export type GroupRow = {
  type: GroupType
  ids: string[]
}

/**
 * 把分组切成"行"。
 *
 * 入参只要 `{ id, type }` 这个最小形状：类型创建后不可修改，
 * 所以行结构 = f(id 顺序, 类型)，与分组的其它字段无关。
 */
export function splitIntoRows(groups: readonly { id: string; type: GroupType }[]): GroupRow[] {
  const rows: GroupRow[] = []
  let current: GroupRow | undefined

  for (const group of groups) {
    const capacity = groupsPerRow(group.type)
    const canAppend = current && current.type === group.type && current.ids.length < capacity
    if (canAppend && current) {
      current.ids.push(group.id)
      continue
    }
    current = { type: group.type, ids: [group.id] }
    rows.push(current)
  }

  return rows
}
