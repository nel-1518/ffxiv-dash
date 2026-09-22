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
 * 主题的**出厂档案**：这套主题没被用户改过时应该长什么样。
 *
 * 逐字段与 `ThemeSpec` 对齐（等价于改造前的 `applyTheme(key)` 写进用户偏好的那几个值）：
 * - **背景**：主题自带图就写进「图片链接」并取预设的模糊 / 亮度；不带图就退回「无」。
 *   写成图片链接而不是留个隐形回落，是为了让这张图的参数能在设置里直接调
 *   （「图片显示」一节只在图片来源下才渲染）。
 * - **卡片**：`ThemeSpec.cards` 的不透明度 / 毛玻璃模糊；没声明就用全局默认。
 * - **纯色**：主题不声明背景颜色（`color` 只是"纯色"模式用的值），给全局默认。
 *
 * ⚠️ 住在 app 层而不是 core：算它要用 `getThemeSpec`，而 core 不能反向依赖 app
 * （与改造前的 `applyTheme` 同因）。
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
 * 某套主题**实际生效**的档案 = 出厂档案 + 用户改过的那几项。
 *
 * ⚠️ 只想拿一份快照（比如在 hooks 里配合 `useThemePatch`）时用
 * `{ ...factoryProfile(key), ...patch }` 现拼，别走这里 —— 这个函数读模块状态，
 * 放在 `useMemo` 里会被 oxlint 判成"多余依赖"。
 */
export function readThemeProfile(key: ThemeKey): ThemeProfile {
  return { ...factoryProfile(key), ...getThemePatch(key) }
}

/**
 * 「跟随系统」：注册 `prefers-color-scheme` 的监听（`main.tsx` 里在 `loadAppearance()` 之后调）。
 *
 * ⚠️ **只注册一次、不注销**：模式进出「跟随系统」时不订阅/退订，
 * 少一条生命周期分支，StrictMode 双跑也不会漏订阅。回调里只调 `setSystemScheme` ——
 * 不是「跟随系统」时生效主题不变，页面自然什么都不做。
 *
 * 注册时同步一次既是"开机对账"（把 matchMedia 的真值写进 store），
 * 也让这个函数不依赖"调用方之前读过一次"。
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
