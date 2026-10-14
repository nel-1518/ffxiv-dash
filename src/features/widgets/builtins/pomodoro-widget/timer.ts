/**
 * 休息提醒卡的时段状态机与读数计算（纯逻辑，不导入 React，可直接用 node 跑）。
 * 计时不数秒，而是记住这一段什么时候结束（`endsAt`）再拿当前时刻去减：
 * 后台标签页被节流、系统休眠都不会让读数漂移，回到前台自然对上。
 */
import type { RestConfig } from './config.ts'

export type Phase = 'focus' | 'break'

/**
 * 一张卡的完整状态：`ready` 准备进入专注（初始态，也是「重置」的落点）；`running` 正在跑某一段，`endsAt` 是结束时刻；
 * `paused` 暂停中，`remainingMs` 是冻结的剩余时长；`awaiting` 这一段已结束，等用户手动开始下一段（未勾「自动进入下一时段」时的落点）。
 */
export type RestState =
  | { kind: 'ready' }
  | { kind: 'running'; phase: Phase; endsAt: number }
  | { kind: 'paused'; phase: Phase; remainingMs: number }
  | { kind: 'awaiting'; next: Phase }

export const INITIAL_REST_STATE: RestState = { kind: 'ready' }

export const PHASE_LABELS: Record<Phase, string> = { focus: '专注', break: '休息' }

/** 钟面上的时段名，用于「开始休息」「专注结束」这类文案。 */
export function phaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase]
}

export function nextPhase(phase: Phase): Phase {
  return phase === 'focus' ? 'break' : 'focus'
}

export function durationOf(config: RestConfig, phase: Phase): number {
  const minutes = phase === 'focus' ? config.focusMinutes : config.breakMinutes
  return minutes * 60_000
}

/** 这一段结束时要说的那句话（空串表示通知只显示标题）。 */
export function noticeOf(config: RestConfig, phase: Phase): string {
  return phase === 'focus' ? config.focusDoneText : config.breakDoneText
}

/**
 * 当前需要跑的时段；`ready` 时是 `null`（还没决定跑哪段）。
 * 所有「这一段是哪段」的显示（胶囊、环、按钮文案）都走它；`awaiting` 返回的是下一段，只有它知道 `ready` 与 `awaiting` 的区别。
 */
export function activePhase(state: RestState): Phase | null {
  switch (state.kind) {
    case 'ready':
      return null
    case 'awaiting':
      return state.next
    default:
      return state.phase
  }
}

/** 能点「开始」时返回要开始的时段，否则 null。 */
export function pendingPhase(state: RestState): Phase | null {
  if (state.kind === 'ready') {
    return 'focus'
  }
  if (state.kind === 'awaiting') {
    return state.next
  }
  return null
}

export function startPhase(config: RestConfig, phase: Phase, now: number): RestState {
  return { kind: 'running', phase, endsAt: now + durationOf(config, phase) }
}

export function pause(state: RestState, now: number): RestState {
  if (state.kind !== 'running') {
    return state
  }
  return { kind: 'paused', phase: state.phase, remainingMs: Math.max(0, state.endsAt - now) }
}

export function resume(state: RestState, now: number): RestState {
  if (state.kind !== 'paused') {
    return state
  }
  return { kind: 'running', phase: state.phase, endsAt: now + state.remainingMs }
}

/**
 * 结束当前时段（自然到点与用户提前按「结束」都走这里）：
 * 开着「自动进入下一时段」就直接跑起来，否则停在 `awaiting` 等用户点开始。
 * 两种落点都不发通知——发不发由调用方决定（提前结束是用户自己的动作，不该再打扰他）。
 */
export function finishPhase(state: RestState, config: RestConfig, now: number): RestState {
  if (state.kind !== 'running' && state.kind !== 'paused') {
    return state
  }
  const next = nextPhase(state.phase)
  return config.autoNext ? startPhase(config, next, now) : { kind: 'awaiting', next }
}

/** 补算最多往前推多少段；超过就认为跨度异常（系统时间被往前拨等），放弃网格。 */
const MAX_CATCH_UP_STEPS = 1000

export type CatchUpResult = {
  /** 补算之后的状态。 */
  state: RestState
  /** 刚跨过的最后一段；没有跨过任何边界时为 null。 */
  finished: Phase | null
}

