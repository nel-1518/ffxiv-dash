import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DRAG_PLACEHOLDER_OPACITY } from './drag-types.ts'

/**
 * 把 dnd-kit 的 useSortable 结果整理成渲染需要的形状。
 * 卡片的 id 直接用实体 id，拖拽结束时用 id 反查顺序。
 *
 * `kind` 会被碰撞检测读取：只有同类型的卡片才互相吸附，
 * 因此网页导航与组件不会在拖动时互相让位。
 */
export function useSortableCard(itemId: string, kind: 'link' | 'widget', groupId: string) {
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
      /*
       * ⚠️ 这里**只**用 dnd-kit 给的过渡，不要再自己拼一条 `opacity …` 进来。
       * 拖拽结束（& 落位动画结束）时 dnd-kit 会直接写 / 撤销原卡片上的 inline
       *`opacity`，卡片上如果挂着常驻的透明度过渡，这个"先隐藏、后恢复"就会被拉成
       * 两段慢淡入淡出 —— 虚影已经落定，底下的卡片还几乎透明，随后猛地亮回来，
       * 看上去就是"拖拽完成后闪一下"。
       */
      transition,
      /*
       * 占位透明度用自定义属性下发，真正的 opacity 由 .dash-sortable-item 规则读取。
       * 不能直接把 opacity 写在 inline style 上：dnd-kit 的落位动画会把拖拽开始时的
       * inline 样式快照在动画结束后写回节点（defaultDropAnimationSideEffects），
       * 那样会把我们已经恢复成 1 的 opacity 又覆盖成 0.45，且 React 不会再移除它，
       * 卡片就永久停在半透明的"虚影"状态。自定义属性被写回也无副作用。
       */
      '--dash-drag-opacity': isDragging ? DRAG_PLACEHOLDER_OPACITY : 1,
      position: 'relative',
      zIndex: isDragging ? 2 : undefined,
    } as React.CSSProperties,
  }
}
