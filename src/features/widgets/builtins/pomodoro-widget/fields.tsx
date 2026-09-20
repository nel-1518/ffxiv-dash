/**
 * 休息提醒卡的配置字段与渲染。
 *
 * 卡面（三段）：状态胶囊 + 一行小字 → 环形倒计时钟面 → 三个图标按钮（开始/暂停、结束、重置）。
 * 计时状态是组件自己的 local state（刷新即回到「准备专注」，不落盘、不进 config）。
 *
 * ⚠️ **时钟粒度**：父组件只订阅一个**布尔快照**「是否已到点」——到点那一秒重渲染一次
 * （与待办卡"过点快照"同一套路）；每秒跳动的读数与环形进度全部落在 `<Countdown>` 那个叶子里。
 * 暂停与就绪时叶子的快照是常量，那两种状态下一次都不会重渲染。
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { App, Button, Flex, Form, Input, InputNumber, Progress, Slider, Switch, Typography } from 'antd'
import { BellOutlined, CaretRightOutlined, PauseOutlined, StepForwardOutlined, UndoOutlined } from '@ant-design/icons'
import { useClockValue } from '../../../../core/clock/hooks.ts'
import { BREAK_MINUTES, FOCUS_MINUTES, MAX_NOTICE_LENGTH, REST_DEFAULT_CONFIG } from './config.ts'
import { notifyStatus, notifyStatusText, requestNotifyPermission, sendNotification } from './notify.ts'
import {
  INITIAL_REST_STATE,
  activePhase,
  finishPhase,
  formatCountdown,
  formatCycleHint,
  nextPhase,
  noticeOf,
  pause,
  pendingPhase,
  phaseLabel,
  progressOfSeconds,
  remainingSecondsOf,
  resetPhase,
  resume,
  startPhase,
  totalMsOf,
} from './timer.ts'
import type { NotifyStatus } from './notify.ts'
import type { Phase, RestState } from './timer.ts'
import type { RestConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

/**
 * 动作里的"现在"。
 *
 * ⚠️ 这里刻意用 `Date.now()` 而不是时钟的 `getNow()`。本仓"组件里不写 `Date.now()`"这条约定
 * 是为了**读数**不要各读各的（读数统一走秒级时钟）；而"这一段到点没有 / 新一段从什么时候开始"
 * 是**动作**：后台标签页里时钟那一跳可能被节流拖后近一分钟，拿缓存值算会把新一段凭空缩短。
 */
function actionNow(): number {
  return Date.now()
}

/** Slider + 数字框：Form.Item 会把 value / onChange 注进来，所以这里不碰 Form */
function MinutesField({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value?: number
  onChange?: (value: number) => void
  min: number
  max: number
  step: number
}): React.ReactNode {
  return (
    <Flex align="center" gap={12}>
      <Slider style={{ flex: 1, minWidth: 0 }} min={min} max={max} step={step} value={value} onChange={onChange} />
      <InputNumber
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(next) => onChange?.(next ?? min)}
        style={{ width: 72 }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        分钟
      </Typography.Text>
    </Flex>
  )
}

/**
 * 通知测试。
 *
 * ⚠️ 权限申请**只在这里**发生（用户点了按钮才有手势）：打开页面就弹权限框会被浏览器记恨，
 * 也会让"只是来看看卡片"的人被迫做决定。
 */
function NotifyTestField(): React.ReactNode {
  const { notification } = App.useApp()
  const [status, setStatus] = useState<NotifyStatus>(() => notifyStatus())
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    const next = await requestNotifyPermission()
    const sent = sendNotification('休息提醒 · 测试通知', '看到这条通知就说明提醒可用。', 'ffxiv-dash-rest-test')
    setBusy(false)
    setStatus(next)
    if (!sent) {
      // 发不出去就把原因摆在明面上，而不是让用户以为"点了没反应"
      notification.warning({
        key: 'dash-rest-notify-test',
        placement: 'bottomRight',
        duration: 0,
        title: '系统通知没能发出',
        description: notifyStatusText(next),
      })
    }
  }

  return (
    <>
      <Button icon={<BellOutlined />} loading={busy} onClick={() => void run()}>
        发送测试通知
      </Button>
      <Typography.Text
        type={status === 'granted' ? 'secondary' : 'warning'}
        style={{ display: 'block', marginTop: 6, fontSize: 12, lineHeight: 1.6 }}
      >
        {notifyStatusText(status)}
      </Typography.Text>
    </>
  )
}

