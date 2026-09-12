import { useState } from 'react'
import { App, Button, Flex, Space, Tooltip, Typography } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { WidgetRenderer } from '../widgets/WidgetRenderer.tsx'
import { useFavicon } from '../widgets/useFavicon.ts'
import type { LinkItem, WidgetItem } from '../../core/storage/types.ts'

/** 卡片外观所需的最小形状：链接卡片与组件卡片共有。 */
export type CardFaceProps = {
  item: LinkItem | WidgetItem
  /**
   * 是否处于编辑模式。
   * 关闭时卡片上不出现任何编辑类控件（手柄、编辑、删除），只剩可点击的链接本身。
   */
  editMode: boolean
  /** 拖拽手柄，由调用方注入；浏览模式传 undefined。 */
  handle?: React.ReactNode
  onEdit: () => void
  onRemove: () => void
}

/**
 * 卡片外观（纯展示，不含任何拖拽逻辑）。
 *
 * `SortableCard` 用它渲染列表里的实体卡片，`DragPreview` 用它渲染跟随指针的预览。
 * 两边共用同一份标记，拖起来的虚影就是卡片本身，不会出现"预览和实体长得不一样"。
 */
export function CardFace({ item, editMode, handle, onEdit, onRemove }: CardFaceProps): React.ReactNode {
  if (item.kind === 'link') {
    return <LinkFace item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
  }
  return <WidgetFace item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
}

/**
 * 图标字段的取值判定。
 *
 * 三种形态对应三种渲染：图片地址 → 显示图片；其他文字 → 显示文字；
 * 留空 → 交给接口按网址取站点图标（见 useFavicon）。
 * 只认协议头，不去猜扩展名：`example.com/a.png` 这种没写协议的仍按文字处理。
 */
const IMAGE_URL_PATTERN = /^(?:https?:\/\/|data:image\/|\/\/)/i

type LinkIconKind = 'image' | 'text' | 'auto'

function linkIconKind(value: string): LinkIconKind {
  if (!value) {
    return 'auto'
  }
  return IMAGE_URL_PATTERN.test(value) ? 'image' : 'text'
}

function LinkFace({
  item,
  editMode,
  handle,
  onEdit,
  onRemove,
}: {
  item: LinkItem
  editMode: boolean
  handle?: React.ReactNode
  onEdit: () => void
  onRemove: () => void
}): React.ReactNode {
  const favicon = useFavicon(item.url)
  const { modal } = App.useApp()
  /**
   * 手填图片地址加载失败的那一个值。
   * 记的是"哪个地址失败了"而不是布尔量，字段值一变就自动重试，无需 effect 重置。
   */
  const [brokenIcon, setBrokenIcon] = useState<string | null>(null)

  const confirmRemove = () => {
    modal.confirm({
      title: `删除「${item.name}」？`,
      content: '此操作不可撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: onRemove,
    })
  }

  // 导航卡只出现在网页导航分组里，永远是一行多个的紧凑版式；尺寸写死，不再有开关
  const size = 28

  const manualIcon = item.icon?.trim() ?? ''
  const iconKind = linkIconKind(manualIcon)
  const initials = item.name.slice(0, 2).toUpperCase() || '?'
  // 手填的图片最优先；留空时用接口取的站点图标；填的是文字则根本不渲染图片
  const iconSrc =
    iconKind === 'image'
      ? brokenIcon === manualIcon
        ? undefined
        : manualIcon
      : iconKind === 'auto'
        ? favicon.src
        : undefined
  const iconFallback = iconKind === 'text' ? manualIcon : initials

  return (
    <Flex
      align="center"
      gap={8}
      // 悬停浮起只在浏览模式生效：编辑模式不挂类名，卡片就是静止的（见 global.css）
      className={editMode ? undefined : 'dash-link-card'}
      style={{
        padding: '6px 8px',
        border: '1px solid var(--ant-color-border-secondary)',
        borderRadius: 'var(--ant-border-radius)',
        background: 'var(--ant-color-bg-container)',
        minWidth: 0,
      }}
    >
      {handle}

      {/*
        图标与文字同在一个 <a> 里：整块（图标 + 名称 + 副标题）都可点击跳转。
        外层 Flex 的 gap 只管手柄/链接/按钮之间的距离，图标与文字之间的距离
        交给 <a> 自己的 gap，两者取值一致，视觉间距不变。
      */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title={item.url}
        style={{
          flex: 1,
          minWidth: 0,
          color: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--ant-color-primary-bg)',
            color: 'var(--ant-color-primary)',
            fontWeight: 700,
            flex: '0 0 auto',
            overflow: 'hidden',
          }}
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              width={18}
              height={18}
              loading="lazy"
              referrerPolicy="no-referrer"
              // 只有接口图标才要把加载结果写进失败缓存；手填图片失败就退回文字
              onLoad={iconKind === 'auto' ? favicon.onLoad : undefined}
              onError={iconKind === 'auto' ? favicon.onError : () => setBrokenIcon(manualIcon)}
            />
          ) : (
            iconFallback
          )}
        </div>

        <Flex vertical style={{ minWidth: 0, flex: 1 }}>
          <Typography.Text strong ellipsis style={{ fontSize: 12 }}>
            {item.name}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 11 }}>
            {item.desc || item.url}
          </Typography.Text>
        </Flex>
      </a>

      {editMode ? (
        <Space size={0}>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} aria-label="编辑导航" onClick={onEdit} />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除导航"
              onClick={confirmRemove}
            />
          </Tooltip>
        </Space>
      ) : null}
    </Flex>
  )
}

function WidgetFace({
  item,
  editMode,
  handle,
  onEdit,
  onRemove,
}: {
  item: WidgetItem
  editMode: boolean
  handle?: React.ReactNode
  onEdit: () => void
  onRemove: () => void
}): React.ReactNode {
  return <WidgetRenderer item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
}
