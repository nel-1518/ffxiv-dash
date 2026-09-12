import type { ThemeSpec } from '../types.ts'

/**
 * 苍穹：**配色待做**。
 *
 * `antd: {}` 表示完全沿用基线主题（`app/theme-config.ts`），因此选了它与
 * 「默认-浅色」渲染完全一致 —— 苍穹自己还没有色值。
 * 要开工时在这里填令牌、需要的话加一个 `theme.css` 并 `import './theme.css'`。
 *
 * ⚠️ 中性基线已经拆出去由「默认-浅色」专任（见 `themes/default-light/`），
 * 这套做完后应当有明确的色相方向，不要再回到「什么都没改」的状态。
 */
export const heavenswardSpec: ThemeSpec = {
  key: 'heavensward',
  label: '苍穹',
  antd: {},
}
