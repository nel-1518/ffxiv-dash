import './widgets.css'
import { Component, useMemo } from 'react'
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
       * 外面再套一层错误边界：单卡抛错降级成警告，不拖垮看板。
       */}
      <WidgetErrorBoundary item={item}>
        <WidgetContent spec={spec} item={item} />
      </WidgetErrorBoundary>
    </WidgetShell>
  )
}

/**
 * 单卡错误边界：某张组件卡的正文抛错时，只把这一张卡降级成警告，
 * 看板其余部分照常（在此之前的任何渲染异常都会白屏整站）。
 *
 * 降级 UI 刻意长在 `WidgetShell` 之内：标题、编辑与删除按钮仍在，
 * 用户可以修配置或删掉坏卡，而不是面对一张动不了的页面。
 *
 * 不从 app/ErrorBoundary.tsx 引入通用边界，是为了守住分层方向
 * （features 不 import app）；这里的逻辑只有十几行，复制一份更划算。
 */
type WidgetErrorBoundaryProps = { item: WidgetItem; children: React.ReactNode }
type WidgetErrorBoundaryState = { error: unknown; prevItem: WidgetItem | undefined }

class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { error: undefined, prevItem: undefined }

  static getDerivedStateFromError(error: unknown): Partial<WidgetErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: WidgetErrorBoundaryProps,
    state: WidgetErrorBoundaryState,
  ): Partial<WidgetErrorBoundaryState> | null {
    /*
     * item 换引用（config 被 patch、卡片被编辑）就自动重试一次：
     * "坏配置修好了"是最常见的恢复路径，不必再让用户点重试。
     * 同一张卡没变就保留错误态，避免随看板重渲染反复重试。
     * 在渲染期对齐 prev 值，而不是 `componentDidUpdate` 里 `setState`：
     * 同样的效果少跑一帧，也不触发 react/no-did-update-set-state。
     */
    if (state.prevItem !== props.item) {
      return { prevItem: props.item, error: undefined }
    }
    return null
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // widget key 一起打出来：九个内置组件 + 历史数据里的未知 key，日志里先分清是谁
    console.error('[ffxiv-dash] 组件卡渲染出错', this.props.item.widget, error, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: undefined })
  }

  render(): React.ReactNode {
    if (this.state.error !== undefined) {
      return (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          title="该组件渲染出错"
          description={
            <Flex vertical gap={4}>
              <Typography.Text type="secondary">
                重试一次通常能恢复；若反复出现，可以编辑这张卡片的配置，或删除它。
              </Typography.Text>
              <div>
                <Button size="small" onClick={this.reset}>
                  重试
                </Button>
              </div>
            </Flex>
          }
        />
      )
    }
    return this.props.children
  }
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
