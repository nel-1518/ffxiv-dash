import { GroupPanel } from './GroupPanel.tsx'
import type { Group } from '../../core/storage/types.ts'

export type SortableGroupProps = {
  group: Group
  /** 是否处于编辑模式，透传给 GroupPanel 决定表头操作是否显示。 */
  editMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onAddItem: () => void
  onEdit: () => void
  children: React.ReactNode
}

/**
 * 分组容器。分组排序由标题行的上下按钮完成，组内项目仍在 ItemGrid 中拖拽。
 */
export function SortableGroup({
  group,
  editMode,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onAddItem,
  onEdit,
  children,
}: SortableGroupProps): React.ReactNode {
  return (
    <div style={{ height: '100%' }}>
      <GroupPanel
        group={group}
        editMode={editMode}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onAddItem={onAddItem}
        onEdit={onEdit}
      >
        {children}
      </GroupPanel>
    </div>
  )
}
