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
 * 外观偏好（纯逻辑，无 React）：色调模式 + 浅/深两个槽位 + 逐主题档案，独立落 `ffxiv-dash:appearance:v3`。
 * `colorMode` 由 `systemScheme` 决定用哪个槽位；`profiles` 只存用户改过的项，读时由
 * `app/themes/appearance-sync.ts` 的 `factoryProfile` 补出厂值。生效主题的档案也住在 `profiles` 里（无 live 副本）。
 * 背景来源 `source`：none=主题自带 / color / url / upload；`imageName`/`imageSize` 仅展示，本体在 IndexedDB（./image-store.ts）。
 * ⚠️ 上传图不进 localStorage：5MB 图转 base64 ≈6.7MB 必超配额，直接存必然失败（连带写坏看板数据）。
 * ⚠️ 交给 React 的快照必须稳定引用（见 `AppearanceSnapshot`）。备份单列一段（`core/storage/backup.ts`）。
 */

export type AppearanceSource = 'none' | 'color' | 'url' | 'upload'

/**
 * 一套主题的外观档案（背景 + 卡片 + 上传图展示信息）。出厂值见 `app/themes/appearance-sync.ts`。
 */
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
  /** 卡片（组件 / 导航卡）底色的不透明度，0-100。100 = 完全不透明。 */
  cardAlpha: number
  /** 卡片背后那层背景的模糊半径（毛玻璃），0-30（px）。0 = 不模糊。 */
  cardBlur: number
  /**
   * 本主题上传图片的文件名，空串 = 没上传过。**只用于设置面板里显示**。
   * 图片本体不在这里（在 IndexedDB，见 ./image-store.ts）。
   */
  imageName: string
  /** 本主题上传图片的大小（字节），0 = 没上传过。 */
  imageSize: number
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
}

/**
 * 交给 React 的快照：落盘那份 + 两个运行期字段（合并成一个对象，useSyncExternalStore 只比对一处；
 * 各自单放一份时，图片异步读完 / matchMedia 触发的变化不会让订阅者重渲染）。
 */
export type AppearanceSnapshot = AppearanceState & {
  /** 系统当前色调（`prefers-color-scheme`），不落盘：开机重新读更可靠。 */
  systemScheme: ColorScheme
  /** 逐主题上传图的 object URL；只有已读回/已上传的主题才有键，没有就是没图。 */
  imageUrls: Partial<Record<ThemeKey, string>>
}

/** 主题没声明背景 / 卡片时用的全局默认。 */
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
 * 图片地址：协议头（`http(s)://` / `data:image/`）或根相对路径（`/bg/x.jpg`）。
 * ⚠️ 比 CardFace 的 `linkIconKind` 多认「根相对路径」：主题自带背景图就是 `public/bg/` 下的文件，
 * 出厂档案会把它填进「图片链接」。不用绝对地址（随部署地址变化、没法离线打开）；
 * 渲染时过 `core/asset-url.ts` 的 `assetUrl` 补 `base`，存回的值不改写。
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
 * 归一化一份「逐主题改动」。
 * ⚠️ 非法字段直接丢键（不回落默认值）：丢键 =「这项没改过」，读时由出厂值补上；
 * 回落默认值会写出一「看似改过、实为默认」的档案，把出厂值覆盖掉。
 * ⚠️ 空 `url` 是合法值（用户清空了）不能丢，否则主题出厂那张图会冒回来。
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

  // 空 imageName 合法（用户把图移除了）不能丢，否则移除过的主题会继续显示上次文件名
  if (typeof source.imageName === 'string' && source.imageName.length <= 120) {
    patch.imageName = source.imageName
  }

  const imageSize = asNumber(source.imageSize)
  if (imageSize !== null) {
    patch.imageSize = Math.max(0, Math.round(imageSize))
  }

  return patch
}

/** 空对象 = 「这套主题没改过」，不留进 `profiles`（否则「有没有改过」会误判成 true）。 */
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
  }
}

/** 校验并归一化：非法值一律回落到默认，保证界面上永远拿得到可用的状态。 */
export function normalizeAppearance(raw: unknown): AppearanceState {
  const source = asObject(raw)

  return {
    colorMode: isColorMode(source.colorMode) ? source.colorMode : DEFAULT_COLOR_MODE,
    lightTheme: isThemeKey(source.lightTheme) ? source.lightTheme : DEFAULT_LIGHT_THEME,
    darkTheme: isThemeKey(source.darkTheme) ? source.darkTheme : DEFAULT_DARK_THEME,
    profiles: normalizeProfiles(source.profiles),
  }
}

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

/**
 * 逐主题上传图的 object URL；由 ./image-store.ts 在图片准备好 / 上传成功时填进来。
 * 换图时整份对象换新（不原地改），订阅者才看得到变化。
 */
let imageUrls: Partial<Record<ThemeKey, string>> = {}

/** 系统色调（运行期字段，不进 localStorage）。 */
let systemScheme: ColorScheme = 'light'

/**
 * 模块级状态与快照。
 * ⚠️ 快照必须稳定引用：useSyncExternalStore 每次渲染都比对，现算新对象会无限重渲染。
 * `rebuildSnapshot` 只重建顶层；没改的主题保持原引用，`useThemePatch(key)` 靠此做细粒度订阅。
 */
let state: AppearanceState = defaultAppearance()
let snapshot: AppearanceSnapshot = { ...state, systemScheme, imageUrls }
let loaded = false

type Listener = () => void
const listeners = new Set<Listener>()

