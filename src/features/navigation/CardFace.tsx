import './navigation.css'
import { memo, useState } from 'react'
import { App, Button, Flex, Space, Tooltip, Typography } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { WidgetRenderer } from '../widgets/WidgetRenderer.tsx'
import { normalizeLinkUrl } from '../../core/link-metadata.ts'
import { pastelColorOfLink } from '../../core/pastel.ts'
import type { LinkItem, WidgetItem } from '../../core/storage/types.ts'

/** 卡片外观所需的最小形状：链接卡片与组件卡片共有。 */
export type CardFaceProps = {
  item: LinkItem | WidgetItem
  /** 是否编辑模式：关闭时无编辑控件（手柄/编辑/删除），只剩可点击的链接本身。 */
  editMode: boolean
  /** 拖拽手柄，由调用方注入；浏览模式传 undefined。 */
  handle?: React.ReactNode
  onEdit: () => void
  onRemove: () => void
}

/** 两种外观共有的 props；从 CardFaceProps 派生，给它加字段时 LinkFace / WidgetFace 一起跟变。 */
type FaceCommonProps = Omit<CardFaceProps, 'item'>

/**
 * 卡片外观（纯展示，不含拖拽）：`SortableCard` 渲染实体、`DragPreview` 渲染虚影，同一份外观。
 * ⚠️ memo 是拖拽流畅度的命门，别去掉：DndContext 每帧换 context 引用且传播不受 memo 拦截——
 * SortableCard 必须跟（transform 要走），外观子树没理由跟；不拦住拖动开始会堵主线程数百 ms。
 * 前提：每个 prop 引用稳定（SortableCard 用 useMemo 固定 handle、useCallback 固定 onEdit/onRemove）。
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
 * 图标三形态：图片地址 → 图片；其他非空文字 → 该文字；留空 → 名称首字 + pastel 底色。
 * 只认协议头不猜扩展名。⚠️ 协议头后必须还有内容（`\S`）：`https://` 半截地址不算图片，
 * 否则渲染出 `<img src="">` 白发一次请求再靠 onError 回退。
 */
const IMAGE_URL_PATTERN = /^(?:https?:\/\/|data:image\/|\/\/)\S/i

type LinkIconKind = 'image' | 'text' | 'auto'

function linkIconKind(value: string): LinkIconKind {
  if (!value) {
    return 'auto'
  }
  return IMAGE_URL_PATTERN.test(value) ? 'image' : 'text'
}

/**
 * 取第一个「字符」：优先 `Intl.Segmenter` 按字素簇切（`🕹️` 这类组合整体保留，避免 emoji 退化成单色字形）；
 * 没有 Segmenter 时退回按码点切（Array.from），也不像 slice 劈开代理对。
 */
const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

function firstChar(text: string): string {
  if (graphemeSegmenter) {
    for (const { segment } of graphemeSegmenter.segment(text)) {
      return segment
    }
    return ''
  }
  return Array.from(text)[0] ?? ''
}

/**
 * 名称首字：按字素簇取首字、大写化后再取一次——toUpperCase 不保证「一字符进一字符出」
 * （`ß`→`SS`、`ﬁ`→`FI`），这里承诺图标上只显示一个字符。
 */
function upperInitial(text: string): string {
  return firstChar(firstChar(text).toUpperCase())
}

