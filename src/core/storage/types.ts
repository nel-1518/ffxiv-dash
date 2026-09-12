/** 项目类型；类型决定项目允许的内容和布局。 */
export type GroupType = 'link' | 'widget'

/** 分组内项目的种类。 */
export type ItemKind = 'link' | 'widget'

export type LinkItem = {
  id: string
  kind: 'link'
  name: string
  url: string
  desc?: string
  icon?: string
}

export type WidgetItem = {
  id: string
  kind: 'widget'
  /** 对应组件注册表里的 WidgetSpec.key。 */
  widget: string
  title: string
  /** 由各组件 spec 自行解释并校验。 */
  config: Record<string, unknown>
}

export type Item = LinkItem | WidgetItem

export type Group = {
  id: string
  title: string
  type: GroupType
  /** 分组内卡片的排布列数，取值 1-6；缺省时按类型取 DEFAULT_GROUP_COLUMNS。 */
  columns: number
  items: Item[]
}

/** 仪表盘文档，state 层的唯一数据源。 */
export type BoardDoc = {
  version: number
  groups: Group[]
}

/**
 * 修正组件配置的回调。由 widgets 层注入，避免 core 反向依赖 feature 层。
 * 返回 null 表示该组件 key 未注册，保留原始配置。
 */
export type WidgetConfigNormalizer = (widgetKey: string, raw: unknown) => Record<string, unknown> | null

export const GROUP_TYPES: readonly GroupType[] = ['link', 'widget']
export const ITEM_KINDS: readonly ItemKind[] = ['link', 'widget']

/**
 * 分组列数的取值范围与各类型的默认值。
 *
 * 取值范围放在 core：它是数据模型的一部分（校验、表单、排布都要用），
 * 默认值刻意对齐"可配置列数"之前的展示效果，老数据的观感不会变。
 */
export const GROUP_COLUMNS_MIN = 1
export const GROUP_COLUMNS_MAX = 6

export const DEFAULT_GROUP_COLUMNS: Record<GroupType, number> = {
  link: 4,
  widget: 4,
}

/** 把任意输入收敛成合法列数：非法或缺失时按项目类型取默认值。 */
export function clampGroupColumns(value: unknown, type: GroupType): number {
  const fallback = DEFAULT_GROUP_COLUMNS[type] ?? DEFAULT_GROUP_COLUMNS.widget
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(GROUP_COLUMNS_MAX, Math.max(GROUP_COLUMNS_MIN, Math.round(value)))
}
