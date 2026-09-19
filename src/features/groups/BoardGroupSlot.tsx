import { memo, useCallback, useMemo } from 'react'
import { useBoardGroup } from '../../state/hooks.ts'
import { ItemGrid } from '../navigation/ItemGrid.tsx'
import { SortableGroup } from './SortableGroup.tsx'
import { groupTypeLabel } from './group-types.ts'

export type BoardGroupSlotProps = {
  groupId: string
  /** 是否处于编辑模式，透传给表头与卡片。 */
  editMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** 分组上下移。调用方传的是模块级函数，引用恒定。 */
  onMove: (groupId: string, direction: -1 | 1) => void
  onAddItem: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onEditItem: (groupId: string, itemId: string) => void
  /** 刚落下、还在等 DragOverlay 落定的卡片 id；只有落到本组时才变。 */
  landingItemId: string | null
}

/**
 * 看板里的一个分组槽位。
 *
 * 它是「分组」这一层的订阅点：**props 全是原始值或稳定引用**（见 `GroupBoard`），
 * 因此 `memo` 之后它只会因为自己的数据变化而重渲染 —— 别的分组、顶栏、整页都牵不动它。
 *
 * 订阅粒度上刻意分了内外两层：
 * - 本组件订的是**表头**需要的东西（标题、类型、项数），供 `SortableGroup` 用；
 * - 卡片数据交给下面的 `GroupItems` 自己订阅。
 *
 * 分开的意义：改某张卡片的配置时，表头那三样都没变，加上 `grid` 元素引用也稳住了，
 * 于是 `memo(SortableGroup)` / `memo(GroupPanel)` 直接跳过整块 antd Card 表头 ——
 * 真正重渲染的只有那张卡片。
 */
export const BoardGroupSlot = memo(function BoardGroupSlot({
  groupId,
  editMode,
  canMoveUp,
  canMoveDown,
  onMove,
  onAddItem,
  onEditGroup,
  onEditItem,
  landingItemId,
}: BoardGroupSlotProps): React.ReactNode {
  const group = useBoardGroup(groupId)

  /*
   * 下面四个回调都必须固定引用：它们会被透传到 `memo(GroupPanel)` 的比较里，
   * 每次渲染新建闭包会让表头重新渲染。依赖里只有稳定值，因此引用在槽位生命周期内不变。
   */
  const handleMoveUp = useCallback(() => onMove(groupId, -1), [onMove, groupId])
  const handleMoveDown = useCallback(() => onMove(groupId, 1), [onMove, groupId])
  const handleAddItem = useCallback(() => onAddItem(groupId), [onAddItem, groupId])
  const handleEdit = useCallback(() => onEditGroup(groupId), [onEditGroup, groupId])

  /*
   * ⚠️ 这个 children **必须是引用稳定的元素**。
   *
   * 它是"表头不重渲染"的另一半条件：`GroupItems` 自己订阅卡片数据，
   * 所以只要元素引用不变，卡片变化就不会沿着 children 往上传染到 Card。
   * 每次渲染新建 `<GroupItems/>` 会让 memo 全部失效。
   */
  const grid = useMemo(
    () => (
      <GroupItems
        groupId={groupId}
        editMode={editMode}
        landingItemId={landingItemId}
        onEditItem={onEditItem}
      />
    ),
    [groupId, editMode, landingItemId, onEditItem],
  )

  // 分组已被删除（结构快照与当前数据短暂不同步）：这一格先空着，父层马上会重排
  if (!group) {
    return null
  }

  return (
    <SortableGroup
      title={group.title}
      typeLabel={groupTypeLabel(group.type)}
      itemCount={group.items.length}
      editMode={editMode}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onAddItem={handleAddItem}
      onEdit={handleEdit}
    >
      {grid}
    </SortableGroup>
  )
})

type GroupItemsProps = {
  groupId: string
  editMode: boolean
  landingItemId: string | null
  onEditItem: (groupId: string, itemId: string) => void
}

/**
 * 分组内的卡片网格。
 *
 * 自己订阅所属分组：卡片数据变化时只重渲染这一块，上面的分组表头完全不受影响。
 * `handleEditItem` 把「分组 id」提前绑好，是为了让组内所有卡片共用同一个函数引用，
 * `memo(SortableCard)` 才能拦住未变化的卡片（见 `ItemGrid` 的 props 注释）。
 */
function GroupItems({ groupId, editMode, landingItemId, onEditItem }: GroupItemsProps): React.ReactNode {
  const group = useBoardGroup(groupId)

  const handleEditItem = useCallback(
    (itemId: string) => onEditItem(groupId, itemId),
    [onEditItem, groupId],
  )

  if (!group) {
    return null
  }

  return (
    <ItemGrid
      groupId={groupId}
      items={group.items}
      columns={group.columns}
      groupType={group.type}
      editMode={editMode}
      landingItemId={landingItemId}
      onEditItem={handleEditItem}
    />
  )
}
