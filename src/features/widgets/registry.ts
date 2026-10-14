import { memo } from 'react'
import { setWidgetConfigNormalizer } from '../../core/storage/persistent.ts'
import type { WidgetSpec } from './types.ts'

/**
 * 组件注册表。这一层刻意不导入任何具体组件，避免 types -> registry -> builtins -> types
 * 的循环依赖；装配由 builtins/index.ts 的 installBuiltinWidgets() 完成。
 */
const registry = new Map<string, WidgetSpec>()

export function registerWidget<C>(spec: WidgetSpec<C>): void {
  if (registry.has(spec.key)) {
    console.warn(`[ffxiv-dash] 组件 key "${spec.key}" 已存在，将被覆盖`)
  }
  /*
   * 统一给 `Render` 套 memo，**在注册时做一次**而不是各组件自加：
   * 每个 builtin 自动生效，且类型新建不在渲染期（那会让子树反复挂载）。
   * 典型收益：切编辑模式整块看板重渲染时，同一 `item` 对象下 `Render` 直接跳过，
   * 请求、时钟订阅、antd 控件不必白跑。⚠️ 前提是传入的 `config` 引用稳定（见 `WidgetRenderer`）。
   */
  const stored = { ...spec, Render: memo(spec.Render) } as unknown as WidgetSpec
  // 注册表以 unknown 键存放：取值方通过 getWidget 拿到泛型已擦除的规格
  registry.set(spec.key, stored)
}

export function getWidget(key: string): WidgetSpec | undefined {
  return registry.get(key)
}

export function listWidgets(): WidgetSpec[] {
  return [...registry.values()]
}

/**
 * 把注册表的归一化能力注入 core 层。
 * core/storage 读取本地数据时要补齐配置缺省字段，但不能反向依赖 feature 层（循环），
 * 故运行时注入纯函数；未注册的组件返回 null，storage 保留原始配置、界面用降级卡提示。
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
