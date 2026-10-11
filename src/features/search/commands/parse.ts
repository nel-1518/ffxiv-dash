/**
 * 斜杠命令解析（纯函数）。
 *
 * 匹配规则：关键词以 `/` 开头，跟着命令名（不含空白或斜杠），**再接至少一个空白**，
 * 空白之后是查询串。因此 `/t`（还没敲空格）不算命中，会退回普通链接搜索 ——
 * 这也顺带让「删掉空格」成为退出命令模式的自然操作。
 *
 * 例：`/t 1000` → { command: taxCommand, query: '1000' }；`/i 火之碎晶` → itemCommand。
 */

import { COMMANDS } from './index.ts'
import type { SlashCommand } from './types.ts'

export type ParsedCommand = {
  command: SlashCommand
  /** 命令前缀之后的查询串（`/t 1000` → `'1000'`）。 */
  query: string
}

/** `/命令` + 至少一个空白 + 剩余部分。允许关键词前面有无意的空白（粘贴场景）。 */
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
