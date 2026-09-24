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

/**
 * 拖拽中的占位透明度。
 *
 * ⚠️ 只用于"正在被拖的那张卡"。**不要**给落位后的卡片再压一层半透明，也不要给
 * 卡片挂上常驻的 `opacity` 过渡：
 * - dnd-kit 的落位动画（`defaultDropAnimationSideEffects`）会在动画开始时给原卡片写 inline
 *   `opacity: 0`、动画结束后再撤销。卡片如果带着 240ms 的透明度过渡，这个"先隐藏、后恢复"
 *   会被拉成两段慢淡入淡出：虚影已经落定，底下的卡片还是几乎透明的，随后猛地亮回来 ——
 *   就是"拖拽完成后闪一下"。
 * - 而"落位占位"其实也没用：动画期间原卡片已被 dnd-kit 隐藏，占位只在动画结束后才可见。
 */
export const DRAG_PLACEHOLDER_OPACITY = 0.45
