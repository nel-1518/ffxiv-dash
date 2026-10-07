import { groupsPerRow } from '../core/group-rules.ts'
import type { GroupType } from '../core/storage/types.ts'

/**
 * 一行内的分组切片：连续的同类型分组按该类型的 perRow 切片，类型切换时立即断行。
 *
 * 放在 state 而不是 features/groups：它是 `board-store.ts` 结构快照的一部分，
 * state 层不允许反向依赖 features。
 * ⚠️ 只存 id，不存 `Group` 对象：行结构由 store 按「id 序列未变就复用旧数组」缓存
 * （见 `rebuildStructure`），行里挂 Group 会让缓存带出过期数据；只留 id 时缓存是纯粹的结构，
 * 分组内容由消费方按 id 各自订阅。
 */
export type GroupRow = {
  type: GroupType
  ids: string[]
}

/**
 * 把分组切成"行"。入参只要 `{ id, type }` 这个最小形状：类型创建后不可修改，
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
