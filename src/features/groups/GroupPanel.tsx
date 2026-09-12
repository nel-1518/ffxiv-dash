import { Button, Card, Flex, Space, Tooltip, Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { groupTypeLabel } from './group-types.ts'
import type { Group } from '../../core/storage/types.ts'

export type GroupPanelProps = {
  group: Group
  /** 是否处于编辑模式：关闭时表头右侧的上移/下移/添加/编辑全部隐藏。 */
  editMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onAddItem: () => void
  onEdit: () => void
  children: React.ReactNode
}

/**
 * 分组面板：Card 外壳 + 单行表头（标题、类型与计数、操作组）。
 *
 * 表头只留"添加项目"和"编辑项目"两个入口：项目的配置（名称、列数）与删除
 * 都收在编辑弹窗里，一行里控件少一点，网页导航项目也不会被挤到换行。
 * 右侧整组操作只在编辑模式下出现，浏览时表头只剩标题与计数。
 */
export function GroupPanel({
  group,
  editMode,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
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
          <Typography.Text strong>{group.title}</Typography.Text>
          {/*
            类型标签与项数是"元信息"，只在编辑模式露出：
            浏览时表头只留用户自定义的项目名，卡片网格自己说明内容。
          */}
          {editMode ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {groupTypeLabel(group.type)} · {group.items.length} 项
            </Typography.Text>
          ) : null}
        </Flex>
      }
      extra={
        editMode ? (
          <Space size={0}>
            <Tooltip title="上移项目">
              <Button type="text" size="small" icon={<ArrowUpOutlined />} aria-label="上移项目" disabled={!canMoveUp} onClick={onMoveUp} />
            </Tooltip>
            <Tooltip title="下移项目">
              <Button type="text" size="small" icon={<ArrowDownOutlined />} aria-label="下移项目" disabled={!canMoveDown} onClick={onMoveDown} />
            </Tooltip>
            <Tooltip title="添加项目">
              <Button type="text" size="small" icon={<PlusOutlined />} aria-label="添加项目" onClick={onAddItem} />
            </Tooltip>
            <Tooltip title="编辑项目">
              <Button type="text" size="small" aria-label="编辑项目" onClick={onEdit}>
                <EditOutlined />
              </Button>
            </Tooltip>
          </Space>
        ) : undefined
      }
    >
      {children}
    </Card>
  )
}
