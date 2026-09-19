/**
 * 时钟相关的纯格式化（无 React）。
 *
 * `formatRelativeTime` 原本长在物品价格卡里，房屋卡也要显示「这份数据是多久前拿的」，
 * 两处一字不差 —— 按 `core/world.ts` 的同一条理由提到 core：
 * 别让第二个用到它的地方再抄一份。
 * `formatDateKey` 同理：倒数日要拿它当"今天"，设置里的「跳转」要拿它当"今天跳没跳过"。
 */

/**
 * 本地日历日的 `YYYY-MM-DD`。
 *
 * ⚠️ 不要用 `toISOString().slice(0, 10)`：那是按 UTC 切的，东八区晚上会少一天。
 * 比较"是不是同一天"、把日期存进 localStorage 都走这里（本地 0 点为界）。
 */
export function formatDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 相对时间：`刚刚` / `12 分前` / `3 小时前` / `2 天前`。
 *
 * 由全局时钟驱动，因此会自己往前跳，组件不必各持计时器
 * （调用方现在按分钟粒度订阅，见 `hooks.ts` 的 `useClockAt`）。
 */
export function formatRelativeTime(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000))
  if (seconds < 60) {
    return '刚刚'
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} 分前`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} 小时前`
  }
  return `${Math.floor(hours / 24)} 天前`
}
