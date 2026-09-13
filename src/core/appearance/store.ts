import { DEFAULT_THEME, isThemeKey } from '../theme-preference.ts'
import type { ThemeKey } from '../theme-preference.ts'

/**
 * 外观偏好（纯逻辑，无 React）：主题 + 背景 + 卡片，三样共用一个键。
 *
 * 它**不属于看板数据**：独立落一个 localStorage 键，因此 `serializeBoardDoc`
 * 导出时天然不会带上它，导入别人的看板也不会把自己的外观冲掉。
 *
 * 背景分四种来源（`source`）：
 * - `none`   不设背景，回落到主题的 colorBgLayout
 * - `color`  纯色，取自 `color`
 * - `url`    外链图片，取自 `url`
 * - `upload` 本地上传的图片，**图片本体在 IndexedDB 里**（见 ./image-store.ts），
 *            这里只记文件名与大小用于展示
 *
 * ⚠️ 上传图片为什么不塞进这里：5MB 的图转成 base64 约 6.7MB，而 localStorage
 * 通常只有 5MB 配额，直接存必然失败（还会连带把看板数据一起写坏）。
 *
 * 消费侧走 useSyncExternalStore（见 ./hooks.ts），因此不需要任何 Provider。
 */

export type AppearanceSource = 'none' | 'color' | 'url' | 'upload'

export type AppearanceState = {
  /** 当前主题；可选值与默认值在 `../theme-preference.ts`。 */
  theme: ThemeKey
  source: AppearanceSource
  /** `color` 模式的颜色，`#rgb` / `#rrggbb`。 */
  color: string
  /** `url` 模式的图片地址。 */
  url: string
  /** 模糊半径，0-20（px）。 */
  blur: number
  /**
   * 亮度，20-150（百分比）。
   */
  brightness: number
  /** 上传图片的文件名与大小，仅用于在设置面板里显示。 */
  imageName: string
  imageSize: number
  /** 卡片（组件 / 链接）底色的不透明度，0-100。100 = 完全不透明。 */
  cardAlpha: number
  /** 卡片背后那层背景的模糊半径（毛玻璃），0-30（px）。0 = 不模糊。 */
  cardBlur: number
}

/**
 * 交给 React 的快照：落盘那份 + 运行期才有的 object URL。
 *
 * 合成一个对象是为了让 useSyncExternalStore 只比对一处 ——
 * 图片是异步读出来的，若 url 单独放一份，换图时订阅者不会重渲染。
 */
export type AppearanceSnapshot = AppearanceState & { imageUrl: string | null }

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: DEFAULT_THEME,
  source: 'none',
  color: '#1f2937',
  url: '',
  blur: 0,
  brightness: 100,
  imageName: '',
  imageSize: 0,
  /*
   * 卡片的默认值就是「半透明 + 毛玻璃」：卡片压在背景（图片或纯色）上时
   * 能透出底下的东西，页面才像一整块而不是贴了一排白纸。
   * 不想透就把「卡片 → 不透明度」拉满。
   */
  cardAlpha: 62,
  cardBlur: 12,
}

/** 上传图片的大小上限。超过这个大小的文件在选中的那一刻就被拒绝，不会进 IndexedDB。 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/**
 * 图片地址：协议头（`http(s)://` / `data:image/`）或**根相对路径**（`/bg/x.webp`）。
 *
 * ⚠️ 比 CardFace 的 `linkIconKind` 多认一种「根相对路径」：主题自带的背景图就是
 * `public/bg/` 下的文件，写出来是 `/bg/8-evercold.webp` —— 选主题时会把它填进「图片链接」，
 * 而那个输入框用的就是这个校验。不用绝对地址（`location.origin + …`）是因为它会随部署
 * 地址变化、也没法离线打开。链接卡片那边（图标字段）保持原样，不动它。
 */
const IMAGE_URL_PATTERN = /^(?:https?:\/\/|data:image\/|\/)/i

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const SOURCES: readonly AppearanceSource[] = ['none', 'color', 'url', 'upload']

const BLUR_MAX = 20
const BRIGHTNESS_MIN = 20
const BRIGHTNESS_MAX = 150

/** 卡片模糊的上限；再高就只剩一团色块，除了一卡一色以外看不出任何背景细节。 */
export const CARD_BLUR_MAX = 30

export function isImageUrl(value: string): boolean {
  return IMAGE_URL_PATTERN.test(value.trim())
}

export function isColorValue(value: string): boolean {
  return COLOR_PATTERN.test(value.trim())
}

function clamp(raw: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, parsed))
}

