import { memo } from 'react'
import { DragOverlay, useDndContext } from '@dnd-kit/core'
import { readItem } from '../../state/board-store.ts'
import { CardFace } from '../navigation/CardFace.tsx'
import { DragHandle } from '../navigation/DragHandle.tsx'
import type { Item } from '../../core/storage/types.ts'

/**
 * 跟随指针的虚影：复用 `CardFace`，与列表里的实体卡片同一份外观。
 *
 * dnd-kit 的 sortable 只在 activeIndex / overIndex 落在同一个 SortableContext 时才让原卡片
 * 跟随指针；拖到别的分组时下标对不上，原卡片会"僵在原地"。所以统一用 DragOverlay 渲染，
 * 原卡片只留半透明占位（见 SortableCard）。
 *
 * 尺寸由 DragOverlay 的外层盒子（被拖卡片拖起瞬间的实测尺寸）决定，这里只管铺满；
 * 预览里的编辑/删除按钮不接动作。
 *
 * ⚠️ `memo` + 模块级常量（`LIFT_STYLE` / `INERT_HANDLE` / `NOOP`）是必需的：
 * DragOverlay 每帧重渲染它的孩子，不固定住的话预览里那棵 antd 子树会一帧一动、持续掉帧。
 */
const DragPreview = memo(function DragPreview({ item }: { item: Item }): React.ReactNode {
  return (
    <div style={LIFT_STYLE}>
      <CardFace
        item={item}
        // 拖拽只在编辑模式发生，预览照着编辑模式的卡片画，虚影与实体才一致
        editMode
        handle={INERT_HANDLE}
        onEdit={NOOP}
        onRemove={NOOP}
      />
    </div>
  )
})

/** 抬起感：阴影由外层承担，预览盒子本身铺满 DragOverlay 的尺寸。 */
const LIFT_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  boxShadow: 'var(--ant-box-shadow-secondary)',
  cursor: 'grabbing',
}

const NOOP = (): void => {}

/** 惰性手柄：只画外观、不接收指针事件，拖拽中不会抢走指针 */
const INERT_HANDLE = <DragHandle inert />

/** 落位动画：虚影从当前落点飞到实体卡槽。 */
const DROP_ANIMATION = { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

/**
 * 虚影宿主。它单独存在，是为了把拖拽带来的重渲染挡在"只含虚影"的小子树里。
 *
 * ⚠️ 刻意不持任何状态：正在拖的是谁直接从 dnd-kit 的 context 读（`useDndContext().active`）。
 * 若把 activeId 存进 `GroupBoard`，每次拖拽开始都 `setState` → 整棵看板元素树重建 →
 * 连锁到每一张卡片（实测拖拽起始卡顿从数百 ms 级降到流畅）。
 *
 * `readItem` 是即时读取、不订阅 —— 虚影内容只在拖拽开始那一刻需要。
 */
export function BoardDragOverlay(): React.ReactNode {
  const { active } = useDndContext()
  const item = active ? readItem(String(active.id)) : undefined

  return <DragOverlay dropAnimation={DROP_ANIMATION}>{item ? <DragPreview item={item} /> : null}</DragOverlay>
}
