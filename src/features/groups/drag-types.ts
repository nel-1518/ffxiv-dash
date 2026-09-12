/**
 * dnd-kit 里挂在每个可拖拽项上的 data。
 *
 * 全站只有卡片是可拖拽项（分组靠表头的 ↑/↓ 调序，不参与拖拽），因此 data 只有这一种形状。
 * `kind` 供碰撞检测使用：只有同 kind 的卡片才允许互相吸附，否则拖链接卡划过组件卡时，
 * 组件卡会先让位、再弹回去（真正能否落位由 reducer 的 `canPlaceItem` 把关）。
 */
export type DragData = { type: 'item'; kind: 'link' | 'widget'; groupId: string }

/** 统一解析 dnd-kit 的 data，保证类型安全。 */
export function parseDragData(value: Record<string, unknown> | undefined): DragData | undefined {
  if (!value || value.type !== 'item' || typeof value.groupId !== 'string') {
    return undefined
  }
  return { type: 'item', kind: value.kind === 'widget' ? 'widget' : 'link', groupId: value.groupId }
}

/** 落位后"幽灵期"的长度：比 DragOverlay 的 dropAnimation（220ms）略长一点。 */
export const DROP_LANDING_MS = 240

/** 拖拽中的占位透明度：实体由 DragOverlay 跟随指针，原卡片只留个影子。 */
export const DRAG_PLACEHOLDER_OPACITY = 0.45

/**
 * 把 dnd-kit 给的 transform 过渡与透明度过渡拼成一条。
 *
 * dnd-kit 只负责 transform 的过渡，而"落位后从半透明淡入"是另一条属性，
 * 直接覆盖 style.transition 会把让位动画也一起弄丢。
 */
export function withFadeTransition(transition: string | undefined): string {
  return [transition, `opacity ${DROP_LANDING_MS}ms ease`].filter(Boolean).join(', ')
}
