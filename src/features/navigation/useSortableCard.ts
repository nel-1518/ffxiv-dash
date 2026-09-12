import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DRAG_PLACEHOLDER_OPACITY, withFadeTransition } from '../groups/drag-types.ts'

/**
 * 把 dnd-kit 的 useSortable 结果整理成渲染需要的形状。
 * 卡片的 id 直接用实体 id，拖拽结束时用 id 反查顺序。
 *
 * `kind` 会被碰撞检测读取：只有同类型的卡片才互相吸附，
 * 因此网页导航与组件不会在拖动时互相让位。
 *
 * `isLanding` 是"刚落下、DragOverlay 还在飞回卡槽"的那一小段时间：
 * 此时原卡片先半透明占位，等实体落定后再淡入，避免一份卡片同时出现两次。
 */
export function useSortableCard(
  itemId: string,
  kind: 'link' | 'widget',
  groupId: string,
  isLanding: boolean,
) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: itemId,
    data: { type: 'item', kind, groupId },
  })

  return {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    isDragging,
    style: {
      transform: CSS.Transform.toString(transform),
      // dnd-kit 只给 transform 过渡，透明度过渡要自己拼进去
      transition: withFadeTransition(transition),
      // 占位透明度用自定义属性下发，真正的 opacity 由 .dash-sortable-item 规则读取。
      // 不能直接把 opacity 写在 inline style 上：dnd-kit 的落位动画会把拖拽开始时的
      // inline 样式快照在动画结束后写回节点（defaultDropAnimationSideEffects），
      // 那样会把我们已经恢复成 1 的 opacity 又覆盖成 0.45，且 React 不会再移除它，
      // 卡片就永久停在半透明的"虚影"状态。自定义属性被写回也无副作用。
      '--dash-drag-opacity': isDragging || isLanding ? DRAG_PLACEHOLDER_OPACITY : 1,
      position: 'relative',
      zIndex: isDragging ? 2 : undefined,
    } as React.CSSProperties,
  }
}
