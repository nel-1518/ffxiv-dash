/**
 * 「外观 → 背景层」的纯计算（无 React、无副作用）。
 *
 * 放在 app 层是因为它同时要看两边：**核心层的外观偏好**（用户选的来源/颜色/地址/参数）
 * 与**主题层的背景预设**。`AppShell` 只负责把它算出来的样式贴到一个铺满视口的层上。
 */
import { isImageUrl } from '../core/appearance/store.ts'
import type { AppearanceSnapshot } from '../core/appearance/store.ts'
import type { ThemeBackground } from './themes/types.ts'

/**
 * 把一张图 + 两个显示参数翻成背景层的样式。
 *
 * 铺法固定「铺满裁切」（`background-size: cover` 等写在 `.dash-bg-image` 里），
 * 所以这里只算三件事：图片地址、filter、模糊时把图层向外撑开。
 */
function imageLayer(url: string, blur = 0, brightness = 100): React.CSSProperties {
  const image: React.CSSProperties = {
    // JSON.stringify 顺带把引号与反斜杠转义掉，避免 url() 被提前闭合
    backgroundImage: `url(${JSON.stringify(url)})`,
  }

  if (blur > 0 || brightness !== 100) {
    image.filter = `blur(${blur}px) brightness(${brightness}%)`
  }

  /*
   * 模糊会把图层边缘一起虚化，视觉上像四周蒙了一圈白。
   * 把图层向外撑开 2 倍模糊半径，虚掉的边缘就落到视口之外了。
   * 用负 inset 而不是 transform: scale()：后者是等比放大，会把图片两侧的内容一并裁掉。
   */
  if (blur > 0) {
    image.inset = -2 * blur
  }

  return image
}

/**
 * 把外观快照 + 主题预设翻译成背景层的样式。
 *
 * 返回 null 表示"不需要背景层"，此时外壳照旧用主题的 colorBgLayout。
 *
 * 用户偏好与主题预设的关系（两条路径，见 `themes/appearance-sync.ts`）：
 * - 选主题时会**把预设写进用户偏好**（于是这里走 `url` / `upload` 分支，用户还能接着调）；
 * - 但也保留「来源 = 无」时回落到预设图，这样用户手动选「无」仍能看到主题自带的那张图。
 */
export function describeBackground(
  appearance: AppearanceSnapshot,
  preset: ThemeBackground | undefined,
): React.CSSProperties | null {
  const { source, color, url, imageUrl, blur, brightness } = appearance

  if (source === 'color') {
    return { background: color }
  }

  if (source === 'none') {
    return preset ? imageLayer(preset.url, preset.blur, preset.brightness) : null
  }

  // 外链要过一遍校验；上传的图要等 IndexedDB 异步读回来才有 object URL
  const resolved = source === 'url' ? (isImageUrl(url) ? url : '') : (imageUrl ?? '')
  if (!resolved) {
    return null
  }

  return imageLayer(resolved, blur, brightness)
}