export function RestFormFields(): React.ReactNode {
  const form = Form.useFormInstance()
  /*
   * ⚠️ `useWatch` 拿不到 Form 的 `initialValues`（本仓有先例，见 `ItemForm` 的注释），
   * 所以每个字段都要回落到默认值，否则一打开弹窗就会显示成 0 分钟、没勾自动接续。
   */
  const focusMinutes = Form.useWatch<number | undefined>(['config', 'focusMinutes'], form) ?? REST_DEFAULT_CONFIG.focusMinutes
  const breakMinutes = Form.useWatch<number | undefined>(['config', 'breakMinutes'], form) ?? REST_DEFAULT_CONFIG.breakMinutes
  const autoNext = Form.useWatch<boolean | undefined>(['config', 'autoNext'], form) ?? REST_DEFAULT_CONFIG.autoNext
  const focusDoneText = Form.useWatch<string | undefined>(['config', 'focusDoneText'], form) ?? REST_DEFAULT_CONFIG.focusDoneText
  const breakDoneText = Form.useWatch<string | undefined>(['config', 'breakDoneText'], form) ?? REST_DEFAULT_CONFIG.breakDoneText

  return (
    <>
      <Form.Item label="专注时段" name={['config', 'focusMinutes']}>
        <MinutesField min={FOCUS_MINUTES.min} max={FOCUS_MINUTES.max} step={FOCUS_MINUTES.step} />
      </Form.Item>

      <Form.Item label="休息时段" name={['config', 'breakMinutes']}>
        <MinutesField min={BREAK_MINUTES.min} max={BREAK_MINUTES.max} step={BREAK_MINUTES.step} />
      </Form.Item>

      <Form.Item
        label="自动进入下一时段"
        name={['config', 'autoNext']}
        valuePropName="checked"
        extra={formatCycleHint({
          focusMinutes,
          breakMinutes,
          autoNext,
          focusDoneText,
          breakDoneText,
        })}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        label="专注时段结束提示"
        name={['config', 'focusDoneText']}
        extra={`通知正文，留空则只显示标题（${focusDoneText.length} / ${MAX_NOTICE_LENGTH}）`}
      >
        <Input maxLength={MAX_NOTICE_LENGTH} placeholder={REST_DEFAULT_CONFIG.focusDoneText} />
      </Form.Item>

      <Form.Item
        label="休息时段结束提示"
        name={['config', 'breakDoneText']}
        extra={`通知正文，留空则只显示标题（${breakDoneText.length} / ${MAX_NOTICE_LENGTH}）`}
      >
        <Input maxLength={MAX_NOTICE_LENGTH} placeholder={REST_DEFAULT_CONFIG.breakDoneText} />
      </Form.Item>

      <Form.Item label="通知测试">
        <NotifyTestField />
      </Form.Item>
    </>
  )
}

/**
 * 环形倒计时：环内是读数。
 *
 * ⚠️ 秒级订阅**只在这一层**（父组件订阅的是"是否到点"那个布尔快照）。
 * 快照是整数秒，`remainingSecondsOf` 用 `ceil` —— 开始显示整段时长、到点显示 00:00；
 * 暂停与就绪时它是常量，那两种状态下这个叶子一次都不会重渲染。
 */
function Countdown({ state, config }: { state: RestState; config: RestConfig }): React.ReactNode {
  const seconds = useClockValue((now) => remainingSecondsOf(state, config, now.getTime()))
  const totalMs = totalMsOf(state, config)

  return (
    <Progress
      type="circle"
      percent={progressOfSeconds(seconds, totalMs)}
      size={96}
      strokeWidth={5}
      strokeLinecap="round"
      format={() => <span className="dash-rest-readout">{formatCountdown(seconds * 1000)}</span>}
    />
  )
}