function rebuildSnapshot(): void {
  snapshot = { ...state, systemScheme, imageUrls }
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

/**
 * 备份导入后的逐主题字段白名单（默认不搬）：这四个都是「怎么显示」的参数，跟本机的图 / 色才有意义。
 * 用白名单不用黑名单：将来档案加字段默认不导入，不会静默跟备份跑。
 */
const IMPORTED_PROFILE_FIELDS = [
  'blur',
  'brightness',
  'cardAlpha',
  'cardBlur',
] as const satisfies readonly (keyof ThemeProfile)[]

/**
 * 从备份的一份档案里挑出照搬的那几项。
 * ⚠️ 没写过的字段不出现在结果里：「键不存在」=「这项没改过」，补默认值等于替用户改成出厂值（见 `normalizeThemePatch`）。
 */
function pickImportedTunings(patch: ThemeProfilePatch | undefined): ThemeProfilePatch {
  const picked: ThemeProfilePatch = {}
  if (!patch) {
    return picked
  }
  for (const field of IMPORTED_PROFILE_FIELDS) {
    const value = patch[field]
    if (value !== undefined) {
      picked[field] = value
    }
  }
  return picked
}

/**
 * 从备份导入外观，粒度刻意分两半：`colorMode` / 两个槽位整份照搬（纯偏好，与本机资源无关）；
 * 逐主题档案只搬 `IMPORTED_PROFILE_FIELDS` 四个数值，背景来源与上传图信息保持本机现状
 * （换成别人备份的图 / 色会让「导入看板」变得危险）。不复用 `setThemeProfile`（局部改动语义，
 * 合并结果为空时会删整份档案），先拼好整份 `profiles` 再一次性 `commit`。
 * ⚠️ 不碰 IndexedDB：上传图不搬进来，也不改本机已有的那张（见 ./image-store.ts）。
 */
export function importAppearance(raw: unknown): void {
  // 先确保读盘走完；幂等，重复调用不会重读存储
  loadAppearance()

  // 归一化一次性拿到两半：全局三字段照搬，档案按白名单挑（手改坏的值在这里被挡掉）
  const { colorMode, lightTheme, darkTheme, profiles: imported } = normalizeAppearance(raw)

  const profiles = { ...state.profiles }
  for (const key of THEME_KEYS) {
    const tunings = pickImportedTunings(imported[key])
    if (Object.keys(tunings).length === 0) {
      // 备份里这套主题没调过显示参数：本机档案不动
      continue
    }
    // 与本机档案合并后重新归一化，保证落盘的一定是合法值
    const next = normalizeThemePatch({ ...profiles[key], ...tunings })
    if (Object.keys(next).length === 0) {
      // 理论上到不了（tunings 非空且已校验）；防御性丢掉空壳
      delete profiles[key]
      continue
    }
    profiles[key] = next
  }

  commit({ colorMode, lightTheme, darkTheme, profiles })
}

/**
 * 恢复导入前快照里的外观（整体替换）。与 `importAppearance` 的细粒度刻意不同：
 * 快照来自本机、在覆盖前一刻存下，档案引用本机 IndexedDB 同一批图，整份搬回即恢复原状。
 */
export function restoreAppearance(raw: unknown): void {
  loadAppearance()
  commit(normalizeAppearance(raw))
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
 * 当前生效主题 —— 由色调模式与两个槽位纯算出来，不是存下来的字段。
 * 换背景图会重建含 `imageUrls` 的快照，主题消费者不跟着重渲染。
 */
export function resolveTheme(current: AppearanceSnapshot = snapshot): ThemeKey {
  return resolveScheme(current) === 'light' ? current.lightTheme : current.darkTheme
}

/** 某套主题"用户改过的项"；没改过就是 undefined（`profiles` 里连空壳都不留）。 */
export function getThemePatch(key: ThemeKey): ThemeProfilePatch | undefined {
  return state.profiles[key]
}

/**
 * 记录/替换某套主题上传图的 object URL。
 * ⚠️ 换图时 revoke 上一个 URL：object URL 不被 GC 自动回收，不换就漏一份内存。
 */
export function setThemeImageUrl(key: ThemeKey, next: string | null): void {
  const previous = imageUrls[key] ?? null
  if (previous === next) {
    return
  }
  if (previous) {
    URL.revokeObjectURL(previous)
  }

  const nextUrls = { ...imageUrls }
  if (next === null) {
    delete nextUrls[key]
  } else {
    nextUrls[key] = next
  }
  imageUrls = nextUrls
  notify()
}

/** 某套主题上传图的 object URL；还没有（没上传过 / 没读回来）时是 null。 */
export function getThemeImageUrl(key: ThemeKey): string | null {
  return imageUrls[key] ?? null
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
 * ⚠️ 只改槽位、不动 `colorMode`：换非生效色调的主题时页面本来就不该变。
 */
export function setThemeSlot(scheme: ColorScheme, key: ThemeKey): void {
  const field = scheme === 'light' ? 'lightTheme' : 'darkTheme'
  if (state[field] === key) {
    return
  }
  commit({ ...state, [field]: key })
}

/**
 * 系统色调变化（app 层 matchMedia 监听调用）。
 * 非「跟随系统」时只改一个不参与解析的字段，页面无反应——监听因此常驻。
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
 * 改某套主题的档案（只传改动项）。改生效主题 → 快照变、页面立刻变；改别的 → 快照引用不变、页面不动。
 */
export function setThemeProfile(key: ThemeKey, patch: ThemeProfilePatch): void {
  const current = state.profiles[key]
  const next = normalizeThemePatch({ ...current, ...patch })

  if (Object.keys(next).length === 0) {
    // 传进来的值全被校验挡掉：等同"恢复默认"，但别写空壳进 profiles
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
