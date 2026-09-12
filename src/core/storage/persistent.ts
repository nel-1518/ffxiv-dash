import { createDefaultBoard } from './default-board.ts'
import { sanitizeBoardDoc } from './schema.ts'
import type { BoardDoc, WidgetConfigNormalizer } from './types.ts'

/** localStorage 落盘层。 */

const STORAGE_KEY = 'ffxiv-dash:board:v1'

/**
 * 组件配置归一化器由 widgets 层注入。
 * core 层不能在模块顶层依赖 feature 层（会产生循环依赖），
 * 因此改为运行时装一次。
 */
let normalizeWidgetConfig: WidgetConfigNormalizer = () => null

export function setWidgetConfigNormalizer(normalizer: WidgetConfigNormalizer): void {
  normalizeWidgetConfig = normalizer
}

/** 读取并校验落盘数据；任何异常都回退到默认数据，保证界面永远可用。 */
export function loadDoc(): BoardDoc {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取 localStorage，使用默认数据', error)
    return createDefaultBoard()
  }

  if (!raw) {
    return createDefaultBoard()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.warn('[ffxiv-dash] 本地数据不是合法 JSON，已回退默认数据', error)
    return createDefaultBoard()
  }

  const { doc, normalized } = sanitizeBoardDoc(parsed, normalizeWidgetConfig)

  if (!doc) {
    console.warn('[ffxiv-dash] 本地数据结构无法识别，已回退默认数据。原始值：', parsed)
    return createDefaultBoard()
  }

  if (normalized) {
    // 补齐 / 丢弃过字段，顺手回写一次，避免每次都重新归一化
    const result = saveDoc(doc)
    if (!result.ok) {
      console.warn('[ffxiv-dash] 归一化后的数据未能回写：', result.reason)
    }
  }

  return doc
}

export type SaveResult = { ok: true } | { ok: false; reason: string }

/** 写入落盘数据。配额超限或隐私模式下返回失败，由调用方提示用户。 */
export function saveDoc(doc: BoardDoc): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
    return { ok: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, reason }
  }
}

/**
 * 导出用：产出与落盘完全相同的 BoardDoc 结构。
 */
export function serializeBoardDoc(doc: BoardDoc): string {
  return JSON.stringify(doc, null, 2)
}

/**
 * 导入用：把外部 JSON 文本解析成看板文档。
 *
 * 走的是与 `loadDoc` 相同的校验与迁移路径。
 * 返回 `null` 表示结构无法识别（不是对象、没有 groups、版本号对不上等）。
 */
export function parseBoardDoc(text: string): BoardDoc | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  return sanitizeBoardDoc(parsed, normalizeWidgetConfig).doc
}
