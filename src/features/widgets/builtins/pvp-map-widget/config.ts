/** PvP 地图轮换组件的配置类型、默认值与归一化（纯数据，无组件）。 */
export type PvpMapConfig = {
  /** 是否在当前地图后面用灰色箭头补一个「接下来轮到哪张」。 */
  showNextMap: boolean
}

export const PVP_MAP_DEFAULT_CONFIG: PvpMapConfig = {
  showNextMap: true,
}

/** 卡片内容点击后打开的 PvP 日历站。 */
export const PVP_CALENDAR_URL = 'https://pvpc.nbb.fan/'

export function normalizePvpMapConfig(raw: unknown): PvpMapConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  // 只有显式写了 false 才算关；缺失/类型不对一律回落到默认的开
  return { showNextMap: source.showNextMap !== false }
}
