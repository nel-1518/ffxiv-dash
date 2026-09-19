import {
  DEFAULT_COLOR_MODE,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  isColorMode,
  isThemeKey,
  THEME_KEYS,
} from '../theme-preference.ts'
import type { ColorMode, ColorScheme, ThemeKey } from '../theme-preference.ts'

/**
 * 外观偏好（纯逻辑，无 React）：**色调模式 + 浅/深两个槽位 + 每套主题一份档案**。
 *
 * 它**不属于看板数据**：独立落一个 localStorage 键，因此 `serializeBoardDoc`
 * 导出时天然不会带上它，导入别人的看板也不会把自己的外观冲掉。
 *
 * 数据模型（键 `ffxiv-dash:appearance:v3`）：
 * - `colorMode`：浅色 / 深色 / 跟随系统。选「浅色」就用 `lightTheme` 那套、
 *   选「深色」用 `darkTheme`、「跟随系统」由 `systemScheme`（matchMedia）决定用哪个；
 * - `profiles`：**逐主题**的背景 + 卡片档案，且只存"用户改过的那几项"，
 *   读的时候由 `app/themes/appearance-sync.ts` 的 `factoryProfile` 补齐主题出厂值。
 *   ⚠️ **生效主题的档案也住在 `profiles` 里**，没有第二份 live 字段 ——
 *   于是"改非生效主题页面不动、改生效主题立刻可见"是数据模型的自然结果，
 *   不需要预览开关，也不需要"切主题时归档旧档案 / 装载新档案"那套编排；
 * - `imageName` / `imageSize`：上传图片的展示信息，**全局一份**
 *   （图片本体在 IndexedDB，见 ./image-store.ts；所有主题共用同一张图）。
 *
 * 背景分四种来源（`ThemeProfile.source`）：
 * - `none`   不设背景，回落到主题自带的背景图（没有图就只剩底色）
 * - `color`  纯色，取自 `color`
 * - `url`    外链或主题自带的图片，取自 `url`
 * - `upload` 本地上传的图片，**图片本体在 IndexedDB 里**，这里只记文件名与大小
 *
 * ⚠️ 上传图片为什么不塞进这里：5MB 的图转成 base64 约 6.7MB，而 localStorage
 * 通常只有 5MB 配额，直接存必然失败（还会连带把看板数据一起写坏）。
 *
 * 消费侧走 useSyncExternalStore（见 ./hooks.ts），因此不需要任何 Provider。
 */

export type AppearanceSource = 'none' | 'color' | 'url' | 'upload'

/** 一套主题的外观档案（背景 + 卡片）。出厂值见 `app/themes/appearance-sync.ts`。 */
export type ThemeProfile = {
  source: AppearanceSource
  /** `color` 模式的颜色，`#rgb` / `#rrggbb`。 */
  color: string
  /** `url` 模式的图片地址。 */
  url: string
  /** 图片模糊半径，0-20（px）。 */
  blur: number
  /** 图片亮度，20-150（百分比）。 */
  brightness: number
  /** 卡片（组件 / 链接）底色的不透明度，0-100。100 = 完全不透明。 */
  cardAlpha: number
  /** 卡片背后那层背景的模糊半径（毛玻璃），0-30（px）。0 = 不模糊。 */
  cardBlur: number
}

/**
 * 逐主题只存用户改过的项 —— 没碰过的字段留给主题出厂值，
 * 这样将来调整 `ThemeSpec` 里声明的预设时，没被改过的字段能跟着更新。
 */
export type ThemeProfilePatch = Partial<ThemeProfile>

/** 落盘的形状。 */
export type AppearanceState = {
  colorMode: ColorMode
  lightTheme: ThemeKey
  darkTheme: ThemeKey
  profiles: Partial<Record<ThemeKey, ThemeProfilePatch>>
  /** 上传图片的文件名与大小，仅用于在设置面板里显示（全局一份）。 */
  imageName: string
  imageSize: number
}

/**
 * 交给 React 的快照：落盘那份 + 两个**运行期**字段。
 *
 * 合成一个对象是为了让 useSyncExternalStore 只比对一处：
 * 图片是异步读出来的、系统色调来自 matchMedia，若各自单放一份，变化时订阅者不会重渲染。
 */
