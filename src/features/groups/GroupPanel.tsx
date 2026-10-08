import './groups.css'
import { memo } from 'react'
import { Button, Card, Divider, Flex, Space, Tooltip, Typography } from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  PlusOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons'

export type GroupPanelProps = {
  /**
   * 表头要的几样东西收的都是原始值，不是整个 `Group` 对象：
   * 配合 `memo`，卡片改配置时（标题、类型、项数都没变）表头这块 antd Card 不重渲染；
   * 传 `group` 对象的话引用必然变化，memo 完全失效。
   */
  title: string
  typeLabel: string
  /** 「＋」按钮的文案：由分组类型决定「添加组件」还是「添加链接」。 */
  addItemLabel: string
  itemCount: number
  /** 是否处于编辑模式：关闭时表头右侧的位置组与内容组全部隐藏。 */
  editMode: boolean
  /**
   * 「不是第一个」与「不是最后一个」。各管两个按钮：「置顶」「上移」共用 `canMoveUp`，
   * 「置底」「下移」共用 `canMoveDown`（可用条件本来就一样）。
   */
  canMoveUp: boolean
  canMoveDown: boolean
  /** 位置组，顺序即表头里的顺序：置顶 → 上移 → 下移 → 置底。 */
  onMoveToTop: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToBottom: () => void
  /** 内容组：往这一组里添加组件 / 链接，或改名称与列数。 */
  onAddItem: () => void
  onEdit: () => void
  /** ⚠️ children 必须是引用稳定的元素（调用方用 `useMemo` 固定），否则 memo 判定"变了"。 */
  children: React.ReactNode
}

/**
 * 表头的一个图标按钮。把「可访问名 = 提示文案」这条约定收成一处（两者同名，别只改一个）。
 */
function HeadAction({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  disabled?: boolean
  onClick: () => void
}): React.ReactNode {
  return (
    <Tooltip title={label}>
      <Button
        type="text"
        size="small"
        icon={icon}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      />
    </Tooltip>
  )
}

/**
 * 分组面板：Card 外壳 + 单行表头（标题、类型与计数、操作组）。
 *
 * 表头操作分两组，中间一条竖线断开（编辑模式才出现）：
 * - 位置组：置顶 / 上移 / 下移 / 置底；
 * - 内容组：添加（＋）、编辑分组（✎）。名称与列数、删除都收在编辑弹窗里。
 * 分组是为了少误点：六颗图标排成一行时，"左边管位置、右边管内容"一眼可辨。
 *
 * ⚠️ 窄面板里按钮会跟分组名抢宽度：装不下时由 CSS 把整组按钮换到第二行、
 * 把「类型 · 项数」交给省略号（见 global.css 的表头一节）。
 * 规则挂在 `.dash-group-actions` / `.dash-group-meta` 上，改按钮数量时要一起复核。
 */
export const GroupPanel = memo(function GroupPanel({
  title,
  typeLabel,
  addItemLabel,
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
}: GroupPanelProps): React.ReactNode {
  return (
    <Card
      className="dash-group-panel"
      variant="borderless"
      /*
       * 正文上内边距收窄到 8px：标题与第一行卡片之间已有表头的居中留白，再叠 16 就散开了。
       */
      styles={{ body: { padding: '8px 16px 16px' } }}
      title={
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <Typography.Text strong>{title}</Typography.Text>
          {/*
            类型与项数是"元信息"，只在编辑模式露出。
            ⚠️ 它是表头里第一个可以被牺牲的东西：面板不够宽时由容器查询收起它，
            否则按钮会把分组名挤成省略号。
          */}
          {editMode ? (
            <Typography.Text className="dash-group-meta" type="secondary" style={{ fontSize: 12 }}>
              {typeLabel} · {itemCount} 项
            </Typography.Text>
          ) : null}
        </Flex>
      }
      extra={
        editMode ? (
          <Flex className="dash-group-actions" align="center" gap={8}>
            {/* 位置组：从左到右 = 从"一步到顶"到"一步到底" */}
            <Space size={0}>
              <HeadAction
                label="置顶分组"
                icon={<VerticalAlignTopOutlined />}
                disabled={!canMoveUp}
                onClick={onMoveToTop}
              />
              <HeadAction label="上移分组" icon={<ArrowUpOutlined />} disabled={!canMoveUp} onClick={onMoveUp} />
              <HeadAction
                label="下移分组"
                icon={<ArrowDownOutlined />}
                disabled={!canMoveDown}
                onClick={onMoveDown}
              />
              <HeadAction
                label="置底分组"
                icon={<VerticalAlignBottomOutlined />}
                disabled={!canMoveDown}
                onClick={onMoveToBottom}
              />
            </Space>
            {/* 竖线：左边只动位置，右边只动内容（antd 6 用 orientation 表示方向，type 已废弃） */}
            <Divider orientation="vertical" className="dash-group-actions-split" style={{ margin: 0 }} />
            <Space size={0}>
              <HeadAction label={addItemLabel} icon={<PlusOutlined />} onClick={onAddItem} />
              <HeadAction label="编辑分组" icon={<EditOutlined />} onClick={onEdit} />
            </Space>
          </Flex>
        ) : undefined
      }
    >
      {children}
    </Card>
  )
})
