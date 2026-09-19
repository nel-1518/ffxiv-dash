import { useEffect } from 'react'
import { App, Button } from 'antd'
import { takeTodayLinks } from '../core/auto-open/store.ts'

/**
 * 打开一条链接；被浏览器拦下时返回 false。
 *
 * ⚠️ 不能写成 `window.open(url, '_blank', 'noopener')`：带了 `noopener` 就**永远返回 null**
 * （规范如此），"有没有被拦下"就判断不出来了。于是这里先开、再把 `opener` 清掉，
 * 效果与全站链接的 `rel="noopener noreferrer"` 一致。
 */
function openLink(url: string): boolean {
  const opened = window.open(url, '_blank')
  if (opened === null) {
    return false
  }
  try {
    opened.opener = null
  } catch {
    // 跨源窗口可能拒绝赋值；拿不到 opener 的页面本来也读不到本页，忽略即可
  }
  return true
}

/**
 * 「跳转」：每天首次进入页面时自动打开设置里填的那批链接。
 *
 * 做成渲染 null 的副作用组件、挂在 `<App>` 里（与 `BoardPersistence` 同样是启动副作用）：
 * 只有拿得到 `App.useApp()`，才好在"被浏览器拦下"时给出一条带按钮的提示。
 *
 * ⚠️ **浏览器会拦截没有用户手势的 `window.open`**（Chrome / Firefox / Safari 默认都拦），
 * 被拦的表现就是"什么都没发生"。所以这里数一下失败的条数，给一条常驻通知 + 「全部打开」按钮 ——
 * 点按钮是一次真实手势，浏览器就放行了，用户也不会以为设置没生效。
 */
export function AutoOpenLinks(): React.ReactNode {
  const { notification } = App.useApp()

  useEffect(() => {
    // 一天只跳一次。这个函数自己会记账，StrictMode 下的第二次调用直接拿到空数组
    const links = takeTodayLinks(new Date())
    if (links.length === 0) {
      return
    }

    const blocked = links.filter((url) => !openLink(url))
    if (blocked.length === 0) {
      return
    }

    notification.warning({
      key: 'dash-auto-open-blocked',
      placement: 'bottomRight',
      // 不自动消失：要么用户点开这些链接，要么让用户知道"为什么没跳"
      duration: 0,
      title: '浏览器拦下了自动跳转',
      description: `${blocked.length} 个链接没能自动打开。允许本站弹出窗口后就能真正自动跳转，也可以现在点右边的按钮一次性打开。`,
      actions: (
        <Button
          size="small"
          type="primary"
          onClick={() => {
            blocked.forEach(openLink)
            notification.destroy('dash-auto-open-blocked')
          }}
        >
          全部打开
        </Button>
      ),
    })
  }, [notification])

  return null
}
