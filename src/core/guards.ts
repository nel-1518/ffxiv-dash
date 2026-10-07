/**
 * 通用类型守卫。storage 的数据校验与 widgets 的配置归一化共用它。
 */

/** 把 unknown 收窄成普通对象（排除 null、数组与其他原始类型）。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