/** 卡面渲染。 */
export function RestRender({ config, item }: WidgetRenderProps<RestConfig>): React.ReactNode {
  const { notification } = App.useApp()
  const [state, setState] = useState<RestState>(INITIAL_REST_STATE)
  /** 已经处理过的结束时刻：StrictMode 双跑、切回前台补判都可能让同一段被处理两次 */
  const handledRef = useRef<number | null>(null)
  /** 切回前台时 +1，用来强制再判一次（那会儿时钟可能还没跳） */
  const [reconcile, forceReconcile] = useReducer((count: number) => count + 1, 0)

  /*
   * 父组件只订阅"是否已到点"这个**布尔快照**：到点那一秒重渲染一次。
   * 上面 `state.kind === 'running'` 的短路让暂停/就绪时它恒为 false，连快照比较都不用做重活。
   */
  const expired = useClockValue((now) => state.kind === 'running' && now.getTime() >= state.endsAt)

  /** 发提醒：系统通知优先；发不出去（没授权 / 非 https / 不支持）就退化成页面内提示，并写明原因。 */
  const announce = useCallback(
    (finished: Phase, tag: string): void => {
      const body = noticeOf(config, finished)
      if (sendNotification(item.title, body, tag)) {
        return
      }
      notification.warning({
        key: `dash-rest-${item.id}`,
        placement: 'bottomRight',
        duration: 0,
        title: item.title,
        description: [body, notifyStatusText(notifyStatus())].filter((line) => line !== '').join('\n'),
      })
    },
    [config, item.id, item.title, notification],
  )

  // 到点：先转移状态、再发提醒（反过来会先弹通知、卡片还停在旧读数）
  useEffect(() => {
    if (state.kind !== 'running') {
      return
    }
    // `expired` 来自秒级时钟；`actionNow()` 兜住"后台被节流、时钟还没跳"的那种情况
    if (!expired && actionNow() < state.endsAt) {
      return
    }
    if (handledRef.current === state.endsAt) {
      return
    }
    handledRef.current = state.endsAt
    const finished = state.phase
    const endsAt = state.endsAt
    setState(finishPhase(state, config, actionNow()))
    announce(finished, `${item.id}:${finished}:${endsAt}`)
  }, [state, expired, reconcile, config, announce, item.id])

  /*
   * 切回前台立刻对账：后台标签页的定时器会被节流（Chrome 隐藏几分钟后可能压到每分钟一次），
   * 回到前台时时钟那一跳可能还没补上 —— 强制再判一次，保证"回来就看到正确的状态"。
   */
  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        forceReconcile()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const pending = pendingPhase(state)
  const running = state.kind === 'running'
  const paused = state.kind === 'paused'
  /*
   * 胶囊显示的是"此刻这件事"：跑着的就是当前段，刚结束的就是上一段，`ready` 还没开始。
   * `awaiting` 的 `activePhase` 给的是**下一段**，所以这里要取反。
   */
  const shownPhase = state.kind === 'awaiting' ? nextPhase(state.next) : activePhase(state)
  const capsule = state.kind === 'ready'
    ? '准备专注'
    : state.kind === 'awaiting' && shownPhase !== null
      ? `${phaseLabel(shownPhase)}结束`
      : shownPhase === null
        ? '准备专注'
        : paused
          ? `${phaseLabel(shownPhase)}已暂停`
          : phaseLabel(shownPhase)
  const capsuleKind = state.kind === 'ready' || shownPhase === null ? 'is-idle' : shownPhase === 'focus' ? 'is-focus' : 'is-break'

  // 提醒发不出去的时候，卡面上留一句"为什么"（能用就不占地方）
  const notify = notifyStatus()
  const notifyBlocked = notify === 'denied' || notify === 'insecure' || notify === 'unsupported'
  const hint = notifyBlocked ? '通知未授权' : config.autoNext ? '自动接续' : '手动接续'

  return (
    <div className="dash-card-fill dash-rest">
      <div className="dash-rest-status">
        <span className={`dash-rest-phase ${capsuleKind}`}>{capsule}</span>
        <span className="dash-rest-hint" title={notifyBlocked ? notifyStatusText(notify) : hint}>
          {hint}
        </span>
      </div>

      <Countdown state={state} config={config} />

      <div className="dash-rest-actions">
        {pending !== null ? (
          <Button
            type="text"
            size="small"
            icon={<CaretRightOutlined />}
            onClick={() => setState(startPhase(config, pending, actionNow()))}
            title={`开始${phaseLabel(pending)}时段`}
            aria-label={`开始${phaseLabel(pending)}时段`}
          />
        ) : (
          <Button
            type="text"
            size="small"
            icon={paused ? <CaretRightOutlined /> : <PauseOutlined />}
            onClick={() => setState(paused ? resume(state, actionNow()) : pause(state, config, actionNow()))}
            title={paused ? '继续' : '暂停'}
            aria-label={paused ? '继续计时' : '暂停计时'}
          />
        )}

        {/* 提前结束：不发通知（用户自己的动作），但开着自动接续就直接进下一段 */}
        <Button
          type="text"
          size="small"
          icon={<StepForwardOutlined />}
          onClick={() => setState(finishPhase(state, config, actionNow()))}
          disabled={!running && !paused}
          title="结束当前时段"
          aria-label="结束当前时段"
        />

        <Button
          type="text"
          size="small"
          icon={<UndoOutlined />}
          onClick={() => {
            handledRef.current = null
            setState(resetPhase())
          }}
          disabled={state.kind === 'ready'}
          title="重置到准备专注"
          aria-label="重置到准备专注"
        />
      </div>
    </div>
  )
}
