import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DRAG_PLACEHOLDER_OPACITY } from './drag-types.ts'

/** 把 useSortable 结果整理成渲染需要的形状。id 直接用实体 id（拖拽结束按 id 反查顺序）；`kind` 供碰撞检测：只有同类型卡片互相吸附。 */
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
       * ⚠️ 只用 dnd-kit 给的过渡，不要自己拼 `opacity …`：拖拽结束（落位动画结束）时 dnd-kit
       * 直接写/撤销原卡 inline opacity，常驻透明度过渡会把「先隐藏、后恢复」拉成两段慢淡入淡出——「完成后闪一下」。
       */
      transition,
      /*
       * ⚠️ 占位透明度用自定义属性下发（真 opacity 由 .dash-sortable-item 规则读取）：
       * 直接写 inline opacity 会被落位动画在结束时写回 0.45 且 React 不再移除（defaultDropAnimationSideEffects），
       * 卡片永久停在半透明「虚影」状态；自定义属性被写回无副作用。
       */
      '--dash-drag-opacity': isDragging ? DRAG_PLACEHOLDER_OPACITY : 1,
      position: 'relative',
      zIndex: isDragging ? 2 : undefined,
    } as React.CSSProperties,
  }
}
