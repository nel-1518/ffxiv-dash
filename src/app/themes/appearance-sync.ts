import {
  DEFAULT_CARD_ALPHA,
  DEFAULT_CARD_BLUR,
  DEFAULT_COLOR,
  getThemePatch,
  setSystemScheme,
} from '../../core/appearance/store.ts'
import { getThemeSpec } from './index.ts'
import type { ThemeProfile } from '../../core/appearance/store.ts'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 主题的出厂档案：这套主题没被用户改过时的样子。
 * - 背景：主题自带图写进「图片链接」并取预设的模糊 / 亮度（写成链接而非隐形回落，
 *   是为了让「图片显示」一节能直接调这张图的参数）；不带图退回「无」。
 * - 卡片：`ThemeSpec.cards` 的不透明度 / 毛玻璃；没声明用全局默认。
 * - 纯色：主题不声明背景颜色（`color` 只是"纯色"模式用的值），给全局默认。
 *
 * ⚠️ 住在 app 层而不是 core：算它要用 `getThemeSpec`，core 不能反向依赖 app。
 */
export function factoryProfile(key: ThemeKey): ThemeProfile {
  const { background, cards } = getThemeSpec(key)

  return {
    source: background ? 'url' : 'none',
    color: DEFAULT_COLOR,
    url: background?.url ?? '',
    blur: background?.blur ?? 0,
    brightness: background?.brightness ?? 100,
    cardAlpha: cards?.alpha ?? DEFAULT_CARD_ALPHA,
    cardBlur: cards?.blur ?? DEFAULT_CARD_BLUR,
    // 上传图是**用户自己挑的**，主题不可能出厂带一张 —— 出厂值恒为空
    imageName: '',
    imageSize: 0,
  }
}

/**
 * 某套主题实际生效的档案 = 出厂档案 + 用户改动。
 *
 * ⚠️ 只想拿一份快照（如 hooks 里配合 `useThemePatch`）时用 `{ ...factoryProfile(key), ...patch }`
 * 现拼，别走这里 —— 这个函数读模块状态，放进 `useMemo` 会被 oxlint 判成"多余依赖"。
 */
export function readThemeProfile(key: ThemeKey): ThemeProfile {
  return { ...factoryProfile(key), ...getThemePatch(key) }
}

/**
 * 「跟随系统」：注册 `prefers-color-scheme` 监听（`main.tsx` 里在 `loadAppearance()` 之后调）。
 *
 * ⚠️ 只注册一次、不注销：回调只调 `setSystemScheme`，不是「跟随系统」时生效主题不变、
 * 页面无反应，因此模式进出时不需要订阅/退订，StrictMode 双跑也不会漏订阅。
 * 注册时同步一次，让本函数不依赖"调用方之前读过系统色调"。
 */
let installed = false

export function initSystemFollow(): void {
  if (installed) {
    return
  }
  installed = true

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const sync = () => setSystemScheme(media.matches ? 'dark' : 'light')

  sync()
  media.addEventListener('change', sync)
}
