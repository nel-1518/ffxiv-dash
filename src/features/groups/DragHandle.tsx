import { Button, Tooltip } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'

export type DragHandleProps = {
  setActivatorNodeRef?: (element: HTMLElement | null) => void
  listeners?: DraggableSyntheticListeners
  attributes?: DraggableAttributes
  label?: string
  /**
   * 惰性手柄：只画外观、不绑任何拖拽行为，也不接收指针事件。
   * 拖拽预览里用它，避免预览中的手柄抢走指针或重新触发拖拽。
   */
  inert?: boolean
}

/**
 * 拖拽手柄。
 *
 * 只有手柄绑定 dnd-kit 的 listeners（而不是整张卡片），
 * 这样卡片内的链接点击、图标按钮点击都不会触发拖拽，
 * 触屏与键盘也都能用手柄激活（键盘：聚焦后按 Space）。
 *
 * `inert` 模式下渲染成一个不可聚焦、不响应指针的图标，仅用于拖拽预览。
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
