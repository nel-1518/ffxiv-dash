import { loadDoc, saveDoc } from '../core/storage/persistent.ts'
import type { BoardDoc } from '../core/storage/types.ts'

/** 初始状态：从 localStorage 读取（含校验、迁移与回退）。 */
export function loadInitialDoc(): BoardDoc {
  return loadDoc()
}

export type PersistOutcome = { ok: true } | { ok: false; reason: string }

/** 写盘。失败时把原因交给调用方提示用户。 */
export function persistDoc(doc: BoardDoc): PersistOutcome {
  return saveDoc(doc)
}