export type AppearanceSnapshot = AppearanceState & {
  /** 系统当前色调（`prefers-color-scheme`）。不落盘：开机重新读一次更可靠。 */
  systemScheme: ColorScheme
  /** 上传图片的 object URL（还没读回来时为 null）。 */
  imageUrl: string | null
}

/** 主题没声明背景 / 卡片时用的全局默认（与改造前的 `DEFAULT_APPEARANCE` 一致）。 */
export const DEFAULT_COLOR = '#1f2937'
export const DEFAULT_CARD_ALPHA = 62
export const DEFAULT_CARD_BLUR = 12

/** 上传图片的大小上限。超过这个大小的文件在选中的那一刻就被拒绝，不会进 IndexedDB。 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** 卡片模糊的上限；再高就只剩一团色块，除了一卡一色以外看不出任何背景细节。 */
export const CARD_BLUR_MAX = 30

const BLUR_MAX = 20
const BRIGHTNESS_MIN = 20
const BRIGHTNESS_MAX = 150

/**
 * 图片地址：协议头（`http(s)://` / `data:image/`）或**根相对路径**（`/bg/x.webp`）。
 *
 * ⚠️ 比 CardFace 的 `linkIconKind` 多认一种「根相对路径」：主题自带的背景图就是
 * `public/bg/` 下的文件，写出来是 `/bg/8-evercold.webp` —— 出厂档案会把它填进「图片链接」，
 * 而那个输入框用的就是这个校验。不用绝对地址（`location.origin + …`）是因为它会随部署
 * 地址变化、也没法离线打开。链接卡片那边（图标字段）保持原样，不动它。
 *
 * 这类地址是**部署无关**的 public 根相对写法：真正拼成可用链接在渲染时过一次
 * `core/asset-url.ts` 的 `assetUrl`（补上 `base`），存回来的值不改写。
 */
const IMAGE_URL_PATTERN = /^(?:https?:\/\/|data:image\/|\/)/i

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const SOURCES: readonly AppearanceSource[] = ['none', 'color', 'url', 'upload']

export function isImageUrl(value: string): boolean {
  return IMAGE_URL_PATTERN.test(value.trim())
}

export function isColorValue(value: string): boolean {
  return COLOR_PATTERN.test(value.trim())
}

function asString(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

function asObject(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
}

/** 有限数字就返回它，否则 null（null = "这项读不出来"，调用方按"没改过"处理）。 */
function asNumber(raw: unknown): number | null {
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(raw: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, raw)))
}

/**
 * 归一化一份"逐主题改动"。
 *
 * ⚠️ 非法字段**直接丢键**（而不是回落成默认值）：丢键的语义正好是"这项没改过"，
 * 读的时候由主题出厂值补上 —— 若在这里回落默认值，反而会把用户的改动写成一份
 * "看起来改过、其实是默认值"的档案，把出厂值覆盖掉。
 *
 * ⚠️ 空 `url` 是**合法值**（"用户把它清空了"）不能丢，否则主题出厂那张图会冒回来，
 * 同一份档案会变成刷新前后显示不同的图。
 */
export function normalizeThemePatch(raw: unknown): ThemeProfilePatch {
  const source = asObject(raw)
  const patch: ThemeProfilePatch = {}

  if (SOURCES.includes(source.source as AppearanceSource)) {
    patch.source = source.source as AppearanceSource
  }

  const color = asString(source.color)
  if (isColorValue(color)) {
    patch.color = color.toLowerCase()
  }

  if (typeof source.url === 'string' && source.url.length <= 2048) {
    patch.url = source.url
  }

  const blur = asNumber(source.blur)
  if (blur !== null) {
    patch.blur = clamp(blur, 0, BLUR_MAX)
  }

  const brightness = asNumber(source.brightness)
  if (brightness !== null) {
    patch.brightness = clamp(brightness, BRIGHTNESS_MIN, BRIGHTNESS_MAX)
  }

  const cardAlpha = asNumber(source.cardAlpha)
  if (cardAlpha !== null) {
    patch.cardAlpha = clamp(cardAlpha, 0, 100)
  }

  const cardBlur = asNumber(source.cardBlur)
  if (cardBlur !== null) {
    patch.cardBlur = clamp(cardBlur, 0, CARD_BLUR_MAX)
  }

  return patch
}

