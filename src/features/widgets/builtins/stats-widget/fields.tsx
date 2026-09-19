import { Button, Flex, Form, InputNumber, Progress } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { boardActions } from '../../../../state/board-store.ts'
import type { StatsConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

export function StatsFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item label="当前数值" name={['config', 'value']}>
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="数值上限" name={['config', 'max']} extra="进度按「当前数值 / 上限」实时计算">
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
    </>
  )
}

/**
 * 统计卡。
 *
 * 进度不手填，由 `value / max` 实时算出；卡片本身就是操作面板，改动按 `item.id`
 * 直接落库，不经过编辑弹窗。
 *
 * 界面上刻意**没有常驻控件**：圆环是主角，圆心放读数（比只显示百分比信息量更足），
 * 读数本身就是按钮 —— 点一下原地变输入框，可直接键入；加减则做成悬停才浮现的
 * 幽灵按钮，滑出到环的两侧。静止时整张卡只剩一个环。
 */
export function StatsRender({ config, item }: WidgetRenderProps<StatsConfig>): React.ReactNode {
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  const percent = Math.round((config.value / config.max) * 100)
  const atMin = config.value <= 0
  const atMax = config.value >= config.max

  const setValue = (next: number) => {
    const clamped = Math.min(config.max, Math.max(0, Math.round(next)))
    // `boardActions` 是模块级常量：这里只是写入，不订阅看板，因此不参与任何重渲染
    if (clamped !== config.value) boardActions.updateItemConfig(item.id, { value: clamped })
  }

  const commit = () => {
    const raw = draft
    setDraft(null)
    const next = Number(raw)
    if (raw !== null && raw.trim() !== '' && Number.isFinite(next)) setValue(next)
  }

  const step = (delta: -1 | 1) => {
    const blocked = delta === -1 ? atMin : atMax
    const label = delta === -1 ? '当前数值 -1' : '当前数值 +1'
    return (
      <Button
        type="text"
        shape="circle"
        size="small"
        className={`dash-stats-step dash-stats-step--${delta === -1 ? 'prev' : 'next'}`}
        icon={delta === -1 ? <MinusOutlined /> : <PlusOutlined />}
        disabled={blocked}
        /*
         * 鼠标按下不让按钮夺走焦点：`mousedown` 的默认行为就是"聚焦"，
         * 而聚焦会让按钮的显形规则（`:focus-visible`）在鼠标移开后仍然成立 ——
         * 表现为"点过加减号后再移出卡片，按钮不消失"。
         * 键盘走到这里不受影响（Enter/Space 照常触发），且那时本就该显形。
         */
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setValue(config.value + delta)}
        title={blocked ? (atMax ? '已达上限' : '已到下限') : label}
        aria-label={label}
      />
    )
  }

  return (
    <Flex vertical align="center" gap={4} style={{ minWidth: 0 }}>
      <div className="dash-stats-ring">
        {step(-1)}

        {/* 环里只放百分比：数字加百分号一个词就读完，环本身也正好是"占比"的形状。满值时 antd 转成成功色 */}
        <Progress
          type="circle"
          percent={percent}
          size={96}
          strokeWidth={5}
          strokeLinecap="round"
          format={() => (
            <span className="dash-stats-percent">
              {percent}
              <span className="dash-stats-percent-unit">%</span>
            </span>
          )}
        />

        {step(1)}
      </div>

      {/*
        原始读数放在环外，并承担"点一下改数值"的入口。
        draft 用字符串而不是数字：数字态下清空输入框会立刻退回非编辑态，边删边改时手感很怪；
        范围也不在输入框里限制，`setValue` 统一夹取。
      */}
      {editing ? (
        <InputNumber
          autoFocus
          size="small"
          variant="borderless"
          controls={false}
          value={draft}
          onChange={(next) => setDraft(next === null ? '' : String(next))}
          onBlur={commit}
          onPressEnter={commit}
          className="dash-stats-input"
          aria-label="当前数值"
        />
      ) : (
        <button
          type="button"
          className={`dash-stats-readout${atMax ? ' is-complete' : ''}`}
          onClick={() => setDraft(String(config.value))}
          title="点击输入当前数值"
          aria-label={`当前数值 ${config.value}，点击输入`}
        >
          <span className="dash-stats-readout-value">{config.value}</span>
          <span className="dash-stats-readout-max">/ {config.max}</span>
        </button>
      )}
    </Flex>
  )
}
