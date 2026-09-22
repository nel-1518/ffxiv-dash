/**
 * 休息提醒卡的配置字段与渲染。
 *
 * 卡面（三段）：状态文字 + 一行小字 → 环形倒计时钟面 → 三个图标按钮（开始/暂停、结束、重置）。
 * 计时状态是组件自己的 local state（刷新即回到「准备专注」，不落盘、不进 config）；
 * 状态机接线集中在下面的 `useRestTimer`，`RestRender` 只负责画。
 *
 * ⚠️ **时钟粒度**：父组件只订阅一个**布尔快照**「是否已到点」——到点那一秒重渲染一次
 * （与待办卡"过点快照"同一套路）；每秒跳动的读数与环形进度全部落在 `<Countdown>` 那个叶子里。
 * 暂停与就绪时叶子的快照是常量，那两种状态下一次都不会重渲染。
 * 但**配置一变整个组件就重置**，见 `useRestTimer` 里那段说明。
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { App, Button, Flex, Form, Input, InputNumber, Progress, Slider, Switch, Typography } from 'antd'
import { BellOutlined, CaretRightOutlined, PauseOutlined, StepForwardOutlined, UndoOutlined } from '@ant-design/icons'
import { useClockValue } from '../../../../core/clock/hooks.ts'
import { BREAK_MINUTES, FOCUS_MINUTES, MAX_NOTICE_LENGTH, REST_DEFAULT_CONFIG, isSameRestConfig } from './config.ts'
import { notifyStatus, notifyStatusText, requestNotifyPermission, sendNotification } from './notify.ts'
import {
  INITIAL_REST_STATE,
  catchUp,
  displayMinutes,
  finishPhase,
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
import type { WidgetItem } from '../../../../core/storage/types.ts'
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
    </>
  )
}

/**
 * 环形倒计时：环内读数只写整分钟（`30min`），秒级的跳动只体现在环上。
 *
 * ⚠️ 秒级订阅**只在这一层**（父组件订阅的是"是否到点"那个布尔快照）。
 * 快照是整数秒（`remainingSecondsOf` 用 `ceil`），环靠它每秒走一格；
 * 数字那一处用 `displayMinutes` 收成整分钟（并夹到本段总时长，免得起点显示 31min），
 * 所以它每分钟才跳一次；暂停与就绪时快照是常量，那两种状态下这个叶子一次都不会重渲染。
 */
function Countdown({ state, config }: { state: RestState; config: RestConfig }): React.ReactNode {
  const seconds = useClockValue((now) => remainingSecondsOf(state, config, now.getTime()))
  const totalMs = totalMsOf(state, config)
  /* 夹到本段总时长再换算成分钟：读数用的时钟缓存值最多晚 1 秒，不夹起点会显示成 31min */
  const totalSeconds = Math.round(totalMs / 1000)
  const capped = Math.min(seconds, totalSeconds)

  return (
    <Progress
      type="circle"
      percent={progressOfSeconds(capped, totalMs)}
      size={96}
      strokeWidth={5}
      strokeLinecap="round"
      format={() =>
        state.kind === 'awaiting' ? (
          /* 这一段已经结束、下一段还没开始：没有可读的倒数，写 `0min` 会被当成还在跑 */
          <span className="dash-rest-readout-pending">待开始</span>
        ) : (
          <span className="dash-rest-readout">
            <span className="dash-rest-readout-value">{displayMinutes(capped, totalSeconds)}</span>
            <span className="dash-rest-readout-unit">min</span>
          </span>
        )
      }
    />
  )
}

/** `useRestTimer` 的返回值：状态 + 卡面要用的派生值 + 四个动作。 */
type RestTimer = {
  state: RestState
  /** 能点「开始」时是要开始的那一段，否则 null。 */
  pending: Phase | null
  running: boolean
  paused: boolean
  start: () => void
  togglePause: () => void
  finish: () => void
  reset: () => void
}

/**
 * 计时接线：状态机 + 到点判定 + 提醒 + 恢复对账。
 *
 * 与"卡面长什么样"无关，抽出来是为了让 `RestRender` 只剩渲染。刻意**不导出**：
 * `fields.tsx` 的约定是只导出组件，导出 hook 会破坏 react-refresh 的边界。
 */
