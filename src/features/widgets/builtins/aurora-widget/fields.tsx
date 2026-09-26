import { Flex, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { findAuroraWindows } from './forecast.ts'
import type { AuroraZoneId } from './forecast.ts'
import type { WidgetRenderProps } from '../../types.ts'
import type { AuroraConfig } from './config.ts'

/** 每个区域列出接下来几次极光窗口，2×3 排两行。 */
export const AURORA_WINDOW_COUNT = 6

/** 两个极光区域各占一块，accent 竖条沿用 PvP 卡的信息块语言。 */
const ZONES: { id: AuroraZoneId; label: string; accent: string }[] = [
  { id: 'old-sharlayan', label: '旧萨雷安', accent: '#bdbdd7' },
  { id: 'coerthas-western', label: '库尔札斯西部高地', accent: '#578DC8' },
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

/** 编辑弹窗里的「组件配置」区：没有可配置项，写清原因而不是留一块空白。 */
export function AuroraFormFields(): React.ReactNode {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      该组件无需配置，极光窗口由游戏天气规则推算，每次持续约 11 分钟，见 <a href="https://ff14.huijiwiki.com/wiki/天气#罕见天象" target="_blank" rel="noopener noreferrer">
        WIKI: 罕见天象
      </a>。
      <br />
      艾欧泽亚地理频道每月播报极光时间表，可关注<a href="https://www.xiaohongshu.com/user/profile/610e35e5000000000100a83f" target="_blank" rel="noopener noreferrer">
        小红书
      </a>、<a href="https://weibo.com/u/5845500733" target="_blank" rel="noopener noreferrer">
        微博
      </a>。
    </Typography.Text>
  )
}

/**
 * 极光预报卡片。
 *
 * 上下两块（库尔札斯西部高地 / 旧萨雷安），各自把接下来 6 次极光窗口排成
 * 两行三列；每格一段紧凑文案 `MM-DD HH:mm`（窗口开始的本地时间，极光从
 * 开始到结束约 11 分 40 秒）。正在进行的窗口用文字「进行中」替代时间，
 * 不做特殊配色。
 *
 * 时钟取「分钟」粒度：列表内容只跟窗口起止（全部落在整 700 秒倍数上，即
 * 整分整秒）有关，本地时间也只显示到分钟 —— 整秒订阅只会白渲染 59 次。
 */
export function AuroraRender(_props: WidgetRenderProps<AuroraConfig>): React.ReactNode {
  const now = useClockAt('minute')

  return (
    <Flex vertical gap={8} className="dash-aurora" style={{ minWidth: 0 }}>
      {ZONES.map((zone) => (
        <Flex key={zone.id} vertical gap={3} className="dash-aurora-block">
          <Flex align="center" gap={6} className="dash-aurora-head">
            <span
              className="dash-aurora-accent"
              style={{ background: zone.accent }}
              aria-hidden="true"
            />
            <span className="dash-aurora-zone">{zone.label}</span>
          </Flex>

          <div className="dash-aurora-grid">
            {findAuroraWindows(zone.id, now.getTime(), AURORA_WINDOW_COUNT).map((window) => {
              const { date, time } = formatLocalParts(window.startMs)
              return (
                <span
                  key={window.startMs}
                  className="dash-aurora-slot"
                  title={`本地时间 ${date} ${time} 开始${window.ongoing ? ' · 进行中' : ''}`}
                >
                  {window.ongoing ? '进行中' : `${date} ${time}`}
                </span>
              )
            })}
          </div>
        </Flex>
      ))}
    </Flex>
  )
}