/** 空对象 = "这套主题没改过"，不要留在 `profiles` 里（否则"有没有改过"会误判成 true）。 */
function normalizeProfiles(raw: unknown): Partial<Record<ThemeKey, ThemeProfilePatch>> {
  const source = asObject(raw)
  const profiles: Partial<Record<ThemeKey, ThemeProfilePatch>> = {}

  for (const key of THEME_KEYS) {
    const patch = normalizeThemePatch(source[key])
    if (Object.keys(patch).length > 0) {
      profiles[key] = patch
    }
  }

  return profiles
}

function defaultAppearance(): AppearanceState {
  return {
    colorMode: DEFAULT_COLOR_MODE,
    lightTheme: DEFAULT_LIGHT_THEME,
    darkTheme: DEFAULT_DARK_THEME,
    profiles: {},
    imageName: '',
    imageSize: 0,
  }
}

/** 校验并归一化：非法值一律回落到默认，保证界面上永远拿得到可用的状态。
 *
 * ⚠️ **不做任何旧版本的兼容**（用户 2026-09 明确：这次改动不用兼容旧版）：
 * 早期那个"只有一个 `theme` 字段"的形状与改造过程中的中间形状都**丢弃**，按默认值起。
 * 键名里的 `v3` 只是把这个形状标记出来，让不认识的旧值不会撞进来。
 */
export function normalizeAppearance(raw: unknown): AppearanceState {
  const source = asObject(raw)

  return {
    colorMode: isColorMode(source.colorMode) ? source.colorMode : DEFAULT_COLOR_MODE,
    lightTheme: isThemeKey(source.lightTheme) ? source.lightTheme : DEFAULT_LIGHT_THEME,
    darkTheme: isThemeKey(source.darkTheme) ? source.darkTheme : DEFAULT_DARK_THEME,
    profiles: normalizeProfiles(source.profiles),
    imageName: asString(source.imageName).slice(0, 120),
    imageSize: Math.max(0, asNumber(source.imageSize) ?? 0),
  }
}

/**
 * 键名带版本号：v3 的形状是"色调 + 双槽位 + 逐主题档案"，与早先"只有一个 `theme` 字段"那版
 * 结构完全不同 —— 换个键、**不读旧键**（本次改动不做兼容，旧数据直接弃掉走默认值）。
 */
const STORAGE_KEY = 'ffxiv-dash:appearance:v3'

function persist(next: AppearanceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    // 配额满 / 隐私模式：外观是锦上添花的东西，不该因为它存不下就打断用户
    console.warn('[ffxiv-dash] 外观偏好未能保存', error)
  }
}

function readStored(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeAppearance(JSON.parse(raw)) : defaultAppearance()
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取外观偏好，使用默认值', error)
    return defaultAppearance()
  }
}

/** 系统当前色调。开机同步读一次（首帧配色要正确），之后的监听在 app 层注册。 */
export function readSystemScheme(): ColorScheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 上传图片的 object URL；由 ./image-store.ts 在图片准备好后填进来。 */
let imageUrl: string | null = null

/** 系统色调（运行期字段，不进 localStorage）。 */
let systemScheme: ColorScheme = 'light'

/**
 * 模块级状态与快照。
 *
 * ⚠️ 快照必须是稳定引用：useSyncExternalStore 每次渲染都拿它比对，
 * 每次现算新对象会永远"变了"，直接无限重渲染（时钟那边踩过）。
 * `rebuildSnapshot` 只重建**顶层**对象，`profiles` 里没被改的那些主题保持原引用 ——
 * `useThemePatch(key)` 就是靠这一点做细粒度订阅的。
 */
let state: AppearanceState = defaultAppearance()
let snapshot: AppearanceSnapshot = { ...state, systemScheme, imageUrl }
let loaded = false

type Listener = () => void
const listeners = new Set<Listener>()

function rebuildSnapshot(): void {
  snapshot = { ...state, systemScheme, imageUrl }
}

function notify(): void {
  rebuildSnapshot()
  for (const listener of listeners) {
    listener()
  }
}

/** 落盘 + 通知。`next` 必须是已经过校验的完整状态。 */
function commit(next: AppearanceState): void {
  state = next
  persist(next)
  notify()
}

