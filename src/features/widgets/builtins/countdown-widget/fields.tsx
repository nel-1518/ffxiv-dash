import { DatePicker, Flex, Form, Input, Select } from 'antd'
import dayjs from 'dayjs'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { formatDateKey } from '../../../../core/clock/format.ts'
import { CYCLE_LABELS, CYCLE_OPTIONS, formatDateText, resolveCountdown } from './countdown.ts'
import { EVENT_FALLBACK, MAX_EVENT_LENGTH } from './config.ts'
import type { CountdownConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'
import type { Dayjs } from 'dayjs'

export function CountdownFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item
        label="事件名称"
        name={['config', 'event']}
        rules={[{ required: true, message: '请输入事件名称' }]}
      >
        <Input placeholder="例如：海雾村的烟火大会" maxLength={MAX_EVENT_LENGTH} />
      </Form.Item>

      <Form.Item
        label="日期"
        name={['config', 'date']}
        rules={[{ required: true, message: '请选择日期' }]}
        /*
         * config 里存的是 `YYYY-MM-DD` 字符串（要能原样进 localStorage），而 DatePicker
         * 只吃 dayjs 对象 —— 转换就地做在这条 Form.Item 的两端：
         * 下发给控件时 `getValueProps` 转成 dayjs，控件回调时 `normalize` 转回字符串。
         * 于是表单之外（数据层、渲染层）永远只见到字符串。
         */
        getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value) : null })}
        normalize={(value: Dayjs | undefined) => (value ? value.format('YYYY-MM-DD') : '')}
      >
        <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
      </Form.Item>

      <Form.Item
        label="周期"
        name={['config', 'cycle']}
        extra="选「不重复」以外的周期后，倒数会自动指向下一个日期"
      >
        <Select options={CYCLE_OPTIONS} />
      </Form.Item>
    </>
  )
}

/**
 * 倒数日卡片。
 *
 * 从上到下：事件 → 倒数天数 → 强调短线 → 描述。
 * 事件名与天数是主视觉（事件半粗、天数跟着卡宽缩放并垫一层柔光）；
 * 短线不承载信息，它只负责把"状态色"从数字搬到卡片下半部分（今天成功色、已过去灰色）。
 * 描述行把「距【事件】还有 X 日」这句原话读出来，并补上目标日期与周期 —— 它是说明，所以最小最轻。
 *
 * 时钟取的是「天」粒度（`useClockAt('day')`）：卡片的内容一天才变一次，
 * 于是它只在跨过零点那一刻重渲染
 */
export function CountdownRender({ config }: WidgetRenderProps<CountdownConfig>): React.ReactNode {
  const { date, cycle } = config
  const event = config.event || EVENT_FALLBACK
  const todayKey = formatDateKey(useClockAt('day'))
  const result = resolveCountdown({ date, cycle }, todayKey)

  if (!result) {
    /*
     * 还没选日期。这是一块占位而不是一条错误：虚线框把空白处"框起来"，
     * 卡片就不会因为只有一行灰字看起来像渲染失败（文案仍把下一步说清楚）。
     */
    return (
      <div className="dash-countdown dash-countdown-empty">
        还没有可倒数的日期，请在编辑弹窗里选择「日期」。
      </div>
    )
  }

  const { state, days, target } = result
  const count = Math.abs(days)

  /*
   * 描述行 = 「距【事件】还有 X 日」这句原话。
   * 事件名与天数上面已经各占一行，这句话在这里的职责是「把数字读出来」并说清方向，
   * 所以不缩写成「还有 X 日」—— 单独看一行说明时，出处比省几个字重要。
   * 「就是今天」是唯一不念数字的情况：那天读「还有 0 日」很怪。
   */
  const sentence =
    state === 'today'
      ? `今日是"${event}"`
      : `距"${event}"${state === 'past' ? '已过去' : '还有'} ${count} 日`

  /*
   * 「目标」在周期模式下也成立（它就是要指向的那一天），而且比「下一个」短一个字 ——
   * 窄卡上少折一行。
   */
  const meta =
    cycle === 'none'
      ? `目标 ${formatDateText(target)}`
      : `目标 ${formatDateText(target)} · ${CYCLE_LABELS[cycle]}`

  return (
    <Flex vertical align="center" gap={4} className={`dash-countdown is-${state}`} style={{ minWidth: 0 }}>
      {/* 事件：卡片的主角 */}
      <span className="dash-countdown-event">{event}</span>

      {/* 倒数天数：今天就是 0 日，颜色由 .is-today 换成成功色 */}
      <span className="dash-countdown-amount">
        <span className="dash-countdown-days">{count}</span>
      </span>

      {/* 主视觉与说明之间的强调短线：只带状态色，不读任何信息 */}
      <span className="dash-countdown-rule" aria-hidden="true" />

      {/* 描述 + 目标日期，两行紧挨着自成一块说明 */}
      <span className="dash-countdown-caption">
        <span className="dash-countdown-sentence">{sentence}</span>
        <span className="dash-countdown-meta">{meta}</span>
      </span>
    </Flex>
  )
}
