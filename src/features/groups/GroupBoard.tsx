import { useCallback, useEffect, useMemo, useState } from 'react'
import { Col, Empty, Flex, Row } from 'antd'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { boardActions, readGroup, readGroupIdOfItem, readGroupIds, readItem } from '../../state/board-store.ts'
import { BoardGroupSlot } from './BoardGroupSlot.tsx'
import { CardFace } from '../navigation/CardFace.tsx'
import { DragHandle } from './DragHandle.tsx'
import { DROP_LANDING_MS, parseDragData } from './drag-types.ts'
import { groupsPerRow } from './group-types.ts'
import type { GroupMove, GroupRow } from './group-types.ts'
import type { Item } from '../../core/storage/types.ts'

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
 */
export function GroupBoard({
  rows,
  editMode,
  onAddItem,
  onEditGroup,
  onEditItem,
}: GroupBoardProps): React.ReactNode {
  const [activeId, setActiveId] = useState<string | null>(null)
  /** 刚落下的那一项：DragOverlay 还在飞回卡槽，原卡片先半透明占位。 */
  const [landingId, setLandingId] = useState<string | null>(null)

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

  // 拖拽虚影要画实体卡片：按 id 即时取当前数据，不必订阅（重画由 activeId 触发）
  const draggedItem = activeId === null ? null : (readItem(activeId) ?? null)

  // 落位动画播完就把占位态收回，卡片淡入到实体状态
  useEffect(() => {
    if (!landingId) {
      return
    }
    const timer = window.setTimeout(() => setLandingId(null), DROP_LANDING_MS)
    return () => window.clearTimeout(timer)
  }, [landingId])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const draggedId = String(active.id)
    setActiveId(null)
    // 不管顺序有没有变，实体都会飞回卡槽，所以占位态统一挂上
    setLandingId(draggedId)
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

  const handleDragCancel = useCallback(() => setActiveId(null), [])

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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
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
                    landingItemId={landingId}
                  />
                </Col>
              )
            })}
          </Row>
        ))}
      </Flex>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {draggedItem ? <DragPreview item={draggedItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * 拖拽时跟随指针的预览。
 *
 * dnd-kit 的 sortable 只在 activeIndex / overIndex 都落在同一个 SortableContext 里时
 * 才让原卡片跟随指针；卡片被拖到别的分组时这两个下标对不上，原卡片会"僵在原地"。
 * 所以统一用 DragOverlay 渲染实体，原卡片只留一个半透明的占位（见 SortableCard）。
 *
 * 预览复用 `CardFace`（与列表里实体卡片同一份外观），因此拖起来就是"整张卡片被拿起"：
 * 尺寸由 DragOverlay 的外层盒子（= 被拖卡片拖起瞬间的实测尺寸）决定，
 * 这里只管铺满它并加一点抬起感（zIndex/阴影），dropAnimation 也能像素级落回原卡槽。
 *
 * 注意：预览里的编辑/删除按钮不接动作，拖动中点击它们不会触发任何副作用。
 */
function DragPreview({ item }: { item: Item }): React.ReactNode {
  /** 抬起感：阴影由外层承担，预览盒子本身铺满 DragOverlay 的尺寸。 */
  const liftStyle: React.CSSProperties = {
    maxWidth: '100%',
    boxShadow: 'var(--ant-box-shadow-secondary)',
    cursor: 'grabbing',
  }
  const noop = () => {}

  return (
    <div style={liftStyle}>
      <CardFace
        item={item}
        // 拖拽只在编辑模式发生，预览照着编辑模式的卡片画，虚影与实体才一致
        editMode
        handle={<DragHandle inert />}
        onEdit={noop}
        onRemove={noop}
      />
    </div>
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
