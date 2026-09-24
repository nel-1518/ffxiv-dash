import { createId } from '../ids.ts'
import { isRecord } from '../guards.ts'
import { canPlaceItem } from '../group-rules.ts'
import { GROUP_TYPES, ITEM_KINDS, LINK_ABBREVIATION_PATTERN, MAX_LINK_ABBREVIATION_LENGTH, clampGroupColumns } from './types.ts'
import type {
  BoardDoc,
  Group,
  GroupType,
  Item,
  ItemKind,
  LinkItem,
  WidgetConfigNormalizer,
  WidgetItem,
} from './types.ts'

/**
 * 当前数据结构版本；未上线期间发生破坏性改动时直接重置旧数据。
 */
export const SCHEMA_VERSION = 4

const MAX_TEXT_LENGTH = 500
const MAX_URL_LENGTH = 2048
const MAX_ITEMS_PER_GROUP = 500

function asString(value: unknown, fallback = '', maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string') {
    return fallback
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function asOptionalString(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

function asGroupType(value: unknown): GroupType {
  return GROUP_TYPES.includes(value as GroupType) ? (value as GroupType) : 'widget'
}

function asItemKind(value: unknown): ItemKind {
  return ITEM_KINDS.includes(value as ItemKind) ? (value as ItemKind) : 'link'
}

function asId(value: unknown): string {
  const text = asString(value, '', 128).trim()
  return text || createId()
}

/**
 * 链接缩写：只接受纯 ASCII 字母数字，且不超过上限。
 *
 * ⚠️ 刻意**不做任何自动处理** —— 不 trim（用户输入里的空格/符号就是非法）、
 * 不改大小写、不截断：整体不匹配就当成"没设"（返回 undefined）。
 * 表单已用同一份规则拦在提交前，这里是存档被手改时的兜底。
 */
function asAbbreviation(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '' || value.length > MAX_LINK_ABBREVIATION_LENGTH) {
    return undefined
  }
  return LINK_ABBREVIATION_PATTERN.test(value) ? value : undefined
}

function sanitizeLinkItem(raw: Record<string, unknown>): LinkItem {
  const name = asString(raw.name, '未命名网站').trim() || '未命名网站'
  const url = asString(raw.url, '', MAX_URL_LENGTH).trim() || 'https://example.com'
  return {
    id: asId(raw.id),
    kind: 'link',
    name,
    url,
    desc: asOptionalString(raw.desc),
    // 图标既可能是缩写文字，也可能是图片地址，统一按 URL 的上限收
    icon: asOptionalString(raw.icon, MAX_URL_LENGTH),
    abbreviation: asAbbreviation(raw.abbreviation),
  }
}

function sanitizeWidgetItem(raw: Record<string, unknown>, normalize: WidgetConfigNormalizer): WidgetItem {
  const widget = asString(raw.widget, '', 64).trim() || 'unknown'
  const normalizedConfig = normalize(widget, raw.config)
  return {
    id: asId(raw.id),
    kind: 'widget',
    widget,
    title: asString(raw.title, '自定义组件').trim() || '自定义组件',
    config: normalizedConfig ?? (isRecord(raw.config) ? raw.config : {}),
  }
}

function sanitizeItem(value: unknown, normalize: WidgetConfigNormalizer): Item | null {
  if (!isRecord(value)) {
    return null
  }
  const kind = asItemKind(value.kind)
  if (kind === 'widget') {
    return sanitizeWidgetItem(value, normalize)
  }
  // 没有 url 也没有 name 的残缺数据直接丢弃
  if (value.url === undefined && value.name === undefined) {
    return null
  }
  return sanitizeLinkItem(value)
}

function sanitizeGroup(value: unknown, normalize: WidgetConfigNormalizer): Group | null {
  if (!isRecord(value)) {
    return null
  }
  const type = asGroupType(value.type)
  const rawItems = Array.isArray(value.items) ? value.items : []
  const items = rawItems
    .slice(0, MAX_ITEMS_PER_GROUP)
    .map((item) => sanitizeItem(item, normalize))
    .filter((item): item is Item => item !== null && canPlaceItem(type, item.kind))

  return {
    id: asId(value.id),
    title: asString(value.title, '未命名项目').trim() || '未命名项目',
    type,
    // 列数是后加的字段：老数据缺省时补齐为该类型的默认值，越界值收敛到 1-6
    columns: clampGroupColumns(value.columns, type),
    items,
  }
}

/**
 * 校验并归一化一份 BoardDoc。
 *
 * 返回值：
 * - `doc` 为 null 表示输入不属于可恢复的范围（上层应回退默认数据）。
 * - `normalized` 为 true 表示与输入不一致（丢弃或补齐过字段），值得回写一次。
 */
export function sanitizeBoardDoc(
  input: unknown,
  normalize: WidgetConfigNormalizer,
): { doc: BoardDoc | null; normalized: boolean } {
  if (!isRecord(input)) {
    return { doc: null, normalized: false }
  }
  if (!Array.isArray(input.groups)) {
    return { doc: null, normalized: false }
  }

  const rawGroups = Array.isArray(input.groups) ? input.groups : []
  const rawVersion = typeof input.version === 'number' && input.version >= 0 ? input.version : 0
  if (rawVersion !== SCHEMA_VERSION) {
    return { doc: null, normalized: false }
  }

  const groups = rawGroups
    .map((group) => sanitizeGroup(group, normalize))
    .filter((group): group is Group => group !== null)

  const doc: BoardDoc = { version: SCHEMA_VERSION, groups }

  // 只要项数变了就说明丢弃过非法数据，值得回写
  const inputItemCount = rawGroups.reduce<number>(
    (total, group) => total + (isRecord(group) && Array.isArray(group.items) ? group.items.length : 0),
    0,
  )
  const outputItemCount = groups.reduce((total, group) => total + group.items.length, 0)
  // 老数据没有 columns 字段，补齐后回写一次，避免每次打开都要重新补
  const columnsBackfilled = rawGroups.some(
    (group) => isRecord(group) && typeof group.columns !== 'number',
  )
  // 版本已经在函数开头比过了（不符早就 return），这里不再重复判断
  const normalized =
    groups.length !== rawGroups.length ||
    outputItemCount !== inputItemCount ||
    columnsBackfilled

  return { doc, normalized }
}
