import { Form, Select, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { findAuroraWindows } from './forecast.ts'
import type { AuroraZoneId } from './forecast.ts'
import type { WidgetRenderProps } from '../../types.ts'
import { AURORA_ZONE_OPTIONS } from './config.ts'
import type { AuroraConfig } from './config.ts'

/**
 * 每个区域列出几次极光窗口（两列排布）：
 * 「全部」时两地并列、每地 6 次（三行两列）；单选一个地图时 14 次（七行两列）。
 * ⚠️ 这两个数是**算出来填满卡高**的（见 `fields.tsx` 顶部的常量注释与 CSS 里的 164px 预算）：
 * 全部模式每块 3 行，两块共 161.6px；单区模式 7 行，靠 `--single` 放宽的行距凑到 159.8px。
 * 都在 164px 上限之内且不出滚动条。改行高 / 头部高度 / 块间距就要重量，
 * 否则要么留一大截空白、要么顶破上限出滚动条。
 */
const AURORA_WINDOW_COUNT_ALL = 6
const AURORA_WINDOW_COUNT_SINGLE = 14

/**
 * 两个极光区域的识别色（只用在头部那根 3px 竖条上）。
 */
const ZONES: { id: AuroraZoneId; label: string; accent: string }[] = [
  { id: 'old-sharlayan', label: '旧萨雷安', accent: '#bdbdb7' },
  { id: 'coerthas-western', label: '库尔札斯西部高地', accent: '#578dc8' },
]

/*
 * 本地时间格式化器：⚠️ 实例建一次复用 —— 时钟每次触发都可能调它格式化，
 * 而 `Intl.DateTimeFormat` 贵在构造。不指定 timeZone，按用户本地时区显示。
 */
const localFormatter = createLocalFormatter()

function createLocalFormatter(): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    return null
  }
}

/** 本地时间拆成日期与时刻两段（`09-28` / `11:10`）。 */
function formatLocalParts(ms: number): { date: string; time: string } {
  const text = localFormatter
    ? localFormatter.format(new Date(ms))
    : new Date(ms).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
  // zh-CN 输出形如 `10/27 08:20`，换成 `-` 与卡片里其他日期写法一致
  const [date, time] = text.replace(/\//g, '-').split(' ')
  return { date, time }
}

/** 毫秒时长格式化成「xx分xx秒」（极光窗口一次 700 地球秒 = 11分40秒）。 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}分${totalSeconds % 60}秒`
}

/**
 * 从现在到窗口开始的粗粒度时长：`3小时12分` / `12分`。
 * 超过一天改用「X天Y小时」——「39小时50分」既长又不直观（时钟是分钟粒度，四舍五入到分）。
 */
function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  if (totalMinutes >= 1440) {
    const days = Math.floor(totalMinutes / 1440)
    const hours = Math.floor((totalMinutes % 1440) / 60)
    return hours === 0 ? `${days}天` : `${days}天${hours}小时`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes}分`
  }
  return minutes === 0 ? `${hours}小时` : `${hours}小时${minutes}分`
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 本地日期的零点时间戳，用于按「天」比较跨日（避开夏令时导致的整日误差）。 */
function startOfLocalDay(ms: number): number {
  const day = new Date(ms)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

/**
 * 相对日期标签：近三天「今天 / 明天 / 后天」，一周内「周X」，再远退回 `MM-DD`。
 * 极光窗口间隔动辄几小时到一天，相对日期比绝对日期好读得多。
 */
function formatDayLabel(ms: number, nowMs: number): string {
  const days = Math.round((startOfLocalDay(ms) - startOfLocalDay(nowMs)) / 86_400_000)
  if (days <= 0) {
    return '今天'
  }
  if (days === 1) {
    return '明天'
  }
  if (days === 2) {
    return '后天'
  }
  if (days < 7) {
    return WEEKDAY_LABELS[new Date(ms).getDay()]
  }
  return formatLocalParts(ms).date
}

/** 编辑弹窗里的「组件配置」区：地图范围单选 + 原有的说明文案。 */
export function AuroraFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item label="地图范围" name={['config', 'zone']}>
        <Select options={AURORA_ZONE_OPTIONS} />
      </Form.Item>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        极光窗口由游戏天气规则推算，见 <a href="https://ff14.huijiwiki.com/wiki/天气#罕见天象" target="_blank" rel="noopener noreferrer">
          WIKI: 罕见天象
        </a>。
        <br />
        艾欧泽亚地理频道每月播报极光时间表，可关注<a href="https://www.xiaohongshu.com/user/profile/610e35e5000000000100a83f" target="_blank" rel="noopener noreferrer">
          小红书
        </a>、<a href="https://weibo.com/u/5845500733" target="_blank" rel="noopener noreferrer">
          微博
        </a>。
      </Typography.Text>
    </>
  )
}

/**
 * 极光预报卡片。
 *
 * 排的是「区域头部 + 两列读数网格」，与税率卡同一种语言：头部左侧是 accent
 * 竖条 + 区域名，右侧贴一行最近一次窗口的倒计时；下方窗口排成两列，
 * 每格左侧相对日期（今天 / 明天 / 后天 / 周X / MM-DD）、右侧开始时刻（本地时间，
 * 等宽数字、半粗），两端对齐 —— 一列读数的右缘自然对齐，不必再用底色包装。
 *
 * 地图范围由配置决定：选「全部」时上下两块各 4 次；选单个地图时只渲染那块，
 * 排 8 次。正在进行的窗口整格转主色（同税率卡「减」字的位置与克制）。
 *
 * 时钟取「分钟」粒度：列表内容只跟窗口起止（全部落在整 700 秒倍数上，即
 * 整分整秒）有关，本地时间与倒计时也只精确到分钟 —— 整秒订阅只会白渲染 59 次。
 */
export function AuroraRender({ config }: WidgetRenderProps<AuroraConfig>): React.ReactNode {
  const now = useClockAt('minute')
  const nowMs = now.getTime()

  const isAll = config.zone === 'all'
  const zones = isAll ? ZONES : ZONES.filter((zone) => zone.id === config.zone)
  const windowCount = isAll ? AURORA_WINDOW_COUNT_ALL : AURORA_WINDOW_COUNT_SINGLE

  return (
    <div className={`dash-aurora${isAll ? '' : ' dash-aurora--single'}`}>
      {zones.map((zone) => {
        const windows = findAuroraWindows(zone.id, nowMs, windowCount)
        const nearest = windows[0] ?? null

        return (
          <div
            key={zone.id}
            className="dash-aurora-block"
            style={{ '--aurora-accent': zone.accent } as React.CSSProperties}
          >
            <div className="dash-aurora-head">
              <span className="dash-aurora-accent" aria-hidden="true" />
              <span className="dash-aurora-zone">{zone.label} 极光</span>
              {nearest ? (
                <span className="dash-aurora-next">
                  {nearest.ongoing ? '进行中' : `还有 ${formatCountdown(nearest.startMs - nowMs)}`}
                </span>
              ) : null}
            </div>

            <div className="dash-aurora-grid">
              {windows.map((window) => {
                const { time } = formatLocalParts(window.startMs)
                const day = formatDayLabel(window.startMs, nowMs)
                return (
                  <span
                    key={window.startMs}
                    className={`dash-aurora-slot${window.ongoing ? ' is-ongoing' : ''}`}
                    title={`本地时间 ${day} ${time} 开始，持续 ${formatDuration(
                      window.endMs - window.startMs,
                    )}`}
                  >
                    <span className="dash-aurora-slot-day">{day}</span>
                    <span className="dash-aurora-slot-time">
                      {window.ongoing ? '进行中' : time}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
