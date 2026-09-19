import { memo, useCallback, useMemo } from 'react'
import { boardActions } from '../../state/board-store.ts'
import { DragHandle } from '../groups/DragHandle.tsx'
import { CardFace } from './CardFace.tsx'
import { useSortableCard } from './useSortableCard.ts'
import type { Item } from '../../core/storage/types.ts'

export type SortableCardProps = {
  item: Item
  groupId: string
  /** 是否处于编辑模式；关闭时不注入手柄，卡片也就无法拖拽。 */
  editMode: boolean
  /**
   * 打开这张卡片的编辑弹窗。
   *
   * 收的是「卡片 id」而不是无参闭包：同一个分组里所有卡片共用**同一个函数引用**，
   * 下面 `memo` 的比较才有意义（每次新建闭包会让所有卡片都判定为"变了"）。
   */
  onEdit: (itemId: string) => void
}

/**
 * 可拖拽卡片。
 *
 * 只有这一层参与拖拽：`useSortable` 把 ref / transform 挂在外层 div 上，
 * 手柄通过 `handle` 注入给纯展示的 `CardFace`。
 * 卡片外观本身由 `CardFace` 提供，拖拽预览（DragPreview）复用同一个组件，
 * 因此拖起来的虚影与列表里的实体完全一致。
 *
 * **这是"改一张卡片只重渲染那一张"的边界。** `memo` 能生效的前提是每个 prop 都稳定：
 * `item` 由 reducer 保证"没改到的 item 不换引用"，其余都是字符串/布尔，
 * `onEdit` 见上面的说明。⚠️ 因此**不要**给它加内联对象/闭包类 prop。
 *
 * 删除由卡片自己派发（它握着 `groupId` 与 `item.id`），省掉两条 prop 链，
 * 也让 `memo` 的比较面更小。
 *
 * ⚠️ 下面三件东西都必须**引用稳定**，否则 `memo(CardFace)` 会被打穿：
 * - `handle`：`useSortable` 给的 `listeners` / `attributes` 本身是 memo 过的
 *   （只有"正被拖的那张卡"的 `attributes` 会随 `isDragging` 变），所以用 `useMemo` 固定住**元素**即可；
 * - `onEdit` / `onRemove`：每次渲染新建闭包会让 `CardFace` 判定"变了"，
 *   卡片子树（含每张卡三个 Tooltip）就会跟着 dnd-kit 的 context 一起重渲染 —— 拖拽开始时那种卡顿就是这么来的。
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

  // 手柄是唯一的拖拽激活点：不渲染它，整张卡片就回到"只能点、不能拖"。
  // ⚠️ 必须 useMemo：`<DragHandle/>` 每次渲染都是新元素，不固定住等于让 memo(CardFace) 失效
  const handle = useMemo(
    () =>
      editMode ? (
        <DragHandle setActivatorNodeRef={setActivatorNodeRef} listeners={listeners} attributes={attributes} />
      ) : undefined,
    [editMode, setActivatorNodeRef, listeners, attributes],
  )

  const handleEdit = useCallback(() => onEdit(item.id), [onEdit, item.id])
  const handleRemove = useCallback(() => boardActions.removeItem(groupId, item.id), [groupId, item.id])

  /*
   * 悬停浮起（见 global.css 的 .dash-link-cell）只在浏览模式的链接卡片上启用。
   * 类名挂在**网格单元**而不是卡片上：卡片抬起后会从指针下方移开，
   * 判定挂在卡片上会立刻失焦、来回抖动；单元本身不动，是稳定的判定面。
   */
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
