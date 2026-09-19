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
 * 它存在的唯一理由是**订阅隔离**：`DashboardPage` 只负责顶栏、弹窗与编辑模式开关，
 * 一旦它自己去读 `doc.groups`，整页（含顶栏、搜索框、设置入口）就会跟着任何一次
 * 卡片改动重渲染。订阅放在这里，`DashboardPage` 就不碰看板数据。
 *
 * 订阅的是**分行后的结构**（`useBoardGroupRows`）：卡片内容变化不影响它，
 * 只有新建/删除分组、分组重排、以及切换编辑模式（本地状态）才会重渲染。
 * 而且重渲染也只到这里 —— 下面的 `memo(BoardGroupSlot)` 靠稳定的 props 全部拦住。
 *
 * 外面的 `memo` 不是可有可无：父层（`DashboardPage`）会因为弹窗开关、编辑模式、
 * 搜索关键词这些**界面状态**重渲染，没有这层拦截就会直接冲到 `GroupBoard`，
 * 而 `GroupBoard` 一旦重渲染，dnd-kit 的 DndContext 会把**每一张卡片**都唤醒。
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
