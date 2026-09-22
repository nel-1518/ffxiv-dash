/**
 * 「背景层」的纯计算（无 React、无副作用）。
 *
 * 放在 app 层是因为它同时要看两边：**生效主题的档案**（来源 / 颜色 / 地址 / 显示参数，
 * 逐主题一份，见 `themes/appearance-sync.ts`）与**主题自带的背景预设**。
 * `AppShell` 只负责把它算出来的样式贴到一个铺满视口的层上。
 */
import { assetUrl } from '../core/asset-url.ts'
import { isImageUrl } from '../core/appearance/store.ts'
import type { ThemeProfile } from '../core/appearance/store.ts'
import type { ThemeBackground } from './themes/types.ts'

/**
 * 把一张图 + 两个显示参数翻成背景层的样式。
 *
 * 铺法固定「铺满裁切」（`background-size: cover` 等写在 `.dash-bg-image` 里），
 * 所以这里只算两件事：图片地址与 filter。
 *
 * ⚠️ 地址必须过一遍 `assetUrl`：主题预设与用户填的都可能长成 `/bg/x.webp`
 * （`public/` 下的根相对路径，Vite 不会改写写在 TS 里的字符串），
 * 这里是背景图唯一的出口，补基础路径只做在这一处。
 */
function imageLayer(url: string, blur = 0, brightness = 100): React.CSSProperties {
  const image: React.CSSProperties = {
    // JSON.stringify 顺带把引号与反斜杠转义掉，避免 url() 被提前闭合
    backgroundImage: `url(${JSON.stringify(assetUrl(url))})`,
  }

  if (blur > 0 || brightness !== 100) {
    image.filter = `blur(${blur}px) brightness(${brightness}%)`
  }

  return image
}

/**
 * 把生效主题的档案 + 主题预设翻译成背景层的样式。
 *
 * 返回 null 表示"不需要背景层"，此时外壳照旧用主题的 colorBgLayout。
 *
 * ⚠️ `imageUrl` 单独传进来：上传图的 object URL 是**运行期**才有的（图片本体在 IndexedDB，
 * 启动时异步读回来），因此不进档案。它现在是**逐主题一份** —— 调用方必须传**生效主题**
 * 那一张（`useThemeImageUrl(themeKey)`），传错了就会把别的主题的图显示出来。
 *
 * 档案与主题预设的关系（两条路径，见 `themes/appearance-sync.ts`）：
 * - 主题的出厂档案会**把预设写进「图片链接」**（于是这里走 `url` 分支，用户还能接着调）；
 * - 但也保留「来源 = 无」时回落到预设图，这样用户手动选「无」仍能看到主题自带的那张图。
 */
export function describeBackground(
  profile: ThemeProfile,
  imageUrl: string | null,
  preset: ThemeBackground | undefined,
): React.CSSProperties | null {
  const { source, color, url, blur, brightness } = profile

  if (source === 'color') {
    return { background: color }
  }

  if (source === 'none') {
    return preset ? imageLayer(preset.url, preset.blur, preset.brightness) : null
  }

  // 外链（含主题自带的图）要过一遍校验；上传的图要等 IndexedDB 异步读回来才有 object URL
  const resolved = source === 'url' ? (isImageUrl(url) ? url : '') : (imageUrl ?? '')
  if (!resolved) {
    return null
  }

  return imageLayer(resolved, blur, brightness)
}
