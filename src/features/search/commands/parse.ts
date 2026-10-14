/** 斜杠命令解析（纯函数）：`/` + 命令名 + 至少一个空白 + 查询串；`/t`（未敲空格）不命中、
 *  退回链接搜索，删空格因此也是退出命令模式的自然操作。例：`/t 1000` → taxCommand。 */

import { COMMANDS } from './index.ts'
import type { SlashCommand } from './types.ts'

export type ParsedCommand = {
  command: SlashCommand
  /** 命令前缀之后的查询串（`/t 1000` → `'1000'`）。 */
  query: string
}

/** `/命令` + 至少一个空白 + 剩余部分；允许关键词前面有无意的空白（粘贴场景）。 */
const COMMAND_PATTERN = /^\s*\/([^\s/]+)\s+(.*)$/s

export function parseCommand(keyword: string): ParsedCommand | null {
  const match = COMMAND_PATTERN.exec(keyword)
  if (!match) {
    return null
  }
  const token = match[1].toLowerCase()
  const command = COMMANDS.find((candidate) => candidate.key.toLowerCase() === token)
  if (!command) {
    return null
  }
  return { command, query: match[2] }
}
