import { setWidgetConfigNormalizer } from '../../core/storage/persistent.ts'
import type { WidgetSpec } from './types.ts'

/**
 * 组件注册表。
 *
 * 这一层刻意不导入任何具体组件，避免 types -> registry -> builtins -> types
 * 的循环依赖；装配由 builtins/index.ts 的 installBuiltinWidgets() 完成。
 */
const registry = new Map<string, WidgetSpec>()

export function registerWidget<C>(spec: WidgetSpec<C>): void {
  if (registry.has(spec.key)) {
    console.warn(`[ffxiv-dash] 组件 key "${spec.key}" 已存在，将被覆盖`)
  }
  // 注册表以 unknown 键存放：取值方通过 getWidget 拿到泛型已擦除的规格
  registry.set(spec.key, spec as unknown as WidgetSpec)
}

export function getWidget(key: string): WidgetSpec | undefined {
  return registry.get(key)
}

export function listWidgets(): WidgetSpec[] {
  return [...registry.values()]
}

/** 供 antd Select / Segmented 使用的选项。 */
export function listWidgetOptions(): { label: string; value: string }[] {
  return listWidgets().map((spec) => ({ label: spec.label, value: spec.key }))
}

/**
 * 把注册表的归一化能力注入 core 层。
 *
 * core/storage 需要在读取本地数据时补齐组件配置的缺省字段，但它不能反向
 * 依赖 feature 层（会形成循环），因此改成运行时注入一个纯函数。
 * 未注册的组件返回 null，由 storage 层保留原始配置，界面用降级卡提示。
 */
export function installWidgetConfigNormalizer(): void {
  setWidgetConfigNormalizer((widgetKey, raw) => {
    const spec = registry.get(widgetKey)
    if (!spec) {
      return null
    }
    return spec.normalizeConfig(raw) as Record<string, unknown>
  })
}
