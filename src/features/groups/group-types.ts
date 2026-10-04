import { GROUP_TYPE_META } from '../../core/group-rules.ts'
import type { GroupType, ItemKind } from '../../core/storage/types.ts'

/*
 * 本模块只保留**界面层**的类型辅助（下拉选项、文案、UI 动作类型）。
 * 能力规则（GROUP_TYPE_META / canPlaceItem / groupsPerRow）在 `core/group-rules.ts`，
 * 切行结构（GroupRow / splitIntoRows）在 `state/group-rows.ts` ——
 * core 与 state 不允许反向依赖 features，规则与数据形状因此下沉到了下层。
 */

export const GROUP_TYPE_OPTIONS = (Object.keys(GROUP_TYPE_META) as GroupType[]).map((value) => ({
  value,
  label: GROUP_TYPE_META[value].label,
}))

export function groupTypeLabel(type: GroupType): string {
  return GROUP_TYPE_META[type].label
}

/** 当前分组类型允许的内容种类。 */
export function allowedItemKinds(type: GroupType): { label: string; value: ItemKind }[] {
  return GROUP_TYPE_META[type].allowedKinds.map((kind) => ({
    value: kind,
    label: kind === 'widget' ? '组件' : '网页链接',
  }))
}

/**
 * 分组标题栏「＋」按钮的文案：按分组类型区分成「添加组件」或「添加链接」。
 *
 * 分组类型创建后不可修改，因此往里添加的是什么由类型唯一决定
 * （`GROUP_TYPE_META` 的 `allowedKinds`：组件分组只能放组件，链接分组只能放链接），
 * 一个类型对应一个文案，不需要运行时再判内容种类。
 */
export function addItemLabel(type: GroupType): string {
  return type === 'widget' ? '添加组件' : '添加链接'
}

export function showsColumns(type: GroupType): boolean {
  return GROUP_TYPE_META[type].columnsVisible
}

/**
 * 分组的位置调整方式。
 *
 * 四种方式共用一条链路（`GroupBoard` 的 `moveGroup`）：相邻换位是 `up` / `down`，
 * 直接跳到首尾是 `top` / `bottom`。表头的四个按钮因此只需要一个回调。
 */
export type GroupMove = 'up' | 'down' | 'top' | 'bottom'
