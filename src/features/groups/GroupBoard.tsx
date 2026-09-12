import { useEffect, useState } from 'react'
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
import { useBoard, useBoardActions } from '../../state/hooks.ts'
import { ItemGrid } from '../navigation/ItemGrid.tsx'
import { CardFace } from '../navigation/CardFace.tsx'
import { DragHandle } from './DragHandle.tsx'
import { SortableGroup } from './SortableGroup.tsx'
import { DROP_LANDING_MS, parseDragData } from './drag-types.ts'
import { groupsPerRow } from './group-types.ts'
import type { Group, GroupType, Item } from '../../core/storage/types.ts'

export type GroupBoardProps = {
  groups: Group[]
  /** 是否处于编辑模式：关闭时隐藏手柄、分组操作与卡片上的编辑/删除。 */
  editMode: boolean
  onAddItem: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onEditItem: (groupId: string, itemId: string) => void
  onRemoveItem: (groupId: string, itemId: string) => void
}

/** 一行内的分组切片：连续的同类型分组按 perRow 分组，每组渲染成一个 Row。 */
type GroupRow = { type: GroupType; entries: Group[] }

const GRID_COLUMNS = 24

/**
 * 把分组切成"行"。
 *
 * 规则：连续的同类分组按该类型的 perRow 切片；类型切换时立即断行。
 * 小组件的 perRow 是 1，因此每个小组件分组独占一行。
 */
function splitIntoRows(groups: Group[]): GroupRow[] {
  const rows: GroupRow[] = []
  let current: GroupRow | undefined

  for (const entry of groups) {
    const type = entry.type
    const capacity = groupsPerRow(type)
    const canAppend = current && current.type === type && current.entries.length < capacity
    if (canAppend && current) {
      current.entries.push(entry)
      continue
    }
    current = { type, entries: [entry] }
    rows.push(current)
  }

  return rows
}

function findGroupIdByItemId(
  groups: { id: string; items: { id: string }[] }[],
  itemId: string,
): string | undefined {
  return groups.find((group) => group.items.some((item) => item.id === itemId))?.id
}

/** 从看板里找出正在被拖拽的那张卡片。 */
function findDraggedItem(doc: { groups: Group[] }, activeId: string | null): Item | null {
  if (!activeId) {
    return null
  }
  for (const group of doc.groups) {
    const item = group.items.find((candidate) => candidate.id === activeId)
    if (item) {
      return item
    }
  }
  return null
}

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
 * 拖拽编排层。
 *
 * 传感器说明：
 * - PointerSensor + activationConstraint.distance 让"点卡片"和"拖卡片"分开，
 *   卡片内的链接点击、图标按钮点击不会被误判成拖拽。
 * - KeyboardSensor + sortableKeyboardCoordinates 让键盘也能完成排序。
 *
 * 拖拽手柄只绑在 DragHandle 上，因此整张卡片可以自由放交互元素。
 */
export function GroupBoard({
  groups,
  editMode,
  onAddItem,
  onEditGroup,
  onEditItem,
  onRemoveItem,
}: GroupBoardProps): React.ReactNode {
  const doc = useBoard()
  const actions = useBoardActions()
  const [activeId, setActiveId] = useState<string | null>(null)
  /** 刚落下的那一项：DragOverlay 还在飞回卡槽，原卡片先半透明占位。 */
  const [landingId, setLandingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const rows = splitIntoRows(groups)
  const draggedItem = findDraggedItem(doc, activeId)

  // 落位动画播完就把占位态收回，卡片淡入到实体状态
  useEffect(() => {
    if (!landingId) {
      return
    }
    const timer = window.setTimeout(() => setLandingId(null), DROP_LANDING_MS)
    return () => window.clearTimeout(timer)
  }, [landingId])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const draggedId = String(active.id)
    setActiveId(null)
    // 不管顺序有没有变，实体都会飞回卡槽，所以占位态统一挂上
    setLandingId(draggedId)
    if (!over || active.id === over.id) {
      return
    }

    const activeId = draggedId
    const overId = String(over.id)
    const activeData = parseDragData(active.data.current ?? undefined)
    const overData = parseDragData(over.data.current ?? undefined)

    // dnd-kit 偶尔拿不到 data.current，那时用 id 归属反推所在的卡片
    const sourceGroupId = activeData?.groupId ?? findGroupIdByItemId(doc.groups, activeId)
    const targetGroupId = overData?.groupId ?? findGroupIdByItemId(doc.groups, overId)
    if (!sourceGroupId || !targetGroupId) {
      return
    }

    if (sourceGroupId === targetGroupId) {
      const group = doc.groups.find((entry) => entry.id === sourceGroupId)
      if (!group) {
        return
      }
      const currentIds = group.items.map((item) => item.id)
      if (currentIds.every((id) => id !== overId)) {
        return
      }
      const nextIds = reorder(currentIds, activeId, overId)
      if (!isSameOrder(currentIds, nextIds)) {
        actions.reorderItems(sourceGroupId, nextIds)
      }
      return
    }

    actions.moveItemToGroup(activeId, sourceGroupId, targetGroupId, overId)
  }

  const moveGroup = (groupId: string, direction: -1 | 1) => {
    const currentIds = doc.groups.map((group) => group.id)
    const currentIndex = currentIds.indexOf(groupId)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentIds.length) {
      return
    }
    const nextIds = [...currentIds]
    ;[nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]]
    actions.reorderGroups(nextIds)
  }

  if (groups.length === 0) {
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
      onDragCancel={() => setActiveId(null)}
    >
      <Flex vertical gap={16}>
        {rows.map((row) => (
            <Row key={row.entries[0].id} gutter={[16, 16]} align="stretch">
              {row.entries.map((entry) => (
                <Col
                  key={entry.id}
                  // 每个分组的宽度由"同类一行放几个"决定；不足一行时自动拉伸铺满。
                  span={GRID_COLUMNS / groupsPerRow(row.type)}
                  xs={24}
                >
                  <SortableGroup
                    group={entry}
                    editMode={editMode}
                    canMoveUp={doc.groups[0]?.id !== entry.id}
                    canMoveDown={doc.groups[doc.groups.length - 1]?.id !== entry.id}
                    onMoveUp={() => moveGroup(entry.id, -1)}
                    onMoveDown={() => moveGroup(entry.id, 1)}
                    onAddItem={() => onAddItem(entry.id)}
                    onEdit={() => onEditGroup(entry.id)}
                  >
                    <ItemGrid
                      group={entry}
                      items={entry.items}
                      editMode={editMode}
                      landingItemId={landingId}
                      onEditItem={(itemId) => onEditItem(entry.id, itemId)}
                      onRemoveItem={(itemId) => onRemoveItem(entry.id, itemId)}
                    />
                  </SortableGroup>
                </Col>
              ))}
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