/**
 * 补算：把「这一段什么时候结束」推进到原有时序网格上的当前位置。
 * 隐藏标签页被节流、系统休眠期间可能一下跨过好几段；不能从现在重新开始下一段，否则整条节奏整体往后漂
 * （30+5 的循环离开两小时，回来后的起点会一直错开）。按已排好的 `endsAt` 一格一格往前推，落点与「一直没离开过」完全一致。
 * 只推状态、不发通知（离开半天回来不该一口气弹十几条），发几条由调用方决定。
 */
export function catchUp(state: RestState, config: RestConfig, now: number): CatchUpResult {
  if (state.kind !== 'running') {
    return { state, finished: null }
  }
  // 关掉自动接续时不会有「自己往前走」的段，落点与单次到点完全一样
  if (!config.autoNext) {
    return { state: finishPhase(state, config, now), finished: state.phase }
  }

  let phase = state.phase
  let endsAt = state.endsAt
  let finished: Phase | null = null
  let steps = 0

  while (endsAt <= now) {
    finished = phase
    phase = nextPhase(phase)
    endsAt += durationOf(config, phase)
    steps += 1
    if (steps >= MAX_CATCH_UP_STEPS) {
      // 跨度以天计，网格已经没有意义：从现在重新开始，至少读数是对的
      return { state: startPhase(config, phase, now), finished }
    }
  }

  return { state: { kind: 'running', phase, endsAt }, finished }
}

/** 回到初始态。返回新对象而不是共享常量：状态是一份数据，不该有别名。 */
export function resetPhase(): RestState {
  return { kind: 'ready' }
}

/** 剩余毫秒：就绪时是整段专注，等待开始时是 0。 */
export function remainingMsOf(state: RestState, config: RestConfig, now: number): number {
  switch (state.kind) {
    case 'running':
      return Math.max(0, state.endsAt - now)
    case 'paused':
      return Math.max(0, state.remainingMs)
    case 'awaiting':
      return 0
    default:
      return durationOf(config, 'focus')
  }
}

/** 环形进度的分母：当前（或即将开始的）那一段的完整时长。 */
export function totalMsOf(state: RestState, config: RestConfig): number {
  return durationOf(config, activePhase(state) ?? 'focus')
}

/**
 * 剩余秒数——读数的快照就用它。
 * ⚠️ 用 `ceil` 而不是 `floor`：开始那一刻要显示整段时长（30:00 而不是 29:59），到点那一刻要显示 00:00。
 */
export function remainingSecondsOf(state: RestState, config: RestConfig, now: number): number {
  return Math.ceil(remainingMsOf(state, config, now) / 1000)
}

/**
 * 环形进度（0-100，已过去的比例）。收的是读数那一秒（而不是毫秒时刻）：
 * 环与数字必须来自同一个快照，否则两者会差一帧（数字已跳到 29:58、环还画着上一秒）。
 */
export function progressOfSeconds(seconds: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 0
  }
  const elapsed = totalMs - seconds * 1000
  return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)))
}

/**
 * 读数：卡片上只写整分钟（向上取整）。秒级跳动留在内部：快照仍是整数秒，环形进度靠它每秒走一格。
 * ⚠️ `maxSeconds` 必须传这一段的总秒数：读数用的「现在」来自时钟缓存值，最多比真实时间晚 1 秒，
 * 不夹的话起点会算出 1801 秒 ⇒ 30 分钟的段一开就显示 `31min`。
 */
export function displayMinutes(seconds: number, maxSeconds: number): number {
  const capped = Math.min(Math.max(0, seconds), Math.max(0, maxSeconds))
  return Math.ceil(capped / 60)
}

/** 供编辑弹窗的 extra 文案用：一段跑完大概是什么节奏。 */
export function formatCycleHint(config: RestConfig): string {
  const focus = config.focusMinutes
  const rest = config.breakMinutes
  return config.autoNext
    ? `一轮 ${focus} 分钟专注 + ${rest} 分钟休息，结束后自动接下一段。`
    : `一轮 ${focus} 分钟专注 + ${rest} 分钟休息，每段结束后等你手动开始下一段。`
}
