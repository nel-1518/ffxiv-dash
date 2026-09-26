/**
 * 极光预报组件的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * 该组件没有可配置项：极光窗口完全由游戏天气规则推算（区域固定为
 * 库尔札斯西部高地与旧萨雷安两地并列展示），因此配置体是恒定的空对象。
 * 保留这个模块是为了与其他组件的文件结构一致（widget.ts 的 spec 需要这三个导出）。
 */
export type AuroraConfig = Record<string, never>

export const AURORA_DEFAULT_CONFIG: AuroraConfig = {}

/** 无论输入什么都归一化成空配置 —— 没有字段就没有脏数据可言。 */
export function normalizeAuroraConfig(_raw: unknown): AuroraConfig {
  return {}
}
