/**
 * 极光预报组件的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * 唯一的可配置项是「地图范围」：全部（两地并列）或单选一个区域。
 * 极光窗口本身完全由游戏天气规则推算，这个模块不做任何计算。
 */
import type { AuroraZoneId } from './forecast.ts'

/** 展示的地图范围：`all` 两地并列，其余为单选区域。 */
export type AuroraZoneOption = 'all' | AuroraZoneId

export type AuroraConfig = {
  zone: AuroraZoneOption
}

export const AURORA_DEFAULT_CONFIG: AuroraConfig = { zone: 'all' }

/** 编辑弹窗里的地图范围选项（含「全部」）。 */
export const AURORA_ZONE_OPTIONS: { value: AuroraZoneOption; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'old-sharlayan', label: '旧萨雷安' },
  { value: 'coerthas-western', label: '库尔札斯西部高地' },
]

const VALID_ZONES: readonly string[] = AURORA_ZONE_OPTIONS.map((option) => option.value)

/** 补默认值并挡掉未知区域；缺失/不认识的一律回落到「全部」。 */
export function normalizeAuroraConfig(raw: unknown): AuroraConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const zone = source.zone
  return { zone: VALID_ZONES.includes(zone as string) ? (zone as AuroraZoneOption) : 'all' }
}
