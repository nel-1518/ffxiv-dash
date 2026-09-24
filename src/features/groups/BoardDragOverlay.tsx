import { memo } from 'react'
import { DragOverlay, useDndContext } from '@dnd-kit/core'
import { readItem } from '../../state/board-store.ts'
import { CardFace } from '../navigation/CardFace.tsx'
import { DragHandle } from '../navigation/DragHandle.tsx'
import type { Item } from '../../core/storage/types.ts'

/**
 * 跟随指针的虚影：复用 `CardFace`，与列表里的实体卡片同一份外观。
 *
 * dnd-kit 的 sortable 只在 activeIndex / overIndex 都落在同一个 SortableContext 里时
 * 才让原卡片跟随指针；卡片被拖到别的分组时这两个下标对不上，原卡片会"僵在原地"。
 * 所以统一用 DragOverlay 渲染实体，原卡片只留一个半透明的占位（见 SortableCard）。
 *
 * 尺寸由 DragOverlay 的外层盒子（= 被拖卡片拖起瞬间的实测尺寸）决定，
 * 这里只管铺满它并加一点抬起感（阴影），dropAnimation 也能像素级落回原卡槽。
 * 预览里的编辑/删除按钮不接动作，拖动中点击它们不会触发任何副作用。
 *
 * ⚠️ `memo` + 模块级常量（`LIFT_STYLE` / `INERT_HANDLE` / `NOOP`）是必需的：
 * DragOverlay 会跟着指针每一帧重渲染它自己的孩子，不固定住的话预览里那棵 antd 子树
 * （Card + 三个 Tooltip 的 rc-trigger 机器）会一帧一动，拖起来就是持续掉帧。
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
 * 虚影宿主。
 *
 * ⚠️ **它单独存在，是为了把拖拽带来的重渲染挡在"只含虚影"的小子树里。**
 *
 * 这里刻意**不持任何状态**：正在拖的是谁直接从 dnd-kit 的 context 读
 * （`useDndContext().active`）。如果换成把 activeId 存在 `GroupBoard` 里，
 * 每次拖拽开始都要 `setState` 一次 → `GroupBoard` 整棵元素树（所有 Row/Col/槽位）
 * 跟着重建，`DndContext` 的 children 也换新 → 连锁到每一张卡片。
 * 实测（24 张卡、dev 构建）：拖拽起始的卡顿约 780ms 阻塞，
 * 把状态挪出 `GroupBoard` + 给卡片外观加 `memo` 之后降到 ~190ms。
 *
 * `readItem` 是即时的 store 读取，不订阅 —— 虚影内容只在拖拽开始那一刻需要。
 */
export function BoardDragOverlay(): React.ReactNode {
  const { active } = useDndContext()
  const item = active ? readItem(String(active.id)) : undefined

  return <DragOverlay dropAnimation={DROP_ANIMATION}>{item ? <DragPreview item={item} /> : null}</DragOverlay>
}
