import { installWidgetConfigNormalizer, registerWidget } from '../registry.ts'
import { countdownWidgetSpec } from './countdown-widget/widget.ts'
import { marketWidgetSpec } from './market-widget/widget.ts'
import { pvpMapWidgetSpec } from './pvp-map-widget/widget.ts'
import { statsWidgetSpec } from './stats-widget/widget.ts'

/**
 * 内置组件装配入口，在应用启动时调用一次。
 *
 * 新增一个组件类型只需要：
 * 1. 新建 `builtins/<name>-widget/` 目录，放三个文件：
 *    - `config.ts`  配置类型 + 默认值 + normalizeConfig（纯数据）
 *    - `fields.tsx` 只导出表单字段组件与渲染组件
 *    - `widget.ts`  用 defineWidget 组装并导出 spec
 *    （纯计算/常量表可以再单独开一个无 React 的模块，例如 pvp-map-widget 的 `rotation.ts`）
 * 2. 在下面的列表里追加一项。
 *
 * 之后它会自动出现在"组件类型"选择器与组件配置区，无需改动任何既有组件。
 */
export function installBuiltinWidgets(): void {
  registerWidget(statsWidgetSpec)
  registerWidget(pvpMapWidgetSpec)
  registerWidget(marketWidgetSpec)
  registerWidget(countdownWidgetSpec)

  // 把组件配置的归一化能力注入 core/storage，供读取本地数据时使用
  installWidgetConfigNormalizer()
}
