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
   * 表头要的三样东西收的是**原始值**，不是整个 `Group` 对象。
   *
   * 配合下面的 `memo`，效果是：分组里某张卡片改了配置（标题、类型、项数都没变）时，
   * 表头这一整块 antd Card 根本不重渲染 —— 只有那张卡片自己重渲染。
   * 传 `group` 对象的话引用必然变化，memo 会完全失效。
   */
  title: string
  typeLabel: string
  itemCount: number
  /** 是否处于编辑模式：关闭时表头右侧的位置组与内容组全部隐藏。 */
  editMode: boolean
  /**
   * 「不是第一个」与「不是最后一个」。
   *
   * ⚠️ 各管两个按钮：「置顶」和「上移」共用 `canMoveUp`，「置底」和「下移」共用 `canMoveDown`
   * （两种操作的可用条件本来就一样），所以没有单独的 `canMoveToTop` 之类。
   */
  canMoveUp: boolean
  canMoveDown: boolean
  /** 位置组，顺序即表头里的顺序：置顶 → 上移 → 下移 → 置底。 */
  onMoveToTop: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToBottom: () => void
  /** 内容组：往这一组里添加卡片 / 改名称与列数。 */
  onAddItem: () => void
  onEdit: () => void
  /**
   * ⚠️ 传进来的 children **必须是引用稳定的元素**（调用方用 `useMemo` 固定）。
   * 每次新建子元素会让 `memo` 判定"变了"，表头就又跟着重渲染了。
   */
  children: React.ReactNode
}

/**
 * 表头的一个图标按钮。
 *
 * 表头按钮已经有六颗，逐个写 `Tooltip` + `Button` 会让这段 JSX 长得看不清结构；
 * 这里把「可访问名 = 提示文案」这条约定收成一处（两者同名，别只改一个）。
 * 它是纯展示组件、没有状态，放在模块级也不会影响 `memo(GroupPanel)`。
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
 * 表头的操作分成**两组**，中间一条竖线断开（编辑模式才出现）：
 * - 位置组：置顶 / 上移 / 下移 / 置底 —— 只改「这一块项目放在页面的哪个位置」；
 *   首尾两个是"一步到位"的，中间两个是"挪一格"的，需要精细调整时仍用得上。
 * - 内容组：添加项目（＋）、编辑项目（✎）—— 改「这一组里有什么 / 它叫什么」。
 *   项目名称与列数、以及删除，都收在编辑弹窗里。
 *
 * 分成两组是为了少误点：六颗图标按钮排成一行时，"删掉/改掉"这类动作和
 * "挪个位置"混在一起很容易点错，隔开之后"左边管位置、右边管内容"一眼可辨。
 *
 * ⚠️ 六颗按钮在窄面板里会跟项目名抢宽度（4 个并排的网页导航分组就是这样），
 * 装不下时由 CSS 把**整组按钮换到第二行**，并把「类型 · 项数」交给省略号（见 global.css 的表头一节）。
 * 这两处规则都挂在类名上（`.dash-group-actions` / `.dash-group-meta`），改按钮数量时要一起复核。
 */
export const GroupPanel = memo(function GroupPanel({
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
}: GroupPanelProps): React.ReactNode {
  return (
    <Card
      className="dash-group-panel"
      variant="borderless"
      /*
       * 正文上内边距收窄到 8px：表头没有分割线了，标题与第一行卡片之间
       * 只剩表头自己的居中留白（40 - 25 ≈ 7px），再叠 16 就散开了。
       * 左右与下方仍是 16px，卡片与分组边缘的关系不变。
       */
      styles={{ body: { padding: '8px 16px 16px' } }}
      title={
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <Typography.Text strong>{title}</Typography.Text>
          {/*
            类型标签与项数是"元信息"，只在编辑模式露出：
            浏览时表头只留用户自定义的项目名，卡片网格自己说明内容。
            ⚠️ 它是表头里**第一个可以被牺牲**的东西：面板不够宽时由容器查询收起它，
            否则六颗按钮会把项目名本身挤成省略号。
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
                label="置顶项目"
                icon={<VerticalAlignTopOutlined />}
                disabled={!canMoveUp}
                onClick={onMoveToTop}
              />
              <HeadAction label="上移项目" icon={<ArrowUpOutlined />} disabled={!canMoveUp} onClick={onMoveUp} />
              <HeadAction
                label="下移项目"
                icon={<ArrowDownOutlined />}
                disabled={!canMoveDown}
                onClick={onMoveDown}
              />
              <HeadAction
                label="置底项目"
                icon={<VerticalAlignBottomOutlined />}
                disabled={!canMoveDown}
                onClick={onMoveToBottom}
              />
            </Space>
            {/* 竖线：左边只动位置，右边只动内容（antd 6 用 orientation 表示方向，type 已废弃） */}
            <Divider orientation="vertical" className="dash-group-actions-split" style={{ margin: 0 }} />
            <Space size={0}>
              <HeadAction label="添加项目" icon={<PlusOutlined />} onClick={onAddItem} />
              <HeadAction label="编辑项目" icon={<EditOutlined />} onClick={onEdit} />
            </Space>
          </Flex>
        ) : undefined
      }
    >
      {children}
    </Card>
  )
})
