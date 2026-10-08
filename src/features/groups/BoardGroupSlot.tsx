import { memo, useCallback, useMemo } from 'react'
import { useBoardGroup } from '../../state/hooks.ts'
import { ItemGrid } from '../navigation/ItemGrid.tsx'
import { SortableGroup } from './SortableGroup.tsx'
import { addItemLabel, groupTypeLabel } from './group-types.ts'
import type { GroupMove } from './group-types.ts'

export type BoardGroupSlotProps = {
  groupId: string
  /** 是否处于编辑模式，透传给表头与卡片。 */
  editMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** 分组位置调整（置顶 / 上移 / 下移 / 置底）。调用方传的是模块级函数，引用恒定。 */
  onMove: (groupId: string, move: GroupMove) => void
  onAddItem: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onEditItem: (groupId: string, itemId: string) => void
}

/**
 * 看板里的一个分组槽位：「分组」这一层的订阅点。
 * props 全是原始值或稳定引用（见 `GroupBoard`），`memo` 之后只有自己的数据变化才重渲染。
 *
 * 订阅粒度刻意分两层：本组件订表头需要的（标题、类型、项数），卡片数据交给 `GroupItems`。
 * 改某张卡片的配置时表头那几样都没变，`memo(SortableGroup)` / `memo(GroupPanel)`
 * 直接跳过整块表头 —— 真正重渲染的只有那张卡片。
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
}: BoardGroupSlotProps): React.ReactNode {
  const group = useBoardGroup(groupId)

  /*
   * 这些回调都必须固定引用：它们被透传到 `memo(GroupPanel)` 的比较里，
   * 每次渲染新建闭包会让表头重新渲染。四个位置按钮共用同一个 `onMove`，各自预绑移动方式。
   */
  const handleMoveToTop = useCallback(() => onMove(groupId, 'top'), [onMove, groupId])
  const handleMoveUp = useCallback(() => onMove(groupId, 'up'), [onMove, groupId])
  const handleMoveDown = useCallback(() => onMove(groupId, 'down'), [onMove, groupId])
  const handleMoveToBottom = useCallback(() => onMove(groupId, 'bottom'), [onMove, groupId])
  const handleAddItem = useCallback(() => onAddItem(groupId), [onAddItem, groupId])
  const handleEdit = useCallback(() => onEditGroup(groupId), [onEditGroup, groupId])

  /*
   * ⚠️ 这个 children 必须是引用稳定的元素：它是"表头不重渲染"的另一半条件。
   * `GroupItems` 自己订阅卡片数据；元素引用不变，卡片变化就不会沿 children 传染到表头。
   */
  const grid = useMemo(
    () => (
      <GroupItems groupId={groupId} editMode={editMode} onEditItem={onEditItem} />
    ),
    [groupId, editMode, onEditItem],
  )

  // 分组已被删除（结构快照与当前数据短暂不同步）：这一格先空着，父层马上会重排
  if (!group) {
    return null
  }

  return (
    <SortableGroup
      title={group.title}
      typeLabel={groupTypeLabel(group.type)}
      addItemLabel={addItemLabel(group.type)}
      itemCount={group.items.length}
      editMode={editMode}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onMoveToTop={handleMoveToTop}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onMoveToBottom={handleMoveToBottom}
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
  onEditItem: (groupId: string, itemId: string) => void
}

/**
 * 分组内的卡片网格。自己订阅所属分组：卡片数据变化时只重渲染这一块，表头不受影响。
 * `handleEditItem` 预绑分组 id，让组内所有卡片共用同一个函数引用，`memo(SortableCard)`
 * 才能拦住未变化的卡片。
 */
function GroupItems({ groupId, editMode, onEditItem }: GroupItemsProps): React.ReactNode {
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
      onEditItem={handleEditItem}
    />
  )
}
