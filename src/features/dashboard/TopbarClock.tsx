import { Flex, Typography } from 'antd'
import { useClockValue } from '../../core/clock/hooks.ts'
import { ConvertToEorzeaTimeString } from './EorzeaTimeConvert.ts'

/**
 * 顶栏左半边：问候语 + 两个时间读数。
 *
 * 单独成组件是为了把秒级时钟关在这一块里：写在 `Topbar` 里的话，时钟每秒一跳会把
 * 整条顶栏（搜索框、各按钮）一起重渲染。三个读数各自用 `useClockValue` 取粗粒度快照，
 * 渲染次数等于文字真正变化的次数。
 */

function greetingForHour(hour: number): string {
  if (hour < 6) {
    return '夜深了'
  }
  if (hour < 12) {
    return '早上好'
  }
  if (hour < 18) {
    return '下午好'
  }
  return '晚上好'
}

function createLocalTimeFormatter(): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    return null
  }
}

/*
 * ⚠️ 实例建一次复用：`useClockValue` 每秒都会调 `formatLocalTime`，
 * 而 `Intl.DateTimeFormat` 贵在构造（格式化本身很便宜）。构造不出来就退回 `toLocaleTimeString`。
 */
const localTimeFormatter = createLocalTimeFormatter()

function formatLocalTime(now: Date): string {
  if (localTimeFormatter) {
    return localTimeFormatter.format(now)
  }
  return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

function formatEorzeaTime(now: Date): string {
  return ConvertToEorzeaTimeString(now, 'H:m')
}

/** 问候语：快照就是小时数，所以只在整点重渲染。 */
function Greeting(): React.ReactNode {
  const hour = useClockValue((now) => now.getHours())

  return (
    <Typography.Title className="dash-topbar-greeting" level={4}>
      {greetingForHour(hour)}
    </Typography.Title>
  )
}

/** 本地时间（`HH:mm`）：快照是格式化后的文本，所以每分钟才重渲染一次。 */
function LocalTimeChip(): React.ReactNode {
  const text = useClockValue(formatLocalTime)

  return (
    <span className="dash-time-chip" title="本地时间">
      <i className="xiv local-time-chs" aria-hidden="true" />
      {text}
    </span>
  )
}

/** 艾欧泽亚时间：文本一变才重渲染（艾欧泽亚的一分钟 ≈ 地球 2.9 秒）。 */
function EorzeaTimeChip(): React.ReactNode {
  const text = useClockValue(formatEorzeaTime)

  return (
    <span className="dash-time-chip" title="艾欧泽亚时间">
      <i className="xiv eorzea-time-chs" aria-hidden="true" />
      {text}
    </span>
  )
}

/**
 * 顶栏的「问候语 + 发丝竖线 + 时间读数」。
 *
 * ⚠️ 这一层自己不订阅时钟：父级渲染会连带子级，它跟着时钟渲染的话，
 * 下面三个读数的细粒度订阅就没有意义了。
 */
export function TopbarClock(): React.ReactNode {
  return (
    <Flex className="dash-topbar-heading" align="center" gap={10} wrap>
      <Greeting />

      <span className="dash-topbar-divider" aria-hidden="true" />

      <Flex className="dash-topbar-clock" align="center" gap={14} wrap>
        <LocalTimeChip />
        <EorzeaTimeChip />
      </Flex>
    </Flex>
  )
}
