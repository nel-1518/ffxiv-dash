/**
 * 全局秒级时钟（纯逻辑，无 React）。
 *
 * 全应用共享同一份「现在」：艾欧泽亚时间、PvP 轮换倒计时以及后续任何需要计时的
 * 内容都从这里取，读数天然同步 —— 各自持有 setInterval 的话起点不同，会错开最多 1 秒。
 *
 * 时长虽然只显示到分钟，但轮换时刻本身需要"到点就翻"，所以仍按秒刷新；
 * 同一个 tick 驱动所有订阅者，一个读数一次更新，不会各跳各的。
 *
 * 订阅采用引用计数：有订阅者才起计时器，全部退订后自动停掉，空转成本为零。
 * 消费侧走 useSyncExternalStore（见 ./hooks.ts），因此不需要任何 Provider。
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
 *
 * 用递归 setTimeout 而不是 setInterval，有两个好处：
 * ① 读数永远踩在整秒边界上，不会比真实秒慢将近 1 秒；
 * ② 每一轮都以 Date.now() 重新对齐，不像 setInterval 那样累积漂移。
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
 *
 * ⚠️ 必须返回这个稳定的模块级变量，不能写成 `Date.now()`：useSyncExternalStore
 * 每次渲染都会拿快照做比较，现算会永远"变了"，直接触发无限重渲染。
 */
export function getNow(): number {
  return now
}
