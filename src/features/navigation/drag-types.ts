/**
 * dnd-kit 里挂在每个可拖拽项上的 data。全站只有卡片可拖拽（分组靠表头按钮调序）。
 * `kind` 供碰撞检测：只有同 kind 的卡片才互相吸附（能否落位由 reducer 的 `canPlaceItem` 把关）。
 */
export type DragData = { type: 'item'; kind: 'link' | 'widget'; groupId: string }

/** 统一解析 dnd-kit 的 data，保证类型安全。 */
export function parseDragData(value: Record<string, unknown> | undefined): DragData | undefined {
  if (!value || value.type !== 'item' || typeof value.groupId !== 'string') {
    return undefined
  }
  return { type: 'item', kind: value.kind === 'widget' ? 'widget' : 'link', groupId: value.groupId }
}

/**
 * 拖拽中的占位透明度。
 *
 * ⚠️ 只用于"正在被拖的那张卡"。不要给落位后的卡片再压半透明，也不要挂常驻的
 * `opacity` 过渡：dnd-kit 的落位动画会给原卡片写 inline `opacity: 0` 再撤销，
 * 卡片若带透明度过渡，"先隐藏、后恢复"会被拉成两段慢淡入淡出（"拖拽完成后闪一下"）。
 */
export const DRAG_PLACEHOLDER_OPACITY = 0.45
