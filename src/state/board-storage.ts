import { loadDoc, saveDoc } from '../core/storage/persistent.ts'
import type { BoardLoadResult } from '../core/storage/persistent.ts'
import type { BoardDoc } from '../core/storage/types.ts'

/**
 * 初始状态：从 localStorage 读取（含校验、迁移与回退）。
 *
 * 回退时会带上失败原因（`failure`），由 board store 转给页面上的提示条 ——
 * 这里只负责搬运，不做任何提示或 UI 判断。
 */
export function loadInitialDoc(): BoardLoadResult {
  return loadDoc()
}

export type PersistOutcome = { ok: true } | { ok: false; reason: string }

/** 写盘。失败时把原因交给调用方提示用户。 */
export function persistDoc(doc: BoardDoc): PersistOutcome {
  return saveDoc(doc)
}
