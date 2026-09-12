/**
 * 通用类型守卫。
 *
 * 放在 core 根目录：storage 的数据校验与 widgets 的配置归一化都要判断
 * "这是不是一个普通对象"，之前两边各抄了一份，集中在这里避免再抄第三份。
 */

/** 把 unknown 收窄成普通对象（排除 null、数组与其他原始类型）。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
