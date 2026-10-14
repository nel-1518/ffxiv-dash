/**
 * 全局秒级时钟（纯逻辑，无 React）。
 * 全应用共享同一份「现在」（艾欧泽亚时间、PvP 轮换倒计时都从这里取），读数天然同步；
 * 各自 setInterval 起点不同会错开最多 1 秒。显示只到分钟，但轮换要「到点就翻」，仍按秒刷新。
 * 订阅引用计数：有订阅者才起计时器，全部退订自动停。消费侧走 useSyncExternalStore（./hooks.ts），不需要 Provider。
 */

type Listener = () => void

/** 对时周期：每秒一跳，且踩在整秒边界上。 */
const TICK_MS = 1000

let now = Date.now()
let timerId: number | undefined
const listeners = new Set<Listener>()

function tick(): void {
  now = Date.now()
  for (const listener of listeners) {
    listener()
  }
}

/**
 * 自派生调度：每次先算到下一个整秒的距离，再排下一次。
 * 用递归 setTimeout 而不是 setInterval：读数永远踩在整秒边界上，且每轮以 Date.now()
 * 重新对齐，不像 setInterval 那样累积漂移。
 */
function schedule(): void {
  timerId = window.setTimeout(() => {
    tick()
    schedule()
  }, TICK_MS - (Date.now() % TICK_MS))
}

function start(): void {
  // 幂等：StrictMode 会重复挂载，重复 start 不能排出第二个计时器
  if (timerId === undefined) {
    schedule()
  }
}

function stop(): void {
  if (timerId !== undefined) {
    window.clearTimeout(timerId)
    timerId = undefined
  }
}

/** 订阅时钟跳动；返回退订函数。首个订阅者拉起计时器，最后一个退订时停掉。 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    start()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stop()
    }
  }
}

/**
 * 当前时刻的毫秒时间戳。
 * ⚠️ 必须返回稳定的模块级变量，不能现算 `Date.now()`：useSyncExternalStore 每次渲染都比快照，现算永远「变了」、无限重渲染。
 */
export function getNow(): number {
  return now
}
