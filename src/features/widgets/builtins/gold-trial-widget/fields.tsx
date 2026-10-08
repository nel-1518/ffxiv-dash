/**
 * 黄金的试炼卡的配置字段与渲染。
 *
 * 卡面自上而下四块：标题行（期号 + 阶段状态）→ 副本行（副本名 + 等级徽标）→
 * 读数行（挑战时段 / 阶段倒计时 / 登记奖励）→ 下期预告脚注。
 * 整卡可点，跳到活动专题页 —— 挑战成功后的**登记**就在那里完成（规则要求登记确认，
 * 否则视为放弃本周试炼）。
 *
 * 数据在挂载时取一次，停留期间不轮询；阶段与倒计时跟着**分钟粒度**的全局时钟走，跨分钟才重渲染。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Flex, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { GOLD_TRIAL_SITE_URL } from './config.ts'
import { isGoldTrialCacheFresh, readGoldTrialCache, writeGoldTrialCache } from './cache.ts'
import {
  GOLD_TRIAL_PHASE_LABELS,
  fetchGoldTrial,
  formatCountdown,
  formatDayTime,
  resolvePhase,
} from './api.ts'
import type { GoldTrialActivity, GoldTrialData, GoldTrialPhaseInfo } from './api.ts'

/** 没取到的读数统一用破折号：卡高稳定，也不会把"没有"显示成 0。 */
const BLANK = '—'

export function GoldTrialFormFields(): React.ReactNode {
  // 这张卡没有可配置项：期号、副本、时间窗口与奖励全部来自活动接口
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.7 }}>
      这张卡不需要配置：期号、挑战副本、时间窗口与奖励都来自活动接口。
    </Typography.Text>
  )
}

/**
 * 阶段对应的那一行读数。
 *
 * 挑战 / 登记期显示**倒计时**（卡面唯一会动的数，标主色），其余阶段显示绝对时刻：
 * 未开始看"什么时候开始挑战"，已结束看"下期什么时候公布"。
 */
function phaseRow(
  phase: GoldTrialPhaseInfo,
  current: GoldTrialActivity | null,
  next: GoldTrialActivity | null,
  now: number,
): { label: string; value: string; emphasis: boolean } {
  const countdown = phase.until === null ? BLANK : formatCountdown(phase.until, now)

  switch (phase.phase) {
    case 'challenge':
      return { label: '挑战剩余', value: countdown, emphasis: true }
    case 'register':
      return { label: '登记剩余', value: countdown, emphasis: true }
    case 'settling':
      return { label: '结算剩余', value: countdown, emphasis: false }
    case 'finished':
      return {
        label: '下期公布',
        value: next?.onlineAt === null || next === null ? BLANK : formatDayTime(next.onlineAt),
        emphasis: false,
      }
    default:
      return {
        label: '挑战开始',
        value: current?.challengeFrom === null || current === null ? BLANK : formatDayTime(current.challengeFrom),
        emphasis: false,
      }
  }
}

