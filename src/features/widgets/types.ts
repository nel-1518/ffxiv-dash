import type { ComponentType } from 'react'
import type { WidgetItem } from '../../core/storage/types.ts'

/** Render 收到的 props（config 已由 spec 归一化）。 */
export type WidgetRenderProps<C> = {
  config: C
  /** 完整条目，供需要写回自己配置的组件取 id。 */
  item: WidgetItem
}

/**
 * 组件需要写回自己的配置时（如进度卡的 +1），直接从 `state/board-store.ts`
 * import 模块级常量 `boardActions`，调 `boardActions.updateItemConfig(item.id, patch)` 就地落库。
 *
 * ⚠️ 不要用任何订阅 hook 去拿它：`boardActions` 的引用永远不变，也不订阅看板数据，
 * 因此组件改自己的值时不会因为"读了看板"而被其他改动带着重渲染。
 */

/**
 * 组件规格。
 *
 * 新增一个组件类型 = 新建一个文件，导出一个 WidgetSpec 并注册，
 * 不需要改动任何既有组件，也不需要新增依赖。
 */
export type WidgetSpec<C = Record<string, unknown>> = {
  /** 唯一 key，会写进用户数据里，一旦发布不要再改。 */
  key: string
  /** 类型选择器里显示的名称。 */
  label: string
  /** 用途介绍：在编辑弹窗选定该类型后展示给用户看，说明这个组件能做什么。 */
  description: string
  /** 新建时的默认标题。 */
  defaultTitle: string
  /** 新建项目时的默认配置。 */
  defaultConfig: C
  /** 校验并归一化配置：补默认值、修正类型、兼容旧数据。 */
  normalizeConfig: (raw: unknown) => C
  /**
   * 配置表单字段。渲染 Form.Item，name 使用 ['config', ...] 路径，
   * 因此它就是一个普通的无状态组件，不需要自己管理值。
   */
  FormFields: ComponentType
  /** 卡片内容渲染。 */
  Render: ComponentType<WidgetRenderProps<C>>
  /**
   * 该类型在**整块看板**上允许的最大实例数（跨所有分组的全局计数）。
   * 缺省用 `DEFAULT_WIDGET_MAX_COUNT`；设 0 表示禁止添加新实例。
   * 达到上限时：项目表单的类型选项被禁用，reducer 拒绝落库（见 `board-reducer.ts`）。
   */
  maxCount?: number
}

/**
 * 实例上限的兜底默认值。
 * 上限由**每个组件在自己的 spec 里单独声明**（`maxCount`），这里只给未声明者兜底，
 * 避免新组件忘了写时无限放开。
 */
export const DEFAULT_WIDGET_MAX_COUNT = 20

/** 组件类型的实例上限：spec 未声明 `maxCount` 时取默认值。 */
export function maxCountOf(maxCount: number | undefined): number {
  return maxCount ?? DEFAULT_WIDGET_MAX_COUNT
}

/**
 * 定义组件规格的辅助函数。
 *
 * 存在的意义：强制把「类型 + 默认值 + 归一化」放在同一个模块里声明，
 * 组件渲染放另一个模块，从而既保证类型自洽，
 * 又满足 react-refresh 的"一个文件只导出组件"约束。
 */
export function defineWidget<C>(spec: WidgetSpec<C>): WidgetSpec<C> {
  return spec
}
