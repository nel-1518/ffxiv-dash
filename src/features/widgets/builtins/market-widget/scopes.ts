/**
 * 区服选择与「三级 → 接口档位」映射（纯逻辑，无 React）。
 *
 * 世界表本身在 `core/world.ts`（通用数据）；这里只放 Universalis 相关的东西：
 * 下拉怎么分组、某个区服该读 aggregated 响应里的哪一档。
 */
import {
  CHINA_REGION,
  DATA_CENTERS,
  isDataCenterName,
  worldNameById,
} from '../../../../core/world.ts'
/**
 * 区服对应 aggregated 响应里的档位。
 *
 * 选整个中国区 → `region`，选大区 → `dc`，选单个服务器 → `world`。
 */
export type ScopeTier = 'world' | 'dc' | 'region'

/** antd Select 的选项形状：要么是一个可选项，要么是一个带子项的分组。 */
type ScopeOptionGroup = {
  label: string
  value?: string
  options?: { label: string; value: string }[]
}

/**
 * 区服下拉的选项。
 *
 * 大区既要当分组标题、又要能被选中，所以在分组**内部**再放一条
 * 「XX（大区）」—— antd 的分组标题本身不可选，不这样会漏掉大区粒度。
 */
export function scopeOptions(): ScopeOptionGroup[] {
  return [
    { label: '中国（全区）', value: CHINA_REGION },
    ...DATA_CENTERS.map((dc) => ({
      label: dc.name,
      options: [
        { label: `${dc.name}（大区）`, value: dc.name },
        ...dc.worlds.map((world) => ({ label: world.name, value: world.name })),
      ],
    })),
  ]
}

/** 该区服取 aggregated 响应里的哪一档。 */
export function resolveTier(scope: string): ScopeTier {
  if (scope === CHINA_REGION) {
    return 'region'
  }
  if (isDataCenterName(scope)) {
    return 'dc'
  }
  return 'world'
}

/** 区服的展示名。 */
export function scopeLabel(scope: string): string {
  if (scope === CHINA_REGION) {
    return '中国（全区）'
  }
  if (isDataCenterName(scope)) {
    return `${scope}（大区）`
  }
  return scope
}

export { worldNameById }
