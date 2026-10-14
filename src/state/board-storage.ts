import { loadDoc, saveDoc } from '../core/storage/persistent.ts'
import type { BoardLoadResult } from '../core/storage/persistent.ts'
import type { BoardDoc } from '../core/storage/types.ts'

/** 初始状态：读 localStorage（含校验、迁移与回退）；失败原因随 `failure` 带回，由 store 转给提示条，此处不做任何 UI 判断。 */
export function loadInitialDoc(): BoardLoadResult {
  return loadDoc()
}

export type PersistOutcome = { ok: true } | { ok: false; reason: string }

/** 写盘。失败时把原因交给调用方提示用户。 */
export function persistDoc(doc: BoardDoc): PersistOutcome {
  return saveDoc(doc)
}
