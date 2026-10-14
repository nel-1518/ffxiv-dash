import { memo, useCallback, useMemo } from 'react'
import { boardActions } from '../../state/board-store.ts'
import { DragHandle } from './DragHandle.tsx'
import { CardFace } from './CardFace.tsx'
import { useSortableCard } from './useSortableCard.ts'
import type { Item } from '../../core/storage/types.ts'

export type SortableCardProps = {
  item: Item
  groupId: string
  /** 是否处于编辑模式；关闭时不注入手柄，卡片也就无法拖拽。 */
  editMode: boolean
  /**
   * 打开编辑弹窗。收「卡片 id」而不是无参闭包：同组所有卡片共用**同一个函数引用**，
   * 下面 memo 的比较才有意义（新建闭包会让所有卡片判定为「变了」）。
   */
  onEdit: (itemId: string) => void
}

/**
 * 可拖拽卡片：只有这层参与拖拽（useSortable 挂外层 div，手柄注入纯展示的 CardFace），
 * 虚影（DragPreview）复用同一组件、与实体一致。
 * **「改一张卡片只重渲染那一张」的边界**：memo 前提是每个 prop 稳定——item 由 reducer 保证
 * 未变不换引用，其余是字符串/布尔；⚠️ 不要加内联对象/闭包 prop。删除由卡片自己派发（握有
 * groupId 与 item.id），省 prop 链。⚠️ handle（useMemo 固定元素；listeners/attributes 本身是 memo 的）
 * 与 onEdit/onRemove 必须引用稳定，否则 memo(CardFace) 被打穿——卡片子树跟着 dnd-kit context
 * 每帧重渲染，拖拽开始的卡顿即由此来。
 */
export const SortableCard = memo(function SortableCard({
  item,
  groupId,
  editMode,
  onEdit,
}: SortableCardProps): React.ReactNode {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, style } = useSortableCard(
    item.id,
    item.kind,
    groupId,
  )

  // 手柄是唯一的拖拽激活点：不渲染它，整张卡片就回到「只能点、不能拖」。
  // ⚠️ 必须 useMemo：每次渲染的新元素会让 memo(CardFace) 失效。
  const handle = useMemo(
    () =>
      editMode ? (
        <DragHandle setActivatorNodeRef={setActivatorNodeRef} listeners={listeners} attributes={attributes} />
      ) : undefined,
    [editMode, setActivatorNodeRef, listeners, attributes],
  )

  const handleEdit = useCallback(() => onEdit(item.id), [onEdit, item.id])
  const handleRemove = useCallback(() => boardActions.removeItem(groupId, item.id), [groupId, item.id])

  // 悬停浮起（navigation.css 的 .dash-link-cell）只在浏览模式的链接卡启用；类名挂在网格单元而非卡片——卡片抬起会移出指针下方、立刻失焦抖动，单元不动才是稳定判定面
  const liftable = !editMode && item.kind === 'link'

  return (
    <div
      ref={setNodeRef}
      className={liftable ? 'dash-sortable-item dash-link-cell' : 'dash-sortable-item'}
      style={style}
    >
      <CardFace
        item={item}
        editMode={editMode}
        handle={handle}
        onEdit={handleEdit}
        onRemove={handleRemove}
      />
    </div>
  )
})
