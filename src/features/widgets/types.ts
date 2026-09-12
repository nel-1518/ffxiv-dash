import type { ComponentType } from 'react'
import type { WidgetItem } from '../../core/storage/types.ts'

/** Render 收到的 props（config 已由 spec 归一化）。 */
export type WidgetRenderProps<C> = {
  config: C
  /** 完整条目，供需要写回自己配置的组件取 id。 */
  item: WidgetItem
}

/**
 * 组件需要写回自己的配置时（如统计卡的 +1），直接用 state 层的
 * `useBoardActions().updateItemConfig(item.id, patch)` 就地落库，
 * 不必再从卡片外层透传回调下来。
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
