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
 * 看板区域（分组面板与卡片的整体），存在的唯一理由是订阅隔离：只订阅分行后的结构
 * （useBoardGroupRows），卡片内容变化不影响它，重渲染只到这里、由 memo(BoardGroupSlot) 接住。
 * ⚠️ 外面这层 memo 必需：父层会因弹窗/编辑模式/搜索词重渲染，不拦住就会冲进 GroupBoard，
 * DndContext 会把每张卡片都唤醒。
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
