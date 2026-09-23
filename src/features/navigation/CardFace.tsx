import { memo, useState } from 'react'
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
 *
 * ⚠️ **这层 `memo` 是拖拽流畅度的命门，别去掉。**
 *
 * dnd-kit 的 `DndContext` context 在拖拽开始与**指针每移动一帧**时都会换引用，
 * 而 context 传播不受 `memo` 拦截 —— 于是 `SortableCard` 一直重渲染（这是必须的，
 * 它的 transform 要跟着走）。但卡片外观这棵子树（antd Card/Flex/Typography/Button
 * 与**每张卡三个 Tooltip 的 rc-trigger 机器**，实测单次 commit 里 72 个 Tooltip、
 * 96 个 Trigger、62 个 ResizeObserver）**没有任何理由跟着重渲染**：
 * 实测在拖动开始时它会把主线程堵住约 780ms，表现就是"一开始拖就卡一下"。
 *
 * memo 生效的前提是调用方传进来的每个 prop 引用都稳定 ——
 * `SortableCard` 因此用 `useMemo` 固定 `handle`、用 `useCallback` 固定 `onEdit` / `onRemove`。
 * ⚠️ 谁要再给这里加 prop，先确认它是原始值或稳定引用。
 */
export const CardFace = memo(function CardFace({
  item,
  editMode,
  handle,
  onEdit,
  onRemove,
}: CardFaceProps): React.ReactNode {
  if (item.kind === 'link') {
    return <LinkFace item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
  }
  return <WidgetFace item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
})

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
      /*
       * `dash-link-card` 表示"这是导航卡"（悬停浮起、拖拽虚影用）；
       * `dash-card-surface` 是**卡片表面**这个概念的标记：底色/投影/毛玻璃，
       * 以及主题对卡片的适配（如银海"深色主题 + 浅色卡"的文字翻转）都挂在它上面。
       * 组件卡由 WidgetShell 挂同一个类，两边共用一套规则（见 global.css）。
       *
       * ⚠️ 两种模式都挂：曾经只在浏览模式挂，结果编辑模式下整块适配全掉了。
       * 编辑模式要的"卡片静止"由悬停规则自己保证 —— 抬起判定挂在浏览模式的
       * `.dash-link-cell` 上，没有它卡片不会动。
       */
      className="dash-link-card dash-card-surface"
      style={{
        padding: '6px 8px',
        // 描边 / 底色 / 圆角都留给主题（见 global.css 的 --dash-card-*）：
        // 变量取不到时退回 antd 令牌 —— 拖拽虚影等场景不会突然变透明、没描边或变直角。
        // ⚠️ 拆成三个 longhand：简写里塞两个变量时，只要有一个算不出值整条声明就会失效。
        // ⚠️ 宽度也做成变量：有的主题（暗影）要的是"连位置都不留"的真无边框，
        // 光把颜色设成 `transparent` 是不够的 —— 那 1px 还在，卡片边缘会留一条发丝线。
        borderWidth: 'var(--dash-card-border-width, 1px)',
        borderStyle: 'solid',
        borderColor: 'var(--dash-card-border, var(--ant-color-border-secondary))',
        // 导航卡只有一行高，圆角用单独的小一档（--dash-card-radius-sm），
        // 跟组件卡共用同一个值会在这种扁卡上变成叶子形
        borderRadius: 'var(--dash-card-radius-sm, var(--ant-border-radius))',
        /*
         * ⚠️ 底色写在这里（inline style），所以主题的 CSS 规则**压不过它** ——
         * 想换底色只能走变量：`--dash-card-bg-hover` 是悬停时的钩子（主题按需给，
         * 暗影就是用它铺那层紫罗兰渐变的），缺省时逐级退回卡片底色。
         */
        background: 'var(--dash-card-bg-hover, var(--dash-card-bg, var(--ant-color-bg-container)))',
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
          {/*
            名称行：缩写（有就）跟在名称右边。两者都可压缩（`flex: 0 1 auto` + `minWidth: 0`），
            窄卡里先省略名称，缩写作为"搜索时敲什么"的提示尽量留住。
          */}
          <Flex align="baseline" gap={6} style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
              {item.name}
            </Typography.Text>
            {item.abbreviation ? (
              <span
                style={{
                  flex: '0 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                  color: 'var(--ant-color-text-quaternary)',
                }}
              >
                {item.abbreviation}
              </span>
            ) : null}
          </Flex>
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
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
