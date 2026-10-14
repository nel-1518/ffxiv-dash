/** 斜杠命令注册表：新增命令写好 SlashCommand 模块后在此数组追加一项即可，弹窗与状态中枢零改动。 */

import { itemCommand } from './item.ts'
import { taxCommand } from './tax.ts'
import type { SlashCommand } from './types.ts'

export const COMMANDS: SlashCommand[] = [
  itemCommand,
  taxCommand,
]
