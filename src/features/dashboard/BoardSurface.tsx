import { memo } from 'react'
import { useBoardGroupRows } from '../../state/hooks.ts'
import { GroupBoard } from '../groups/GroupBoard.tsx'

export type BoardSurfaceProps = {
  /** 是否处于编辑模式，透传给看板。 */
  editMode: boolean
  onAddItem: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onEditItem: (groupId: string, itemId: string) => void
}

/**
 * 看板区域（分组面板与卡片的整体）。
 *
 * 它存在的唯一理由是订阅隔离：`DashboardPage` 只负责顶栏、弹窗与编辑模式开关，
 * 它自己去读 `doc.groups` 的话整页会跟着任何一次卡片改动重渲染。
 *
 * 订阅的是分行后的结构（`useBoardGroupRows`）：卡片内容变化不影响它，
 * 且重渲染只到这里 —— 下面的 `memo(BoardGroupSlot)` 靠稳定的 props 拦住。
 *
 * 外面的 `memo` 不是可有可无：父层会因弹窗开关、编辑模式、搜索关键词等界面状态重渲染，
 * 没有这层拦截就会冲到 `GroupBoard`，dnd-kit 的 DndContext 会把每一张卡片都唤醒。
 */
export const BoardSurface = memo(function BoardSurface({
  editMode,
  onAddItem,
  onEditGroup,
  onEditItem,
}: BoardSurfaceProps): React.ReactNode {
  const rows = useBoardGroupRows()

  return (
    <div className="dash-container">
      <GroupBoard
        rows={rows}
        editMode={editMode}
        onAddItem={onAddItem}
        onEditGroup={onEditGroup}
        onEditItem={onEditItem}
      />
    </div>
  )
})