function asString(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

/**
 * 校验并归一化：非法值一律回落到默认，保证界面上永远拿得到可用的状态。
 * 视角是"读到的数据可能来自被手改过的 localStorage 或更老的版本"。
 */
export function normalizeAppearance(raw: unknown): AppearanceState {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  const sourceKey = SOURCES.includes(source.source as AppearanceSource)
    ? (source.source as AppearanceSource)
    : DEFAULT_APPEARANCE.source

  const color = asString(source.color)
  const url = asString(source.url)

  return {
    theme: isThemeKey(source.theme) ? source.theme : DEFAULT_THEME,
    source: sourceKey,
    color: isColorValue(color) ? color.toLowerCase() : DEFAULT_APPEARANCE.color,
    url: isImageUrl(url) ? url : '',
    blur: Math.round(clamp(source.blur, 0, BLUR_MAX, DEFAULT_APPEARANCE.blur)),
    brightness: Math.round(
      clamp(source.brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX, DEFAULT_APPEARANCE.brightness),
    ),
    imageName: asString(source.imageName).slice(0, 120),
    imageSize: Math.max(0, clamp(source.imageSize, 0, Number.MAX_SAFE_INTEGER, 0)),
    cardAlpha: Math.round(clamp(source.cardAlpha, 0, 100, DEFAULT_APPEARANCE.cardAlpha)),
    cardBlur: Math.round(clamp(source.cardBlur, 0, CARD_BLUR_MAX, DEFAULT_APPEARANCE.cardBlur)),
  }
}

/**
 * 键名带 v2：结构从"只有外观"变成"主题 + 外观"。早期的 `appearance:v1`
 * 与更早的 `theme:v1` 都不再读写，留着它们只会得到半新半旧的值。
 */
const STORAGE_KEY = 'ffxiv-dash:appearance:v2'

function readStored(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeAppearance(JSON.parse(raw)) : DEFAULT_APPEARANCE
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取外观偏好，使用默认值', error)
    return DEFAULT_APPEARANCE
  }
}

/** 上传图片的 object URL；由 ./image-store.ts 在图片准备好后填进来。 */
let imageUrl: string | null = null

/**
 * 模块级快照。
 *
 * ⚠️ 必须是稳定引用：useSyncExternalStore 每次渲染都拿它比对，
 * 每次现算新对象会永远"变了"，直接无限重渲染（时钟那边踩过）。
 * 只有 state 或 imageUrl 真正变化时才重建。
 */
let state: AppearanceState = DEFAULT_APPEARANCE
let snapshot: AppearanceSnapshot = { ...DEFAULT_APPEARANCE, imageUrl: null }
let loaded = false

type Listener = () => void
const listeners = new Set<Listener>()

function rebuildSnapshot(): void {
  snapshot = { ...state, imageUrl }
}

function notify(): void {
  rebuildSnapshot()
  for (const listener of listeners) {
    listener()
  }
}

/** 读取外观偏好；幂等，重复调用只读一次存储。应用启动时先调它。 */
export function loadAppearance(): AppearanceSnapshot {
  if (!loaded) {
    state = readStored()
    loaded = true
    rebuildSnapshot()
  }
  return snapshot
}

/** 当前外观快照（稳定引用）。 */
export function getAppearance(): AppearanceSnapshot {
  return snapshot
}

/**
 * 当前主题 —— 单独给一个"只读原始值"的入口，供 `useTheme()` 使用。
 *
 * `useSyncExternalStore` 拿这个字符串做 `Object.is` 比较，所以换背景图
 * （会重建含 `imageUrl` 的快照）不会顺带让主题的消费者重渲染。
 */
export function getTheme(): ThemeKey {
  return state.theme
}

/**
 * 记录/替换上传图片的 object URL。
 *
 * 传新 URL 时会 revoke 上一个 —— object URL 不会被 GC 自动回收，
 * 每换一次图就漏一份内存，必须手动释放。
 */
export function setImageUrl(next: string | null): void {
  if (imageUrl === next) {
    return
  }
  const previous = imageUrl
  imageUrl = next
  if (previous) {
    URL.revokeObjectURL(previous)
  }
  notify()
}

export function subscribeAppearance(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 补丁式更新：归一化 → 落盘 → 通知订阅者。
 *
 * 落盘失败（配额满 / 隐私模式）只告警，界面照样生效 —— 外观是锦上添花的东西，
 * 不该因为它存不下就打断用户。
 */
export function setAppearance(patch: Partial<AppearanceState>): AppearanceState {
  state = normalizeAppearance({ ...state, ...patch })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[ffxiv-dash] 外观偏好未能保存', error)
  }
  notify()
  return state
}