function useRestTimer(item: WidgetItem, config: RestConfig): RestTimer {
  const { notification } = App.useApp()
  const [state, setState] = useState<RestState>(INITIAL_REST_STATE)
  /** 已经处理过的结束时刻：StrictMode 双跑、切回前台补判都可能让同一段被处理两次 */
  const handledRef = useRef<number | null>(null)
  /** 切回前台时 +1，用来强制再判一次（那会儿时钟可能还没跳） */
  const [reconcile, forceReconcile] = useReducer((count: number) => count + 1, 0)

  /*
   * 配置一变就重置计时。
   *
   * 时长一改，`endsAt`（这一段的结束时刻）这个冻结值就与新配置脱节了 —— 而环的分母、
   * 读数的夹取都取自 config，继续跑只会显示出对不上的读数（例如把 30 分钟的专注改成 10 分钟
   * 后，读数会一直冻在「10min」）。回到「准备专注」让用户按新设置重新开始最诚实。
   *
   * ⚠️ 用**值**比较而不是引用：`normalizeConfig` 每次返回新对象，编辑弹窗点「确定」时
   * 一个字段都没改也会换掉 config 的引用，比引用会把正在跑的计时平白重置。
   * ⚠️ 走"渲染期调整状态"而不是 effect：effect 在绘制之后才跑，会先在屏幕上画一帧
   * 与新配置对不上的旧读数再跳回初始态（看得见的闪动）；渲染期 setState 会让 React
   * 直接丢弃这一帧重来，用户看不到中间态。
   */
  const [syncedConfig, setSyncedConfig] = useState(config)
  if (!isSameRestConfig(syncedConfig, config)) {
    setSyncedConfig(config)
    setState(INITIAL_REST_STATE)
  }

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
    const crossFrom = state.endsAt
    // 离开期间可能跨过好几段：补算到原有时序网格上的当前位置，而不是从现在重新开始
    const result = catchUp(state, config, actionNow())
    setState(result.state)
    // 通知只发最后跨过的那个边界：离开半天回来不该一口气弹十几条
    if (result.finished !== null) {
      announce(result.finished, `${item.id}:${result.finished}:${crossFrom}`)
    }
  }, [state, expired, reconcile, config, announce, item.id])

  /*
   * 切回前台立刻对账：后台标签页的定时器会被节流（Chrome 隐藏几分钟后可能压到每分钟一次），
   * 回到前台时时钟那一跳可能还没补上 —— 强制再判一次，保证"回来就看到正确的状态"。
   * `pageshow` 是给 bfcache 的：从前进 / 后退恢复本页时**不会**触发 `visibilitychange`。
   */
  useEffect(() => {
    const reconcileIfVisible = (): void => {
      if (document.visibilityState === 'visible') {
        forceReconcile()
      }
    }
    document.addEventListener('visibilitychange', reconcileIfVisible)
    window.addEventListener('pageshow', reconcileIfVisible)
    return () => {
      document.removeEventListener('visibilitychange', reconcileIfVisible)
      window.removeEventListener('pageshow', reconcileIfVisible)
    }
  }, [])

  const pending = pendingPhase(state)

  return {
    state,
    pending,
    running: state.kind === 'running',
    paused: state.kind === 'paused',
    start: () => {
      if (pending !== null) {
        setState(startPhase(config, pending, actionNow()))
      }
    },
    togglePause: () => {
      setState((current) => (current.kind === 'paused' ? resume(current, actionNow()) : pause(current, actionNow())))
    },
    finish: () => {
      setState((current) => finishPhase(current, config, actionNow()))
    },
    reset: () => {
      handledRef.current = null
      setState(resetPhase())
    },
  }
}

/** 卡面渲染。计时接线在 `useRestTimer`，这里只管"画成什么样"。 */
export function RestRender({ config, item }: WidgetRenderProps<RestConfig>): React.ReactNode {
  const { state, pending, running, paused, start, togglePause, finish, reset } = useRestTimer(item, config)

  /*
   * 状态文字读的是"此刻这件事"：跑着 / 暂停的是当前段，刚结束的 `awaiting` 要看**上一段**
   * —— 它记的 `next` 指向还没开始的那一段，所以这里要取反。`ready` 还没有段。
   */
  let phaseText = '准备专注'
  let phaseTone = 'is-idle'
  if (state.kind === 'awaiting') {
    const done = nextPhase(state.next)
    phaseText = `${phaseLabel(done)}结束`
    phaseTone = done === 'focus' ? 'is-focus' : 'is-break'
  } else if (state.kind !== 'ready') {
    const phase = state.phase
    phaseText = paused ? `${phaseLabel(phase)}已暂停` : `${phaseLabel(phase)}中`
    phaseTone = phase === 'focus' ? 'is-focus' : 'is-break'
  }

  // 提醒发不出去的时候，卡面上留一句"为什么"（能用就不占地方）
  const notify = notifyStatus()
  const notifyBlocked = notify === 'denied' || notify === 'insecure' || notify === 'unsupported'
  const hint = notifyBlocked ? '通知未授权' : config.autoNext ? '自动接续' : '手动接续'

  return (
    <div className="dash-card-fill dash-rest">
      <div className="dash-rest-status">
        <span className={`dash-rest-phase ${phaseTone}`}>{phaseText}</span>
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
            onClick={start}
            title={`开始${phaseLabel(pending)}时段`}
            aria-label={`开始${phaseLabel(pending)}时段`}
          />
        ) : (
          <Button
            type="text"
            size="small"
            icon={paused ? <CaretRightOutlined /> : <PauseOutlined />}
            onClick={togglePause}
            title={paused ? '继续' : '暂停'}
            aria-label={paused ? '继续计时' : '暂停计时'}
          />
        )}

        {/* 提前结束：不发通知（用户自己的动作），但开着自动接续就直接进下一段 */}
        <Button
          type="text"
          size="small"
          icon={<StepForwardOutlined />}
          onClick={finish}
          disabled={!running && !paused}
          title="结束当前时段"
          aria-label="结束当前时段"
        />

        <Button
          type="text"
          size="small"
          icon={<UndoOutlined />}
          onClick={reset}
          disabled={state.kind === 'ready'}
          title="重置到准备专注"
          aria-label="重置到准备专注"
        />
      </div>
    </div>
  )
}