/** 读取外观偏好；幂等，重复调用只读一次存储。应用启动时先调它。 */
export function loadAppearance(): AppearanceSnapshot {
  if (!loaded) {
    systemScheme = readSystemScheme()
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

/** 解析后的色调：显式选的就用它，跟随系统时看系统。 */
export function resolveScheme(current: AppearanceSnapshot = snapshot): ColorScheme {
  return current.colorMode === 'system' ? current.systemScheme : current.colorMode
}

/**
 * 当前**生效主题** —— 由色调模式与两个槽位纯算出来，不是存下来的一个字段。
 *
 * `useSyncExternalStore` 拿这个字符串做 `Object.is` 比较，所以换背景图
 * （会重建含 `imageUrl` 的快照）不会顺带让主题的消费者重渲染。
 */
export function resolveTheme(current: AppearanceSnapshot = snapshot): ThemeKey {
  return resolveScheme(current) === 'light' ? current.lightTheme : current.darkTheme
}

/** 某套主题"用户改过的项"；没改过就是 undefined（`profiles` 里连空壳都不留）。 */
export function getThemePatch(key: ThemeKey): ThemeProfilePatch | undefined {
  return state.profiles[key]
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

/** 色调模式三选一。槽位不动 —— 切回原来的色调时，之前那套主题与它的档案都还在。 */
export function setColorMode(mode: ColorMode): void {
  if (state.colorMode === mode) {
    return
  }
  commit({ ...state, colorMode: mode })
}

/**
 * 给某个色调的槽位换一套主题。
 *
 * ⚠️ 只改槽位、不动 `colorMode`：「外观」里换浅色槽位的主题时，如果用户当前固定的是深色，
 * 页面本来就不该变（那套主题只在切到浅色时才生效）。
 */
export function setThemeSlot(scheme: ColorScheme, key: ThemeKey): void {
  const field = scheme === 'light' ? 'lightTheme' : 'darkTheme'
  if (state[field] === key) {
    return
  }
  commit({ ...state, [field]: key })
}

/**
 * 系统色调变化（app 层的 matchMedia 监听调用）。
 *
 * 不是「跟随系统」时它只改一个不参与解析的字段，页面自然什么都不做 ——
 * 所以监听可以常驻，不必随模式进出订阅/退订。
 */
export function setSystemScheme(scheme: ColorScheme): void {
  if (systemScheme === scheme) {
    return
  }
  systemScheme = scheme
  notify()
}

function sameProfile(a: ThemeProfilePatch | undefined, b: ThemeProfilePatch): boolean {
  if (!a) {
    return false
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (a[key as keyof ThemeProfile] !== b[key as keyof ThemeProfile]) {
      return false
    }
  }
  return true
}

/**
 * 改某套主题的档案（只传改动的项）。
 *
 * 生效主题的档案一改，快照就变 → 页面立刻跟着变；改的是别的主题，快照不变 →
 * 页面**一点样式都不动**。两个行为都不需要额外机制。
 */
export function setThemeProfile(key: ThemeKey, patch: ThemeProfilePatch): void {
  const current = state.profiles[key]
  const next = normalizeThemePatch({ ...current, ...patch })

  if (Object.keys(next).length === 0) {
    // 传进来的值全被校验挡掉了：等同"恢复默认"，但别写一个空壳进 profiles
    resetThemeProfile(key)
    return
  }

  if (sameProfile(current, next)) {
    return
  }

  commit({ ...state, profiles: { ...state.profiles, [key]: next } })
}

/** 恢复某套主题的默认外观：删掉它的改动，读时自然回落主题出厂档案。 */
export function resetThemeProfile(key: ThemeKey): void {
  if (!state.profiles[key]) {
    return
  }
  const profiles = { ...state.profiles }
  delete profiles[key]
  commit({ ...state, profiles })
}

/**
 * 记录上传图片的文件名与大小（图片本体在 IndexedDB）。
 *
 * ⚠️ 这是**全局**的一份，不挂在某套主题上：上传的图所有主题共用一张，
 * 只有"用不用它"（`source`）是逐主题的。
 */
export function setBackgroundImageMeta(imageName: string, imageSize: number): void {
  const name = imageName.slice(0, 120)
  const size = Math.max(0, imageSize)
  if (state.imageName === name && state.imageSize === size) {
    return
  }
  commit({ ...state, imageName: name, imageSize: size })
}
