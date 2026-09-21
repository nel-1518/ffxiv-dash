/**
 * 休息提醒卡的时段状态机与读数计算（纯逻辑，不导入 React，可以直接用 node 跑）。
 *
 * 计时**不数秒**，而是记住"这一段什么时候结束"（`endsAt`）再拿当前时刻去减 ——
 * 与市场卡「数据连着请求标识一起存」、待办卡「状态按窗口打键」是同一种写法：
 * 后台标签页被节流、系统休眠都不会让读数越走越偏，回到前台自然就对上。
 */
import type { RestConfig } from './config.ts'

export type Phase = 'focus' | 'break'

/**
 * 一张卡的完整状态。
 *
 * - `ready`   准备进入专注（初始态，也是「重置」的落点）
 * - `running` 正在跑某一段，`endsAt` 是它的结束时刻
 * - `paused`  暂停中，`remainingMs` 是冻结住的剩余时长
 * - `awaiting` 这一段已经结束，等用户手动开始下一段（没勾"自动进入下一时段"时的落点）
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
 * 当前需要跑的时段；`ready` 时是 `null`（还没决定跑哪一段）。
 *
 * `awaiting` 返回的是**下一段** —— 所有"这一段是哪段"的显示（胶囊、环、按钮文案）
 * 都走这个函数，只有它知道 `ready` 与 `awaiting` 的区别。
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
 * 结束当前时段（自然到点与用户提前按「结束」都走这里）。
 *
 * 开着"自动进入下一时段"就直接跑起来，否则停在 `awaiting` 等用户点开始。
 * 两种落点**都不发通知** —— 发不发由调用方决定（提前结束是用户自己的动作，不该再打扰他）。
 */
export function finishPhase(state: RestState, config: RestConfig, now: number): RestState {
  if (state.kind !== 'running' && state.kind !== 'paused') {
    return state
  }
  const next = nextPhase(state.phase)
  return config.autoNext ? startPhase(config, next, now) : { kind: 'awaiting', next }
}

export function resetPhase(): RestState {
  return INITIAL_REST_STATE
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
 * 剩余秒数 —— 读数的快照就用它。
 *
 * ⚠️ 用 `ceil` 而不是 `floor`：开始那一刻要显示整段时长（30:00 而不是 29:59），
 * 到点那一刻要显示 00:00。这也是 pvp-map 的 `RemainingTime` 不用分钟粒度 now 的原因 ——
 * 拿"本分钟起点"去算会把向下取整变成向上取整。
 */
export function remainingSecondsOf(state: RestState, config: RestConfig, now: number): number {
  return Math.ceil(remainingMsOf(state, config, now) / 1000)
}

/**
 * 环形进度（0-100，已过去的比例）。
 *
 * 收的是**读数那一秒**（而不是毫秒时刻）：环与数字必须来自同一个快照，
 * 否则两者会差一帧（数字已经跳到 29:58、环还画着上一秒）。
 */
export function progressOfSeconds(seconds: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 0
  }
  const elapsed = totalMs - seconds * 1000
  return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)))
}

/**
 * 读数：卡片上只写**整分钟**（向上取整）。
 *
 * 秒级的跳动留在内部：快照仍是整数秒，环形进度靠它每秒走一格；只有数字这一处按分钟显示。
 * `ceil` 保证起点显示整段（30min）、最后 60 秒显示 1min、到点显示 0min。
 *
 * ⚠️ `maxSeconds` 是**这一段的总秒数**，必须传：读数用的"现在"来自时钟的缓存值，
 * 它最多比真实时间晚 1 秒，不夹的话起点会算出 1801 秒 ⇒ 30 分钟的段一开就显示 `31min`
 * （上一版秒级读数显示成 `30:01`，用户报过这个现象）。
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