function LinkFace({
  item,
  editMode,
  handle,
  onEdit,
  onRemove,
}: FaceCommonProps & { item: LinkItem }): React.ReactNode {
  const { modal } = App.useApp()
  /** 手填图片地址里加载失败的那一个：记「哪个地址失败」而非布尔量，字段值一变即自动重试，无需 effect 重置。 */
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

  // 导航卡永远是一行多个的紧凑版式，图标尺寸写死
  const size = 28

  const manualIcon = item.icon?.trim() ?? ''
  const iconKind = linkIconKind(manualIcon)
  /* 图标上只显示一个字符：「名称首字」大写化，「手填文字」保持用户原样（截到一个字） */
  const initials = upperInitial(item.name) || '?'
  // 只有手填的图片地址会渲染 <img>；文字或留空都走"字符 + pastel 底色"
  const iconSrc = iconKind === 'image' && brokenIcon !== manualIcon ? manualIcon : undefined
  const iconFallback = iconKind === 'text' ? firstChar(manualIcon) : initials
  const showChar = !iconSrc
  // 字符回退的底色按域名取，同站永远同色（见 `core/pastel.ts`）；显示图片时不必解析域名
  const pastel = showChar ? pastelColorOfLink(item.url, item.name) : null
  /*
   * ⚠️ `item.url` 不能直接当 `href`：来自 localStorage 与导入 JSON，storage 层只做长度/类型收敛、不校验协议——
   * `javascript:` 会被点开在本站 origin 执行脚本。统一走 `normalizeLinkUrl`（只放行 http(s)）；
   * 认不出就不挂 href：卡片照常显示只是点不动（悬停仍见原始地址）。
   */
  const href = normalizeLinkUrl(item.url)

  return (
    <Flex
      align="center"
      gap={8}
      // `dash-link-card` 标记「这是导航卡」（悬停浮起、拖拽虚影用）；`dash-card-surface` 是「卡片表面」标记：
      // 底色/投影/毛玻璃与主题适配都挂它上面，组件卡由 WidgetShell 挂同一个类（见 global.css）
      className="dash-link-card dash-card-surface"
      style={{
        padding: '6px 8px',
        // 描边/底色/圆角走主题变量（global.css 的 `--dash-card-*` 钩子：border-width、border、radius-sm、bg、bg-hover），缺省退回 antd 令牌。
        // ⚠️ 拆成三个 longhand：简写里塞两个变量时，一个算不出值整条声明就失效。
        // ⚠️ 宽度也做成变量：有的主题（暗影）要「连位置都不留」的真无边框，光 transparent 还会留 1px 发丝线。
        borderWidth: 'var(--dash-card-border-width, 1px)',
        borderStyle: 'solid',
        borderColor: 'var(--dash-card-border, var(--ant-color-border-secondary))',
        // 扁卡用单独小一档的圆角（--dash-card-radius-sm），与组件卡共用会变成叶子形
        borderRadius: 'var(--dash-card-radius-sm, var(--ant-border-radius))',
        /*
         * ⚠️ 底色写在 inline style，主题的 CSS 规则压不过它，换底色只能走变量：
         * `--dash-card-bg-hover` 是悬停钩子（暗影用它铺紫罗兰渐变），缺省逐级退回卡片底色。
         */
        background: 'var(--dash-card-bg-hover, var(--dash-card-bg, var(--ant-color-bg-container)))',
        minWidth: 0,
      }}
    >
      {handle}

      {/* 图标与文字同在一个 <a> 里：整块（图标 + 名称 + 副标题）都可点击跳转 */}
      <a
        className="dash-link-card-link"
        // 地址不合法（非 http(s)）时为 undefined：<a> 没有 href 就不是链接，点击不跳转
        href={href ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={href ?? item.url}
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
            // 有图片图标时不铺底色（图片占满整个区域）；留空或手填文字时才铺 pastel
            background: pastel ? pastel.bg : 'transparent',
            color: pastel ? pastel.fg : 'var(--ant-color-primary)',
            fontWeight: 700,
            flex: '0 0 auto',
            overflow: 'hidden',
          }}
        >
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              width={size}
              height={size}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 8,
              }}
              // 手填图片加载失败就退回"字符 + pastel 底色"（记下失败的那个地址）
              onError={() => setBrokenIcon(manualIcon)}
            />
          ) : (
            iconFallback
          )}
        </div>

        <Flex vertical style={{ minWidth: 0, flex: 1 }}>
          {/* 名称行：两者都可压缩，窄卡里先省略名称，缩写作为"搜索时敲什么"的提示尽量留住 */}
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
        <Space size={0} className="dash-link-card-actions">
          <Tooltip title="编辑链接">
            <Button type="text" size="small" icon={<EditOutlined />} aria-label="编辑链接" onClick={onEdit} />
          </Tooltip>
          <Tooltip title="删除链接">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除链接"
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
}: FaceCommonProps & { item: WidgetItem }): React.ReactNode {
  return <WidgetRenderer item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
}
