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

/** 当前项目类型允许的内容种类。 */
export function allowedItemKinds(type: GroupType): { label: string; value: ItemKind }[] {
  return GROUP_TYPE_META[type].allowedKinds.map((kind) => ({
    value: kind,
    label: kind === 'widget' ? '小组件' : '网页链接',
  }))
}

export function showsColumns(type: GroupType): boolean {
  return GROUP_TYPE_META[type].columnsVisible
}

/**
 * 项目（分组）的位置调整方式。
 *
 * 四种方式共用一条链路（`GroupBoard` 的 `moveGroup`）：相邻换位是 `up` / `down`，
 * 直接跳到首尾是 `top` / `bottom`。表头的四个按钮因此只需要一个回调。
 */
export type GroupMove = 'up' | 'down' | 'top' | 'bottom'
