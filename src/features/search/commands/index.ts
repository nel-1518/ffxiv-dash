/**
 * 斜杠命令注册表。
 *
 * 新增命令：写好一个 `SlashCommand` 模块后，在下面的数组里追加一项即可 ——
 * 弹窗与状态中枢都不需要改动（它们只按「行类型」渲染）。
 */

import { itemCommand } from './item.ts'
import { taxCommand } from './tax.ts'
import type { SlashCommand } from './types.ts'

export const COMMANDS: SlashCommand[] = [
  itemCommand,
  taxCommand,
]
