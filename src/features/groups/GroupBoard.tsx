import { useCallback, useMemo } from 'react'
import { Col, Empty, Flex, Row } from 'antd'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { boardActions, readGroup, readGroupIdOfItem, readGroupIds } from '../../state/board-store.ts'
import { BoardDragOverlay } from './BoardDragOverlay.tsx'
import { BoardGroupSlot } from './BoardGroupSlot.tsx'
import { groupsPerRow } from './group-types.ts'
import type { GroupMove, GroupRow } from './group-types.ts'
import { parseDragData } from '../navigation/drag-types.ts'

export type GroupBoardProps = {
  /**
   * 分行后的分组结构，由 `BoardSurface` 订阅后传入。
   *
   * 收结构而不是 `Group[]`：本组件因此**完全不订阅看板数据**，只在分组增删、
   * 分组重排时重渲染（那时行结构真的变了）。卡片内容的变化不会惊动这里。
   */
  rows: GroupRow[]
  /** 是否处于编辑模式：关闭时隐藏手柄、分组操作与卡片上的编辑/删除。 */
  editMode: boolean
  onAddItem: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onEditItem: (groupId: string, itemId: string) => void
}

const GRID_COLUMNS = 24

/**
 * 只允许同 kind 的卡片互相吸附。
 *
 * 可拖拽容器只有卡片一种（`useSortableCard` 是唯一的 `useSortable` 调用点），
 * 所以这里只需要区分 kind：否则把链接卡拖过组件卡时，组件卡会先"让位"再弹回来 ——
 * 目标其实无效（reducer 的 `canPlaceItem` 会拒掉），却先动了一下，看起来像丢了位置。
 *
 * 找不到任何同类候选时回退到全量中心距离，保证拖拽不会"卡死"。
 */
const sameKindCollision: CollisionDetection = (args) => {
  const activeKind = parseDragData(args.active.data.current ?? undefined)?.kind

  const candidates = args.droppableContainers.filter((container) => {
    const overKind = parseDragData(container.data.current ?? undefined)?.kind
    // 任一侧读不出 kind 就不参与筛选，避免因为拿不到 data 而把候选清空
    return !activeKind || !overKind || activeKind === overKind
  })

  return candidates.length > 0 ? closestCenter({ ...args, droppableContainers: candidates }) : closestCenter(args)
}

/**
 * 项目（分组）的位置调整：置顶 / 上移 / 下移 / 置底。
 *
 * 做成**模块级函数**（而不是组件内的闭包）：它的引用因此永远不变，可以直接喂给
 * `memo(BoardGroupSlot)` 的比较，不需要再套一层 `useCallback`。
 * 顺序在**调用那一刻**从 store 读，所以也不存在闭包捕获到过期顺序的问题。
 *
 * ⚠️ `readGroupIds()` 返回的是 store 里的缓存数组，**只能读不能改**，所以要复制一份再挪。
 * 置顶 / 置底是把元素**摘出来再插回首尾**（不是逐步换位）：中间隔着多少个分组都一步到位。
 */
function moveGroup(groupId: string, move: GroupMove): void {
  const currentIds = readGroupIds()
  const currentIndex = currentIds.indexOf(groupId)
  if (currentIndex < 0) {
    return
  }

  const targetIndex =
    move === 'top'
      ? 0
      : move === 'bottom'
        ? currentIds.length - 1
        : currentIndex + (move === 'up' ? -1 : 1)
  if (targetIndex < 0 || targetIndex >= currentIds.length || targetIndex === currentIndex) {
    return
  }

  const nextIds = [...currentIds]
  const [movedId] = nextIds.splice(currentIndex, 1)
  nextIds.splice(targetIndex, 0, movedId)
  boardActions.reorderGroups(nextIds)
}

