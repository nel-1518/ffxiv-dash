import { installWidgetConfigNormalizer, registerWidget } from '../registry.ts'
import { activityCalendarWidgetSpec } from './activity-calendar-widget/widget.ts'
import { auroraWidgetSpec } from './aurora-widget/widget.ts'
import { countdownWidgetSpec } from './countdown-widget/widget.ts'
import { exchangeWidgetSpec } from './exchange-widget/widget.ts'
import { goldTrialWidgetSpec } from './gold-trial-widget/widget.ts'
import { houseWidgetSpec } from './house-widget/widget.ts'
import { marketWidgetSpec } from './market-widget/widget.ts'
import { memoWidgetSpec } from './memo-widget/widget.ts'
import { newsWidgetSpec } from './news-widget/widget.ts'
import { restWidgetSpec } from './pomodoro-widget/widget.ts'
import { pvpMapWidgetSpec } from './pvp-map-widget/widget.ts'
import { rollWidgetSpec } from './roll-widget/widget.ts'
import { statsWidgetSpec } from './stats-widget/widget.ts'
import { taxWidgetSpec } from './tax-widget/widget.ts'
import { todoWidgetSpec } from './todo-widget/widget.ts'

/**
 * 内置组件装配入口，应用启动时调用一次。
 * 新增组件：建 `builtins/<name>-widget/` 目录（`config.ts` 配置类型+默认值+归一化、
 * `fields.tsx` 表单字段+渲染组件、`widget.ts` 用 defineWidget 组装导出；纯计算/常量表可再开
 * 一个无 React 模块），在下方列表追加一项即可，自动进选择器与配置区，不改任何既有组件。
 */
export function installBuiltinWidgets(): void {
  registerWidget(pvpMapWidgetSpec)
  registerWidget(marketWidgetSpec)
  registerWidget(taxWidgetSpec)
  registerWidget(houseWidgetSpec)
  registerWidget(newsWidgetSpec)
  registerWidget(goldTrialWidgetSpec)
  registerWidget(activityCalendarWidgetSpec)
  registerWidget(todoWidgetSpec)
  registerWidget(statsWidgetSpec)
  registerWidget(memoWidgetSpec)
  registerWidget(restWidgetSpec)
  registerWidget(countdownWidgetSpec)
  registerWidget(rollWidgetSpec)
  registerWidget(auroraWidgetSpec)
  registerWidget(exchangeWidgetSpec)

  // 把组件配置的归一化能力注入 core/storage，供读取本地数据时使用
  installWidgetConfigNormalizer()
}
