/**
 * 活动日历卡的配置字段与渲染。
 *
 * 卡面自上而下两段：标题行（月份 + 活动数 / 获取失败）→ 可滚动的活动列表。
 * 每行活动：名称（带该活动的专属色下划线） + 右侧倒计时读数，下面一行是生效区间；
 * 整行可点，新标签页打开活动专题页。列表**按剩余时间升序**（最紧急的在前，已结束排最后），
 * 距结束不超过 `config.emphasisDays` 天（默认 3）的读数转强调色（只看结束时间）。
 *
 * 数据在挂载时取一次（前端缓存 8 小时，命中即不发请求；服务端另缓存 97 分钟），
 * 停留期间不轮询；倒计时跟着**分钟粒度**的全局时钟走，跨分钟才重渲染。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Flex, Form, InputNumber, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import {
  isActivityCalendarCacheFresh,
  readActivityCalendarCache,
  writeActivityCalendarCache,
} from './cache.ts'
import {
  activityCountdownText,
  activityRangeText,
  fetchActivityCalendar,
  isActivityEmphasized,
  resolveActivityState,
  sortByRemaining,
} from './api.ts'
import {
  ACTIVITY_CALENDAR_DEFAULT_CONFIG,
  ACTIVITY_CALENDAR_EMPHASIS_MAX,
  ACTIVITY_CALENDAR_EMPHASIS_MIN,
} from './config.ts'
import type { ActivityCalendarData } from './api.ts'
import type { ActivityCalendarConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

/** 拿到数据前先摆几行占位（破折号）：卡高稳定，数据回来时不会跳一下。 */
const SKELETON_ROWS = 4

export function ActivityCalendarFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item
        label="高亮阈值（天）"
        name={['config', 'emphasisDays']}
        extra={`距活动结束不超过这么多天时，倒计时用强调色显示；0 = 始终不高亮。（${String(
          ACTIVITY_CALENDAR_EMPHASIS_MIN,
        )} ~ ${String(ACTIVITY_CALENDAR_EMPHASIS_MAX)}）`}
      >
        <InputNumber
          min={ACTIVITY_CALENDAR_EMPHASIS_MIN}
          max={ACTIVITY_CALENDAR_EMPHASIS_MAX}
          precision={0}
          style={{ width: '100%' }}
          placeholder={String(ACTIVITY_CALENDAR_DEFAULT_CONFIG.emphasisDays)}
        />
      </Form.Item>
    </>
  )
}

export function ActivityCalendarRender({
  config,
}: WidgetRenderProps<ActivityCalendarConfig>): React.ReactNode {
  // 分钟粒度：倒计时最小单位就是分，秒级时钟只会让这张卡白渲染
  const now = useClockAt('minute')

  const [entry, setEntry] = useState<ActivityCalendarData | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示。
   * 缓存 8 小时，命中即不发请求（见下面的 effect）。
   */
  const cached = useMemo(() => readActivityCalendarCache(), [])
  const data = entry ?? cached

  /*
   * 拉取 + 落盘 + 记账。
   *
   * 刻意写成**同步函数返回 Promise**（而不是 async 函数）：setState 全部落在
   * then/catch 回调里，effect 同步阶段一次都不会触发渲染。
   * 请求本身在 `api.ts` 里按 URL 单飞，StrictMode 双挂载也只发一条。
   */
  const reload = useCallback((): Promise<void> => {
    return fetchActivityCalendar()
      .then((result) => {
        writeActivityCalendarCache(result)
        setEntry(result)
        setFailure(null)
      })
      .catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : '未知错误')
      })
  }, [])

  // 打开页面时取一次，只此一次：命中未过期缓存（8 小时内）就直接用、不发请求，停留期间不轮询
  useEffect(() => {
    const hit = readActivityCalendarCache()
    if (hit !== null && isActivityCalendarCacheFresh(hit, Date.now())) {
      return
    }
    void reload()
  }, [reload])

  // 一条数据都没拿到且失败了：整卡换成提示 + 重试（重试仍走单飞，不会打两遍）
  if (data === null && failure !== null) {
    return (
      <Flex vertical gap={8}>
        <Alert type="warning" showIcon title="获取活动日历失败" description={failure} />
        <div>
          <Button size="small" onClick={() => void reload()}>
            重试
          </Button>
        </div>
      </Flex>
    )
  }

  const nowMs = now.getTime()
  // 按剩余时间升序（最紧急的在前；已结束排最后）——用当前时钟现算，随时间自然重排
  const activities = data === null ? [] : sortByRemaining(data.activities, nowMs)
  const pending = data === null
  const status =
    failure !== null ? '获取失败' : pending ? '正在获取…' : `${String(activities.length)} 个活动`

  return (
    <div className="dash-card-fill dash-calendar">
      {/*
        * 标题行：与官网公告 / 物品价格同一套写法 —— 左侧加粗 13px 的月份标签
        * （接口默认返回当前月），右侧 11px 的活动数 / 状态；获取失败时转警示色。
        */}
      <Flex
        className="dash-calendar-meta"
        align="baseline"
        justify="space-between"
        gap={8}
        style={{ minWidth: 0 }}
      >
        <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
          活动日历
        </Typography.Text>
        <Typography.Text
          type={failure === null ? 'secondary' : 'warning'}
          title={failure ?? undefined}
          className="dash-calendar-status"
          style={{ fontSize: 11, flex: 'none' }}
        >
          {status}
        </Typography.Text>
      </Flex>

      <div className="dash-calendar-scroll">
        {pending
          ? /* 占位行只用破折号：像"读数还没回来"，而不是"一批没有名字的活动" */
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className="dash-calendar-row is-blank">
                <span className="dash-calendar-line">
                  <span className="dash-calendar-name">—</span>
                </span>
              </div>
            ))
          : activities.map((activity, index) => {
              const state = resolveActivityState(activity, nowMs)
              // 已结束压淡；距结束不超过阈值（默认 3 天）用强调色（只看结束时间）
              const emphasis = isActivityEmphasized(activity, nowMs, config.emphasisDays)
              const countdownClass = `dash-calendar-countdown${
                state === 'ended' ? ' is-ended' : emphasis ? ' is-emphasis' : ''
              }`
              // 活动专属色只能 inline（每条不同）；没有颜色时不下划线
              const nameStyle =
                activity.color === '' ? undefined : { borderBottomColor: activity.color }
              const body = (
                <>
                  <span className="dash-calendar-line">
                    {/* 超长活动名先省略号吃掉，悬停看全名 */}
                    <span className="dash-calendar-name" style={nameStyle} title={activity.name}>
                      {activity.name}
                    </span>
                    <span className={countdownClass}>{activityCountdownText(activity, nowMs)}</span>
                  </span>
                  <span className="dash-calendar-range">{activityRangeText(activity)}</span>
                </>
              )
              const className = `dash-calendar-row is-${state}`
              const key = `${String(activity.id)}-${String(index)}`
              // 没有链接的活动退化成不可点的普通行，避免 href="" 刷新当前页
              return activity.url === '' ? (
                <div key={key} className={className}>
                  {body}
                </div>
              ) : (
                <a
                  key={key}
                  className={className}
                  href={activity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`打开活动页：${activity.name}`}
                >
                  {body}
                </a>
              )
            })}

        {!pending && activities.length === 0 ? (
          <div className="dash-calendar-empty">本月暂无活动</div>
        ) : null}
      </div>
    </div>
  )
}
