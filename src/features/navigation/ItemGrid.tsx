import { Empty } from 'antd'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SortableCard } from './SortableCard.tsx'
import type { CSSProperties } from 'react'
import type { Group, Item } from '../../core/storage/types.ts'

export type ItemGridProps = {
  group: Group
  items: Item[]
  /** 是否处于编辑模式：关闭时不渲染拖拽手柄，卡片也就无法拖拽。 */
  editMode: boolean
  /** 刚刚落下、还在等 DragOverlay 落定的卡片 id。 */
  landingItemId: string | null
  onEditItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
}

/**
 * 分组内的卡片网格。
 *
 * 排布用 CSS Grid 而不是 antd 的 Row/Col：列数可由用户按 1-6 配置，
 * 而 24 栅格切不出 5 列这种整数之外的份数。列数通过自定义属性下发，
 * 窄屏由 global.css 的媒体查询自动降列（列数越多降得越狠）；间距也由 global.css
 * 按分组类型给（网页导航 8px、小组件 12px）。
 *
 * 这里还给本组卡片套了一层 SortableContext：卡片的"让位动画"需要
 * dnd-kit 知道它们同属一个可排序列表（activeIndex / overIndex 都取自这里）。
 * 没有它，拖拽中的卡片不会跟随指针，落位也不会有过渡。
 */
export function ItemGrid({
  group,
  items,
  editMode,
  landingItemId,
  onEditItem,
  onRemoveItem,
}: ItemGridProps): React.ReactNode {
  if (items.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该项目暂无内容，点击右上角 ＋ 添加" />
    )
  }

  const columns = group.columns
  // 小组件分组统一卡片高度（见 global.css 的 .dash-item-grid--widget）
  const gridClassName = group.type === 'widget' ? 'dash-item-grid dash-item-grid--widget' : 'dash-item-grid'

  // 窄屏降列：中屏最多 3 列、小屏最多 2 列、手机 1 列
  const gridStyle = {
    '--dash-grid-columns': columns,
    '--dash-grid-columns-md': Math.min(columns, 3),
    '--dash-grid-columns-sm': Math.min(columns, 2),
  } as CSSProperties

  return (
    <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
      <div className={gridClassName} style={gridStyle}>
        {items.map((item) => (
          <SortableCard
            key={item.id}
            item={item}
            groupId={group.id}
            editMode={editMode}
            isLanding={item.id === landingItemId}
            onEdit={() => onEditItem(item.id)}
            onRemove={() => onRemoveItem(item.id)}
          />
        ))}
      </div>
    </SortableContext>
  )
}
