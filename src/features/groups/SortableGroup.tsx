import { memo } from 'react'
import { GroupPanel } from './GroupPanel.tsx'

export type SortableGroupProps = {
  /** 表头需要的三样原始值，理由见 `GroupPanel`。 */
  title: string
  typeLabel: string
  itemCount: number
  /** 是否处于编辑模式，透传给 GroupPanel 决定表头操作是否显示。 */
  editMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** 四个位置按钮，顺序即表头里的顺序：置顶 → 上移 → 下移 → 置底。 */
  onMoveToTop: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToBottom: () => void
  onAddItem: () => void
  onEdit: () => void
  children: React.ReactNode
}

/**
 * 分组容器。分组排序由标题行的上下按钮完成，组内项目仍在 ItemGrid 中拖拽。
 *
 * 外面这层 `memo` 只是顺手挡一下：父层（`BoardGroupSlot`）会因为本组数据变化而重渲染，
 * 但表头的三个值与 children 元素都没变时，这里连同下面的 `GroupPanel` 一起跳过。
 */
export const SortableGroup = memo(function SortableGroup({
  title,
  typeLabel,
  itemCount,
  editMode,
  canMoveUp,
  canMoveDown,
  onMoveToTop,
  onMoveUp,
  onMoveDown,
  onMoveToBottom,
  onAddItem,
  onEdit,
  children,
}: SortableGroupProps): React.ReactNode {
  return (
    <div style={{ height: '100%' }}>
      <GroupPanel
        title={title}
        typeLabel={typeLabel}
        itemCount={itemCount}
        editMode={editMode}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onMoveToTop={onMoveToTop}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onMoveToBottom={onMoveToBottom}
        onAddItem={onAddItem}
        onEdit={onEdit}
      >
        {children}
      </GroupPanel>
    </div>
  )
})
