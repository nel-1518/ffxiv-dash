import type { ThemeKey } from '../../core/theme-preference.ts'
import type { ThemeSpec } from './types.ts'
import { dawntrailSpec } from './dawntrail/index.ts'
import { defaultDarkSpec } from './default-dark/index.ts'
import { defaultLightSpec } from './default-light/index.ts'
import { endwalkerSpec } from './endwalker/index.ts'
import { evercoldSpec } from './evercold/index.ts'
import { heavenswardSpec } from './heavensward/index.ts'
import { shadowbringersSpec } from './shadowbringers/index.ts'
import { stormbloodSpec } from './stormblood/index.ts'

/**
 * 主题注册表。类型写成 `Record<ThemeKey, ThemeSpec>` 是为了让"少注册一套主题"直接编译报错；
 * 展示顺序由 `core/theme-preference.ts` 的 `THEME_KEYS` 决定。增删主题见 `docs/themes.md`。
 */
export const THEME_SPECS: Record<ThemeKey, ThemeSpec> = {
  'default-light': defaultLightSpec,
  'default-dark': defaultDarkSpec,
  heavensward: heavenswardSpec,
  stormblood: stormbloodSpec,
  shadowbringers: shadowbringersSpec,
  endwalker: endwalkerSpec,
  dawntrail: dawntrailSpec,
  evercold: evercoldSpec,
}

export function getThemeSpec(key: ThemeKey): ThemeSpec {
  return THEME_SPECS[key]
}

export type { ThemeBackground, ThemeSpec } from './types.ts'
