import { useMemo } from 'react'
import { Alert, App, Button, Card, Flex, Space, Tooltip, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons'
import { getWidget } from './registry.ts'
import type { WidgetItem } from '../../core/storage/types.ts'
import type { WidgetSpec } from './types.ts'

export type WidgetRendererProps = {
  item: WidgetItem
  /** 是否处于编辑模式；关闭时不渲染手柄与右上角操作。 */
  editMode: boolean
  /** 卡片左上角的拖拽手柄，由 SortableCard / DragPreview 注入。 */
  handle?: React.ReactNode
  onEdit: () => void
  onRemove: () => void
}

/**
 * 组件卡片外壳：标题（左上角带拖拽手柄）与右上角操作（编辑、删除）。
 *
 * 手柄与删除都收进 Card 内部：卡片上方不再单独占一行，同组的小组件因此
 * 能对齐到同一条顶边。删除按钮排在编辑之后，两个操作同处右上角。
 * 手柄与两个操作都只在编辑模式下渲染，浏览时卡片只剩标题与内容。
 */
function WidgetShell({
  item,
  editMode,
  handle,
  onEdit,
  onRemove,
  children,
}: {
  item: WidgetItem
  editMode: boolean
  handle?: React.ReactNode
  onEdit: () => void
  onRemove: () => void
  children: React.ReactNode
}): React.ReactNode {
  const { modal } = App.useApp()

  const confirmRemove = () => {
    modal.confirm({
      title: `删除「${item.title}」？`,
      content: '此操作不可撤销。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: onRemove,
    })
  }

  return (
    <Card
      size="small"
      // 卡片表面（底色/投影/毛玻璃 + 主题对卡片的适配），与导航卡的类名一致
      className="dash-card-surface"
      // 内容区留白固定 16px：antd size="small" 的默认是 12px，组件卡用更松的一档
      styles={{ body: { padding: 16 } }}
      title={
        <Flex align="center" gap={4} style={{ minWidth: 0 }}>
          {handle}
          <Typography.Text strong>{item.title}</Typography.Text>
        </Flex>
      }
      extra={
        editMode ? (
          <Space size={0}>
            <Tooltip title="编辑组件">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} aria-label="编辑组件" />
            </Tooltip>
            <Tooltip title="删除组件">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={confirmRemove}
                aria-label="删除组件"
              />
            </Tooltip>
          </Space>
        ) : undefined
      }
    >
      {children}
    </Card>
  )
}

/** 组件 key 未注册时的降级卡：不崩溃，仍可编辑或删除。 */
function UnknownWidget({
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
  return (
    <WidgetShell item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove}>
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title="该组件类型未注册"
        description={`组件 key「${item.widget}」不在注册表中，可能来自更早的数据版本。可以把它改成已注册的类型，或删除这一项。`}
      />
    </WidgetShell>
  )
}

/**
 * 已注册组件的统一外壳：负责标题与右上角操作，
 * 再把归一化后的 config 交给 spec.Render（由注册表统一套过 `memo`）。
 */
export function WidgetRenderer({
  item,
  editMode,
  handle,
  onEdit,
  onRemove,
}: WidgetRendererProps): React.ReactNode {
  const spec = getWidget(item.widget)

  if (!spec) {
    return <UnknownWidget item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove} />
  }

  return (
    <WidgetShell item={item} editMode={editMode} handle={handle} onEdit={onEdit} onRemove={onRemove}>
      {/*
       * 内容单独拆一层再渲染：归一化要 memo（见下），而 `useMemo` 不能出现在
       * 上面那个提前 return 之后（Hooks 规则）。
       */}
      <WidgetContent spec={spec} item={item} />
    </WidgetShell>
  )
}

/**
 * 组件正文。
 *
 * ⚠️ `spec.normalizeConfig` **每次调用都返回新对象**（它就是"校验并补默认值"），
 * 直接把它塞给 `Render` 会让注册表里那层 `memo` 永远失效 ——
 * 表现为"什么都没改，组件却跟着整块看板重渲染"。
 *
 * `item.config` 只在它自己被 patch 时才换引用（reducer 按 id 精确替换），
 * 所以按它 memo 是准确且稳定的。
 */
function WidgetContent({ spec, item }: { spec: WidgetSpec; item: WidgetItem }): React.ReactNode {
  const { Render } = spec
  const config = useMemo(() => spec.normalizeConfig(item.config), [spec, item.config])

  return <Render config={config} item={item} />
}
