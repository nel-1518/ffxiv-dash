import { DEFAULT_APPEARANCE, setAppearance } from '../../core/appearance/store.ts'
import { getThemeSpec } from './index.ts'
import type { AppearanceState } from '../../core/appearance/store.ts'
import type { ThemeKey } from '../../core/theme-preference.ts'

/**
 * 换主题时把「外观」里跟主题有关的项一起换掉 —— **主题说了算，会盖掉用户自己调的值**。
 *
 * - **背景**：主题自带图就写进「图片链接」并取预设的模糊/亮度；不带图就退回「无」。
 *   写成图片链接而不是留个隐形回落，是为了让这张图的参数能在设置里直接调
 *   （「图片显示」一节只在图片来源下才渲染）。
 * - **卡片**：`ThemeSpec.cards` 的不透明度 / 毛玻璃模糊；没声明就用全局默认。
 *
 * 被盖掉的值不会永久丢失：颜色 / 地址 / 上传的文件都还在状态里（上传的图在 IndexedDB），
 * 点回对应来源即可。
 *
 * ⚠️ 只在**确实换了主题**时调用（`ThemePicker` 会先比一次当前主题）——
 * 点到已选中的主题不该把用户调过的滑块重置回预设值。
 * ⚠️ 不要挂到启动流程：那样每次进页面都会把用户手动选的「无」改回图片链接。
 * ⚠️ 一次 `setAppearance` 写完整个补丁（`normalizeAppearance` 是整体归一化，
 * 分两次写会多一次落盘与通知，还会让两次渲染之间出现半新半旧的状态）。
 */
export function syncAppearanceWithTheme(themeKey: ThemeKey): void {
  const { background, cards } = getThemeSpec(themeKey)

  const patch: Partial<AppearanceState> = {
    cardAlpha: cards?.alpha ?? DEFAULT_APPEARANCE.cardAlpha,
    cardBlur: cards?.blur ?? DEFAULT_APPEARANCE.cardBlur,
  }

  if (background) {
    patch.source = 'url'
    patch.url = background.url
    patch.blur = background.blur ?? 0
    patch.brightness = background.brightness ?? 100
  } else {
    patch.source = 'none'
  }

  setAppearance(patch)
}
