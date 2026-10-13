import type { ThemeSpec } from '../types.ts'

/**
 * 默认-浅色：就是基线本身（`antd: {}`），不维护任何色值 —— 基线改了什么它就跟着改什么。
 */
export const defaultLightSpec: ThemeSpec = {
  key: 'default-light',
  label: '默认-浅色',
  antd: {},
  cards: { alpha: 100, blur: 0 },
}
