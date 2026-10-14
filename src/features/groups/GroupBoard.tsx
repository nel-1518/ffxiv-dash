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
import { groupsPerRow } from '../../core/group-rules.ts'
import type { GroupMove } from './group-types.ts'
import type { GroupRow } from '../../state/group-rows.ts'
import { parseDragData } from '../navigation/drag-types.ts'

export type GroupBoardProps = {
  /** 分行后的分组结构（`BoardSurface` 订阅后传入）；收结构不收 `Group[]`，本组件不订阅看板数据。 */
  rows: GroupRow[]
  /** 是否处于编辑模式：关闭时隐藏手柄、分组操作与卡片上的编辑/删除。 */
  editMode: boolean
  onAddItem: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onEditItem: (groupId: string, itemId: string) => void
}

const GRID_COLUMNS = 24

/**
 * 只允许同 kind 的卡片互相吸附：否则链接卡拖过组件卡时，组件卡会先「让位」再弹回——
 * 目标其实无效（reducer 的 canPlaceItem 会拒），却像丢了位置。
 * 找不到同类候选时回退到全量中心距离，保证拖拽不会「卡死」。
 */
const sameKindCollision: CollisionDetection = (args) => {
  const activeKind = parseDragData(args.active.data.current ?? undefined)?.kind

  const candidates = args.droppableContainers.filter((container) => {
    const overKind = parseDragData(container.data.current ?? undefined)?.kind
    // 任一侧读不出 kind 就不参与筛选，避免拿不到 data 时把候选清空
    return !activeKind || !overKind || activeKind === overKind
  })

  return candidates.length > 0 ? closestCenter({ ...args, droppableContainers: candidates }) : closestCenter(args)
}

/**
 * 分组位置调整（置顶 / 上移 / 下移 / 置底）。模块级函数：引用恒定可直接喂 `memo(BoardGroupSlot)`，顺序在调用那一刻
 * 从 store 读、无闭包过期问题。⚠️ `readGroupIds()` 返回 store 缓存数组只读不改，挪动前复制；置顶/置底是摘出再插回首尾，一步到位。
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
 * 拖拽编排层。传感器：PointerSensor + activationConstraint.distance 分开「点卡片」与「拖卡片」
 * （卡内链接、图标按钮不被误判）；KeyboardSensor 让键盘也能排序；手柄只绑在 DragHandle 上，
 * 整卡可自由放交互元素。归属判断在回调里即时读 store（`read*` 系列），不订阅、无闭包过期问题。
 * ⚠️ 拖拽性能约定：本层不持有任何拖拽状态——正在拖的是谁、虚影怎么飞回都交给 dnd-kit
 * （见 `BoardDragOverlay`）；在拖拽开始/结束时刻 setState 会重建整棵看板元素树、连锁到每张卡片，
 * 拖拽卡顿与「落位后闪一下」都出在这（docs/development.md「拖拽」一节）。
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

  /** 分组 id → 全局下标；表头四个位置按钮靠它判断置顶/上移/下移/置底是否可用。 */
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

    // dnd-kit 偶尔拿不到 data.current，此时用 id 归属反推所在卡片
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
          editMode ? '还没有任何分组，点击右上角“新建分组”开始' : '还没有任何分组，点击右上角的编辑按钮开始'
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
                  // 每个分组的宽度由「同类一行放几个」决定；不足一行时自动拉伸铺满
                  span={GRID_COLUMNS / groupsPerRow(row.type)}
                  xs={24}
                >
                  <BoardGroupSlot
                    groupId={groupId}
                    editMode={editMode}
                    // 边界只跟 id 顺序有关，传布尔值让槽位的 memo 挡住无关重渲染：
                    // 「置顶」「上移」同为不是第一个可用，「置底」「下移」同为不是最后一个可用
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
