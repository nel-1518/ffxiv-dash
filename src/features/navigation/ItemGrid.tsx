import { memo } from 'react'
import { Empty } from 'antd'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SortableCard } from './SortableCard.tsx'
import { useStableIdList } from './useStableIdList.ts'
import type { CSSProperties } from 'react'
import type { GroupType, Item } from '../../core/storage/types.ts'

export type ItemGridProps = {
  /** 所属分组，作为卡片的拖拽归属信息下发。 */
  groupId: string
  items: Item[]
  /**
   * 列数与分组类型收的是**原始值**而不是整个 `Group` 对象。
   * 传对象的话，分组里任何一张卡片变化都会让本组所有网格判定为"变了"，
   * 下面的 `memo` 就白套了。
   */
  columns: number
  groupType: GroupType
  /** 是否处于编辑模式：关闭时不渲染拖拽手柄，卡片也就无法拖拽。 */
  editMode: boolean
  /** 刚刚落下、还在等 DragOverlay 落定的卡片 id。 */
  landingItemId: string | null
  /**
   * 打开某张卡片的编辑弹窗。
   *
   * 传「卡片 id」而不是「无参闭包」是刻意的：这样所有卡片拿到的是**同一个函数引用**，
   * 外层 `memo(SortableCard)` 才能真正拦住未变化的卡片。同一个槽位里 `groupId` 不会变，
   * 所以调用方（`BoardGroupSlot`）能把它 `useCallback` 成一个稳定引用。
   */
  onEditItem: (itemId: string) => void
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
 *
 * `memo` 的意义：本组某张卡片的配置变化会让 `group` / `items` 换引用，本组件必然重渲染；
 * 但同组其它卡片的 `item` 对象引用没变，`memo(SortableCard)` 会把它们全部拦下 ——
 * 于是"点一下 +1"只重渲染那一张卡。
 */
export const ItemGrid = memo(function ItemGrid({
  groupId,
  items,
  columns,
  groupType,
  editMode,
  landingItemId,
  onEditItem,
}: ItemGridProps): React.ReactNode {
  // ⚠️ 必须在提前 return 之前调用（Hooks 规则）；它同时是 dnd-kit 不误伤同组卡片的前提
  const ids = useStableIdList(items)

  if (items.length === 0) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该项目暂无内容，点击右上角 ＋ 添加" />
    )
  }

  // 小组件分组统一卡片高度（见 global.css 的 .dash-item-grid--widget）
  const gridClassName = groupType === 'widget' ? 'dash-item-grid dash-item-grid--widget' : 'dash-item-grid'

  // 窄屏降列：中屏最多 3 列、小屏最多 2 列、手机 1 列
  const gridStyle = {
    '--dash-grid-columns': columns,
    '--dash-grid-columns-md': Math.min(columns, 3),
    '--dash-grid-columns-sm': Math.min(columns, 2),
  } as CSSProperties

  return (
    <SortableContext items={ids} strategy={rectSortingStrategy}>
      <div className={gridClassName} style={gridStyle}>
        {items.map((item) => (
          <SortableCard
            key={item.id}
            item={item}
            groupId={groupId}
            editMode={editMode}
            isLanding={item.id === landingItemId}
            onEdit={onEditItem}
          />
        ))}
      </div>
    </SortableContext>
  )
})
