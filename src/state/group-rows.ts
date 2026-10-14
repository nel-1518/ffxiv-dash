import { groupsPerRow } from '../core/group-rules.ts'
import type { GroupType } from '../core/storage/types.ts'

/**
 * 一行内的分组切片：连续同类型分组按该类型的 perRow 切片，类型切换即断行。
 * 放在 state：它是 `board-store.ts` 结构快照的一部分，state 层不允许反向依赖 features。
 * ⚠️ 只存 id、不存 `Group`：store 的结构缓存靠「id 序列未变就复用旧数组」（见 `rebuildStructure`），
 * 行里挂 Group 会带过期数据进缓存；只留 id 时缓存是纯结构，分组内容由消费方按 id 各自订阅。
 */
export type GroupRow = {
  type: GroupType
  ids: string[]
}

/** 把分组切成行。入参只需 `{ id, type }` 最小形状：类型创建后不可修改，行结构 = f(id 顺序， 类型)。 */
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
