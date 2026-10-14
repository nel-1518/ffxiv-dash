import { Button, Tooltip } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'

export type DragHandleProps = {
  setActivatorNodeRef?: (element: HTMLElement | null) => void
  listeners?: DraggableSyntheticListeners
  attributes?: DraggableAttributes
  label?: string
  /** 惰性手柄：只画外观、不绑拖拽行为也不接收指针事件，拖拽预览里避免手柄抢指走指针或重新触发拖拽。 */
  inert?: boolean
}

/**
 * 拖拽手柄。只有手柄（而非整张卡片）绑 dnd-kit 的 listeners：卡内链接、按钮点击不触发拖拽；
 * 触屏与键盘（聚焦后按 Space）也能激活。`inert` 模式只画外观、不可聚焦不响应指针，拖拽预览用。
 */
export function DragHandle({
  setActivatorNodeRef,
  listeners,
  attributes,
  label = '拖动排序',
  inert = false,
}: DragHandleProps): React.ReactNode {
  if (inert) {
    return (
      <Button
        type="text"
        size="small"
        icon={<HolderOutlined />}
        aria-hidden
        tabIndex={-1}
        style={{ cursor: 'grabbing', pointerEvents: 'none' }}
      />
    )
  }

  return (
    <Tooltip title={label}>
      <Button
        ref={setActivatorNodeRef}
        type="text"
        size="small"
        icon={<HolderOutlined />}
        aria-label={label}
        style={{ cursor: 'grab', touchAction: 'none' }}
        {...attributes}
        {...listeners}
      />
    </Tooltip>
  )
}