/**
 * 拖拽编排层。
 *
 * 传感器说明：
 * - PointerSensor + activationConstraint.distance 让"点卡片"和"拖卡片"分开，
 *   卡片内的链接点击、图标按钮点击不会被误判成拖拽。
 * - KeyboardSensor + sortableKeyboardCoordinates 让键盘也能完成排序。
 *
 * 拖拽手柄只绑在 DragHandle 上，因此整张卡片可以自由放交互元素。
 *
 * 所有涉及分组归属的判断都在**事件回调里**即时读 store（`read*` 系列），
 * 既不需要订阅，也不存在闭包捕获到过期数据的问题。
 *
 * ⚠️ 这一层**不持有任何拖拽状态**：正在拖的是谁、虚影怎么飞回去都由
 * `BoardDragOverlay` 交给 dnd-kit 自己的机制处理。
 * 拖拽开始/结束那一刻在这里 `setState`，会让整棵看板元素树重建 —— 拖拽的卡顿与
 * "落位后闪一下"都出在这两条上（详见 README 的「拖拽性能」一节）。
 */
export function GroupBoard({
  rows,
  editMode,
  onAddItem,
  onEditGroup,
  onEditItem,
}: GroupBoardProps): React.ReactNode {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** 分组 id → 全局下标。表头的四个位置按钮靠它判断置顶/上移/下移/置底是否可用。 */
  const positions = useMemo(() => {
    const map = new Map<string, number>()
    let index = 0
    for (const row of rows) {
      for (const id of row.ids) {
        map.set(id, index)
        index += 1
      }
    }
    return map
  }, [rows])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const draggedId = String(active.id)
    if (!over || active.id === over.id) {
      return
    }

    const overId = String(over.id)
    const activeData = parseDragData(active.data.current ?? undefined)
    const overData = parseDragData(over.data.current ?? undefined)

    // dnd-kit 偶尔拿不到 data.current，那时用 id 归属反推所在的卡片
    const sourceGroupId = activeData?.groupId ?? readGroupIdOfItem(draggedId)
    const targetGroupId = overData?.groupId ?? readGroupIdOfItem(overId)
    if (!sourceGroupId || !targetGroupId) {
      return
    }

    if (sourceGroupId === targetGroupId) {
      const group = readGroup(sourceGroupId)
      if (!group) {
        return
      }
      const currentIds = group.items.map((item) => item.id)
      if (currentIds.every((id) => id !== overId)) {
        return
      }
      const nextIds = reorder(currentIds, draggedId, overId)
      if (!isSameOrder(currentIds, nextIds)) {
        boardActions.reorderItems(sourceGroupId, nextIds)
      }
      return
    }

    boardActions.moveItemToGroup(draggedId, sourceGroupId, targetGroupId, overId)
  }, [])

  if (rows.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          editMode ? '还没有任何项目，点击右上角“新建项目”开始' : '还没有任何项目，点击右上角的编辑按钮开始'
        }
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={sameKindCollision}
      onDragEnd={handleDragEnd}
    >
      <Flex vertical>
        {rows.map((row) => (
          <Row key={row.ids[0]} gutter={[16, 16]} align="stretch">
            {row.ids.map((groupId) => {
              const position = positions.get(groupId) ?? 0
              return (
                <Col
                  key={groupId}
                  // 每个分组的宽度由"同类一行放几个"决定；不足一行时自动拉伸铺满。
                  span={GRID_COLUMNS / groupsPerRow(row.type)}
                  xs={24}
                >
                  <BoardGroupSlot
                    groupId={groupId}
                    editMode={editMode}
                    // 边界只跟 id 顺序有关，所以是布尔值 —— 槽位的 memo 因此能挡住无关的重渲染；
                    // 「置顶」与「上移」的可用条件同为"不是第一个"，「置底」与「下移」同为"不是最后一个"
                    canMoveUp={position > 0}
                    canMoveDown={position < positions.size - 1}
                    onMove={moveGroup}
                    onAddItem={onAddItem}
                    onEditGroup={onEditGroup}
                    onEditItem={onEditItem}
                  />
                </Col>
              )
            })}
          </Row>
        ))}
      </Flex>

      <BoardDragOverlay />
    </DndContext>
  )
}

/** 顺序是否完全一致；用于跳过"拖回原位"这类无变化的提交。 */
function isSameOrder(ids: string[], next: string[]): boolean {
  return ids.length === next.length && ids.every((id, index) => id === next[index])
}

/** 把 fromId 移动到 toId 的位置，返回新顺序。 */
function reorder(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(toId)
  if (from < 0 || to < 0 || from === to) {
    return ids
  }
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, fromId)
  return next
}
