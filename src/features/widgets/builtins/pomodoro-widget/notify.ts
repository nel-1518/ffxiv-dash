/**
 * 系统通知（不导入 React）。
 *
 * ⚠️ `Notification` 只在**安全上下文**里可用：https 或 localhost。
 * http 站点上浏览器直接不给（Chrome 会定义 `Notification` 但权限恒为 `denied`），
 * 所以这里把"能不能用"显式建模成 4 种状态，由调用方决定要不要退化成应用内提示 /
 * 要不要在界面上解释原因 —— 而不是让通知静默消失。
 */

export type NotifyStatus = 'unsupported' | 'insecure' | 'default' | 'granted' | 'denied'

export function notifyStatus(): NotifyStatus {
  if (typeof Notification === 'undefined') {
    return 'unsupported'
  }
  if (!window.isSecureContext) {
    return 'insecure'
  }
  return Notification.permission
}

/** 给用户看的一句话说明（编辑弹窗与退化提示共用）。 */
export function notifyStatusText(status: NotifyStatus): string {
  switch (status) {
    case 'unsupported':
      return '当前浏览器不支持系统通知，只能用页面内提示。'
    case 'insecure':
      return '当前页面不是 https（也不是 localhost），浏览器不允许系统通知。'
    case 'denied':
      return '系统通知已被拒绝：需要在浏览器的站点设置里重新允许通知。'
    case 'granted':
      return '系统通知已授权。'
    default:
      return '还没有请求过通知权限，点上面的按钮可以申请并测试。'
  }
}

/**
 * 申请通知权限。
 *
 * ⚠️ 必须在**用户手势**里调用（我们只在编辑弹窗的测试按钮里调），
 * 打开页面就弹权限框是会被浏览器记恨的。
 */
export async function requestNotifyPermission(): Promise<NotifyStatus> {
  const current = notifyStatus()
  if (current === 'unsupported' || current === 'insecure' || current === 'granted') {
    return current
  }
  try {
    await Notification.requestPermission()
  } catch (error) {
    // 某些浏览器在不允许的上下文里会直接抛，按"还是没权限"处理
    console.warn('[ffxiv-dash] 申请通知权限失败', error)
  }
  return notifyStatus()
}

/**
 * 发一条系统通知。**返回 false 表示没发出去**（不支持 / 未授权 / 构造失败），
 * 调用方应退化为应用内提示 —— 提醒丢了比提示重复严重得多。
 *
 * `tag` 用「卡片 + 时段 + 结束时刻」拼：同一段的重复触发只会覆盖同一条，
 * 而不同轮次的提醒互相独立（离开一会儿回来能看到错过的那几条）。
 *
 * 不设 `silent`：走系统通知就交给系统按用户自己的通知设置发声，我们不插手。
 */
export function sendNotification(title: string, body: string, tag: string): boolean {
  if (notifyStatus() !== 'granted') {
    return false
  }
  try {
    const notification = new Notification(title, {
      body: body === '' ? undefined : body,
      tag,
    })
    notification.onclick = () => {
      // 点提醒把窗口拉到前台：番茄钟提醒的标准行为（否则用户还得自己找那个标签页）
      window.focus()
      notification.close()
    }
    return true
  } catch (error) {
    console.warn('[ffxiv-dash] 系统通知发送失败', error)
    return false
  }
}