export function GoldTrialRender(): React.ReactNode {
  // 分钟粒度：倒计时最小单位就是分，秒级时钟只会让这张卡白渲染
  const now = useClockAt('minute')

  const [entry, setEntry] = useState<GoldTrialData | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示。
   * 缓存 8 小时，命中即不发请求（见下面的 effect）。
   */
  const cached = useMemo(() => readGoldTrialCache(), [])
  const data = entry ?? cached

  /*
   * 拉取 + 落盘 + 记账。
   *
   * 刻意写成**同步函数返回 Promise**（而不是 async 函数）：setState 全部落在
   * then/catch 回调里，effect 同步阶段一次都不会触发渲染。
   * 请求本身在 `api.ts` 里按 URL 单飞，StrictMode 双挂载也只发一条。
   */
  const reload = useCallback((): Promise<void> => {
    return fetchGoldTrial()
      .then((result) => {
        writeGoldTrialCache(result)
        setEntry(result)
        setFailure(null)
      })
      .catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : '未知错误')
      })
  }, [])

  // 打开页面时取一次，只此一次：命中未过期缓存（8 小时内）就直接用、不发请求，停留期间不轮询
  useEffect(() => {
    const hit = readGoldTrialCache()
    if (hit !== null && isGoldTrialCacheFresh(hit, Date.now())) {
      return
    }
    void reload()
  }, [reload])

  // 一条数据都没拿到且失败了：整卡换成提示 + 重试（重试仍走单飞，不会打两遍）
  if (data === null && failure !== null) {
    return (
      <Flex vertical gap={8}>
        <Alert type="warning" showIcon title="获取试炼信息失败" description={failure} />
        <div>
          <Button size="small" onClick={() => void reload()}>
            重试
          </Button>
        </div>
      </Flex>
    )
  }

  const nowMs = now.getTime()
  const current = data?.current ?? null
  const next = data?.next ?? null
  const territory = data?.territory ?? null
  const phase = resolvePhase(current, nowMs)
  const row = phaseRow(phase, current, next, nowMs)
  const pending = data === null

  const title = current !== null && current.name !== '' ? `第 ${current.name} 期` : '黄金的试炼'
  const status = pending ? '正在获取…' : GOLD_TRIAL_PHASE_LABELS[phase.phase]
  /*
   * 标题行右侧的读数：有期号时「期号 · 阶段」用间隔点分开
   * （同房屋售卖的「服务器 · 新鲜度」、物品价格的「区服 · 新鲜度」）；
   * 期号还没拿到时只剩阶段，不与左侧的加粗标题重复一遍卡名。
   */
  const headline = title === '黄金的试炼' ? status : `${title} · ${status}`
  const windowText =
    current?.challengeFrom !== null && current?.challengeTo !== null && current !== null
      ? `${formatDayTime(current.challengeFrom)} ~ ${formatDayTime(current.challengeTo)}`
      : BLANK
  const rewardText = data !== null && data.rewardName !== '' ? data.rewardName : BLANK
  const nextText =
    next !== null && next.onlineAt !== null
      ? `下期：第 ${next.name === '' ? '?' : next.name} 期 · ${formatDayTime(next.onlineAt)} 公布`
      : '下期：待公布'

  return (
    /*
     * 正文整块可点，跳活动专题页（登记入口）。链接只包正文：卡片标题栏在
     * WidgetShell 里，编辑 / 删除按钮不能嵌进交互元素。
     * `dash-card-fill` 与房屋售卖 / 物品价格 / 市场税率同一套：卡片被同组更高的
     * 卡撑高时内容跟着长（封顶 164px），标题行钉在卡面顶部 —— 不加它时整块内容
     * 会被 `.ant-card-body` 的垂直居中推到卡片中间，与其他卡的标题行错开。
     */
    <a
      className="dash-card-link dash-card-fill dash-goldtrial-link"
      href={GOLD_TRIAL_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="打开活动专题页登记"
    >
      <Flex align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
        <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
          黄金的试炼
        </Typography.Text>
        {/* 阶段状态挤在标题行右侧，不独占一行 */}
        <Typography.Text type="secondary" style={{ fontSize: 11, flex: 'none' }}>
          {headline}
        </Typography.Text>
      </Flex>

      <div className="dash-goldtrial-terri">
        {/* 窄卡里先截断副本名（hover 看全名），等级徽标始终留着 */}
        <span className="dash-goldtrial-terri-name" title={territory?.name ?? undefined}>
          {territory?.name ?? BLANK}
        </span>
        {territory !== null && territory.level !== '' ? (
          <span className="dash-goldtrial-level">{`Lv.${territory.level}`}</span>
        ) : null}
      </div>

      <div className="dash-goldtrial-rows">
        <div className="dash-goldtrial-row">
          <span className="dash-goldtrial-label">挑战时段</span>
          <span className="dash-goldtrial-value">{windowText}</span>
        </div>
        <div className="dash-goldtrial-row">
          <span className="dash-goldtrial-label">{row.label}</span>
          <span className={`dash-goldtrial-value${row.emphasis ? ' is-emphasis' : ''}`}>{row.value}</span>
        </div>
        <div className="dash-goldtrial-row">
          <span className="dash-goldtrial-label">登记奖励</span>
          <span className="dash-goldtrial-value">{rewardText}</span>
        </div>
      </div>

      <Typography.Text type="secondary" className="dash-goldtrial-footnote">
        {nextText}
      </Typography.Text>
    </a>
  )
}
