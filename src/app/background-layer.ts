/**
 * 「背景层」的纯计算（无 React、无副作用）。
 * 放在 app 层是因为它同时依赖生效主题档案（themes/appearance-sync.ts）与主题自带背景预设；
 * `AppShell` 只负责把算出的样式贴到铺满视口的层上。
 */
import { assetUrl } from '../core/asset-url.ts'
import { isImageUrl } from '../core/appearance/store.ts'
import type { ThemeProfile } from '../core/appearance/store.ts'
import type { ThemeBackground } from './themes/types.ts'

/**
 * 把一张图 + 两个显示参数翻成背景层样式（铺法固定「铺满裁切」，见 `.dash-bg-image`）。
 *
 * ⚠️ 地址必须过一遍 `assetUrl`：主题预设与用户填的地址都可能是 `/bg/x.jpg` 这种
 * public 根相对路径（Vite 不改写 TS 里的字符串），基础路径只在这里补一次。
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
 * 把生效主题档案 + 主题预设翻译成背景层样式；返回 null 表示不需要背景层（外壳照旧用 colorBgLayout）。
 *
 * ⚠️ `imageUrl` 单独传：上传图的 object URL 是运行期才有（图片本体在 IndexedDB，启动时异步读回），
 * 不进档案；且逐主题一份，调用方必须传生效主题那一张（`useThemeImageUrl(themeKey)`）。
 *
 * 档案与预设的关系（见 `themes/appearance-sync.ts`）：出厂档案把预设写进「图片链接」（走 `url` 分支，
 * 用户可接着调）；「来源 = 无」时回落到预设图，用户手动选「无」仍能看到主题自带背景。
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
