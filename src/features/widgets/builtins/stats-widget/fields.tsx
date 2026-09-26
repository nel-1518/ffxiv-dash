import { Button, Flex, Form, Input, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined, UndoOutlined } from '@ant-design/icons'
import { boardActions } from '../../../../state/board-store.ts'
import { MAX_STATS_NAME_LENGTH } from './config.ts'
import type { StatsConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

export function StatsFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item label="任务名称" name={['config', 'name']} extra="在卡片内居中显示">
        <Input maxLength={MAX_STATS_NAME_LENGTH} placeholder="例如：主线任务" />
      </Form.Item>
      {/*
        阶段用多行文本填写，每行一个。表单值仍是 string[]：
        `getValueProps` 负责展示（join），`getValueFromEvent` 只按行拆开、
        **不做 trim 与过滤** —— 输入过程中吞掉空行/行尾空格会破坏敲回车的手感
        （光标后的换行被拼回去），清洗统一放到保存时的 normalizeStatsConfig。
      */}
      <Form.Item
        label="阶段"
        name={['config', 'stages']}
        extra="每行一个阶段，从上到下依次推进"
        getValueProps={(value: unknown) => ({
          value: Array.isArray(value) ? value.filter((item) => typeof item === 'string').join('\n') : '',
        })}
        getValueFromEvent={(event: { target?: { value?: string } }) => {
          const text = event?.target?.value ?? ''
          return text.split('\n')
        }}
      >
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 8 }}
          placeholder={'未开始\n进行中\n已完成'}
        />
      </Form.Item>
    </>
  )
}

/**
 * 阶段进度卡（分段式线性布局）。
 *
 * 视觉主角是当前阶段名：大字居中，两侧是上/下一阶段的幽灵箭头（悬停卡片才
 * 显形）；下方一条分段轨道，**每段就是一个阶段**——走过的段填实、当前段
 * 发光、未来的段留浅底，点任意一段可直接跳到那个阶段。
 * 重置是轨道下方一个低调的文字按钮。
 *
 * 静止时整张卡只有一行名称、一行阶段读数和一条细轨道。
 * 所有改动按 `item.id` 直接落库，不经过编辑弹窗。
 */
export function StatsRender({ config, item }: WidgetRenderProps<StatsConfig>): React.ReactNode {
  const { name, stages, stageIndex } = config

  const atFirst = stageIndex <= 0
  const atLast = stageIndex >= stages.length - 1
  // 单阶段没有"推进"可言，直接视为完成（整条轨道点亮）
  const isComplete = atLast

  const goTo = (index: number) => {
    // `boardActions` 是模块级常量：这里只是写入，不订阅看板，因此不参与任何重渲染
    if (index !== stageIndex) boardActions.updateItemConfig(item.id, { stageIndex: index })
  }

  const nav = (delta: -1 | 1) => {
    const blocked = delta === -1 ? atFirst : atLast
    const label = delta === -1 ? '上一阶段' : '下一阶段'
    return (
      <Button
        type="text"
        shape="circle"
        size="small"
        className="dash-stats-nav"
        icon={delta === -1 ? <LeftOutlined /> : <RightOutlined />}
        disabled={blocked}
        /*
         * 鼠标按下不让按钮夺走焦点：`mousedown` 的默认行为就是"聚焦"，
         * 而聚焦会让按钮的显形规则（`:focus-visible`）在鼠标移开后仍然成立 ——
         * 表现为"点过箭头后再移出卡片，按钮不消失"。
         * 键盘走到这里不受影响（Enter/Space 照常触发），且那时本就该显形。
         */
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => goTo(stageIndex + delta)}
        title={blocked ? (delta === -1 ? '已是第一阶段' : '已是最后阶段') : label}
        aria-label={label}
      />
    )
  }

  return (
    <Flex vertical align="center" gap={8} style={{ minWidth: 0, width: '100%' }}>
      {/* 事项名称：config 的独立字段，与卡片标题无关；留空则整行不渲染 */}
      {name !== '' && <div className="dash-stats-name">{name}</div>}

      {/*
        视觉主角：当前阶段名 + 「第几阶段」小字。箭头各占一个固定宽度，
        阶段名始终真正居中，显隐不引起布局抖动。
        key 挂 stageIndex：换阶段时让文字重新入场（CSS 动画），给一点"推进感"。
      */}
      <div className="dash-stats-hero">
        {nav(-1)}
        <div className="dash-stats-hero-text">
          <div
            key={stageIndex}
            className={`dash-stats-stage-name${isComplete ? ' is-complete' : ''}`}
            title={stages[stageIndex]}
          >
            {stages[stageIndex]}
          </div>
          <div className="dash-stats-counter">
            第 {stageIndex + 1} / {stages.length} 阶段
          </div>
        </div>
        {nav(1)}
      </div>

      {/*
        分段轨道：flex 均分整行宽度，一段 = 一个阶段，点击直接跳转。
        段本身做成 18px 的透明命中区，视觉小节（6px）由 ::before 绘制 ——
        既保住可点面积，又不让轨道在视觉上变粗。
      */}
      <div className="dash-stats-track">
        {stages.map((stage, index) => (
          <Tooltip key={index} title={`第 ${index + 1} 阶段：${stage}`}>
            <button
              type="button"
              className={`dash-stats-seg${index <= stageIndex ? ' is-passed' : ''}`}
              onClick={() => goTo(index)}
              aria-label={`切换到第 ${index + 1} 阶段：${stage}`}
              aria-current={index === stageIndex ? 'step' : undefined}
            />
          </Tooltip>
        ))}
      </div>

      <Button
        type="text"
        size="small"
        className="dash-stats-reset"
        icon={<UndoOutlined />}
        disabled={atFirst}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => goTo(0)}
        title={atFirst ? '已在第一阶段' : '回到第一阶段'}
        aria-label="重置到第一阶段"
      >
        重置
      </Button>
    </Flex>
  )
}
