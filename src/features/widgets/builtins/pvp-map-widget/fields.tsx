import { Flex, Form, Switch, Typography } from 'antd'
import {
  CC_MAP_NAMES,
  FRONTLINE_MAP_NAMES,
  formatHoursMinutes,
  formatMinutes,
  getCcRotation,
  getFrontlineRotation,
  getNextCcMap,
  getNextFrontlineMap,
} from './rotation.ts'
import { PVP_CALENDAR_URL } from './config.ts'
import { useClockAt, useClockValue } from '../../../../core/clock/hooks.ts'
import type { PvpMapConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

export function PvpMapFormFields(): React.ReactNode {
  return (
    <Form.Item
      label="显示下一个地图"
      name={['config', 'showNextMap']}
      valuePropName="checked"
    >
      <Switch />
    </Form.Item>
  )
}

/**
 * 一个战场的信息块。
 *
 * 浅色底 + 圆角把两个战场分离开，左侧一条竖条承担"这是哪一类"的识别，
 * 底部一行把轮换倒计时右对齐 —— 比原来的纯文字行多一层层次。
 */
function BattleBlock({
  accent,
  label,
  current,
  next,
  time,
}: {
  accent: string
  label: string
  current: string
  next?: string
  /** 底部那行剩余时长：传组件而不是字符串，理由见 RemainingTime */
  time: React.ReactNode
}): React.ReactNode {
  return (
    <Flex
      vertical
      gap={2}
      style={{
        minWidth: 0,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02))',
      }}
    >
      <Flex align="center" gap={6}>
        <span
          aria-hidden="true"
          style={{ width: 3, height: 12, borderRadius: 2, background: accent, flex: '0 0 auto' }}
        />
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {label}
        </Typography.Text>
      </Flex>

      {/*
        地图行允许换行、不做省略号：组件卡在 3 列以上只有 200px 上下，一行塞不下三段文字，
        截成「周边…」比换行难读得多。「→ 下一个」包成一个 flex 项，换行时整体下去。
      */}
      <Flex align="baseline" gap={6} wrap style={{ minWidth: 0 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {current}
        </Typography.Text>
        {next ? (
          <Flex align="baseline" gap={6} style={{ minWidth: 0 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              →
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {next}
            </Typography.Text>
          </Flex>
        ) : null}
      </Flex>

      <Flex align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          距下次轮换
        </Typography.Text>
        {time}
      </Flex>
    </Flex>
  )
}

/**
 * 剩余时长读数。
 *
 * ⚠️ 这里的快照必须是**格式化后的文本**，不能改拿父级那个分钟粒度的 `now` 去算：
 * `formatHoursMinutes` / `formatMinutes` 是向下取整的，而同一分钟里"真实剩余"会跨过一个整分，
 * 拿本分钟起点去算就变成了向上取整（还剩 8 分多会显示成 9 分）—— 正是 `rotation.ts`
 * 里明说不要的那种报法。用文本快照则两全：读数与原实现逐秒一致，
 * 重渲染只发生在文本真的变的时候（每分钟两次：整分那一下 + 过后那一下）。
 */
function RemainingTime({
  until,
  format,
}: {
  /** 轮换时刻的毫秒时间戳（父级按分钟粒度算出，本身就精确到整分） */
  until: number
  format: (ms: number) => string
}): React.ReactNode {
  const text = useClockValue((now) => format(Math.max(0, until - now.getTime())))

  return (
    <Typography.Text
      // 等宽数字：分钟数逐分变化时宽度不跳，整行不会左右抖
      style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
    >
      {text}
    </Typography.Text>
  )
}

/** 点击整块内容打开 PvP 日历站。标题栏不套链接：那里有编辑/删除按钮，交互元素不能套在 <a> 里。 */
export function PvpMapRender({ config }: WidgetRenderProps<PvpMapConfig>): React.ReactNode {
  /*
   * 时钟取**分钟粒度**：轮换周期是 24h / 60min，两个 REFERENCE 又都落在整分整秒上，
   * 所以「当前 / 下一个地图」与轮换时刻用分钟快照就够了，还会在边界那一跳准点翻；
   * 整秒订阅只会白渲染 59 次。剩余时长是唯一的例外，见 RemainingTime。
   */
  const now = useClockAt('minute')

  const frontline = getFrontlineRotation(now)
  const cc = getCcRotation(now)
  const showNext = config.showNextMap

  return (
    <a
      href={PVP_CALENDAR_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="打开 PvP 日历"
      style={{ display: 'block', color: 'inherit' }}
    >
      <Flex vertical gap={8} style={{ minWidth: 0 }}>
        <BattleBlock
          accent="#E99E72"
          label="纷争前线"
          current={FRONTLINE_MAP_NAMES[frontline.map]}
          next={showNext ? FRONTLINE_MAP_NAMES[getNextFrontlineMap(now)] : undefined}
          time={<RemainingTime until={frontline.nextRotation.getTime()} format={formatHoursMinutes} />}
        />
        <BattleBlock
          accent="#3C82FF"
          label="水晶冲突"
          current={CC_MAP_NAMES[cc.map]}
          next={showNext ? CC_MAP_NAMES[getNextCcMap(now)] : undefined}
          time={<RemainingTime until={cc.nextRotation.getTime()} format={formatMinutes} />}
        />
      </Flex>
    </a>
  )
}
