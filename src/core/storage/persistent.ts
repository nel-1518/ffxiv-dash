import { timestampForFileName } from '../download-file.ts'
import { createDefaultBoard } from './default-board.ts'
import { sanitizeBoardDoc } from './schema.ts'
import type { BoardDoc, WidgetConfigNormalizer } from './types.ts'

/** localStorage 落盘层。 */

const STORAGE_KEY = 'ffxiv-dash:board:v1'

/**
 * 组件配置归一化器由 widgets 层注入：core 不能在模块顶层依赖 feature 层（会循环依赖），改为运行时装一次。
 */
let normalizeWidgetConfig: WidgetConfigNormalizer = () => null

export function setWidgetConfigNormalizer(normalizer: WidgetConfigNormalizer): void {
  normalizeWidgetConfig = normalizer
}

/**
 * 读盘失败的原因。分档让界面能说人话（「什么坏了、现在是什么状态」），而不是只给一份没交代的默认数据。
 */
export type BoardLoadFailure =
  /** localStorage 读不出来：隐私模式 / 站点权限被禁。 */
  | 'storage'
  /** 存着的东西不是合法 JSON：被截断、被手改。 */
  | 'json'
  /** 结构认不出来：版本号对不上、字段缺失。 */
  | 'schema'

export type BoardLoadResult = {
  doc: BoardDoc
  /** `null` = 正常（读到并校验通过，或者压根没存过 = 首次进入）。 */
  failure: BoardLoadFailure | null
}

/**
 * 读取并校验落盘数据；任何异常都回退默认数据，保证界面永远可用。
 * ⚠️ 失败原因一并返回而不吞进控制台：调用方要在页面说明发生了什么，并引到「设置 → 数据管理」（`features/dashboard/BoardLoadAlert.tsx`）。
 * ⚠️ 回退时不写盘：坏数据留在原地，等用户导出原文 / 导入备份 / 恢复默认时才覆盖；
 * 因此「读取失败」只要成功写盘过一次就不再成立（见 `state/board-persistence.tsx`）。
 */
export function loadDoc(): BoardLoadResult {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取 localStorage，使用默认数据', error)
    return { doc: createDefaultBoard(), failure: 'storage' }
  }

  if (!raw) {
    return { doc: createDefaultBoard(), failure: null }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.warn('[ffxiv-dash] 本地数据不是合法 JSON，已回退默认数据', error)
    return { doc: createDefaultBoard(), failure: 'json' }
  }

  const { doc, normalized } = sanitizeBoardDoc(parsed, normalizeWidgetConfig)

  if (!doc) {
    console.warn('[ffxiv-dash] 本地数据结构无法识别，已回退默认数据。原始值：', parsed)
    return { doc: createDefaultBoard(), failure: 'schema' }
  }

  if (normalized) {
    // 补齐 / 丢弃过字段，顺手回写一次，避免每次都重新归一化
    const result = saveDoc(doc)
    if (!result.ok) {
      console.warn('[ffxiv-dash] 数据未能回写：', result.reason)
    }
  }

  return { doc, failure: null }
}

/**
 * 「导出看板原始数据」的文件名。提示条与数据管理共用一份：
 * 同一份数据、同一个按钮名，导出就该是同一个文件名，用户才不必自己对是不是同一回事。
 */
export function rawBoardFileName(now: Date): string {
  return `ffxiv-dash-board-raw-${timestampForFileName(now)}.txt`
}

/**
 * 本机当前存着的看板原文（一字不改）；读不出或没存过返回 `null`。
 * 与 `loadDoc` 的区别是不做任何校验与回退——用户点「导出看板原始数据」要的就是那份东西本身，
 * 数据坏了、结构看不懂时才更需要拿去排查 / 抢救。
 */
export function readStoredBoardText(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取看板原始数据', error)
    return null
  }
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
 * 导入用：把已 `JSON.parse` 过的值校验成看板文档。与 `loadDoc` 走同一套校验（连带复用注入的归一化器）；
 * 返回 `null` = 结构无法识别（不是对象、没有 groups、版本号对不上）。
 * ⚠️ 收值而不收 JSON 文本：看板只是备份文件（`core/storage/backup.ts`）里的一段，文本解析由那一层统一做一次。
 */
export function parseBoardDocValue(raw: unknown): BoardDoc | null {
  return sanitizeBoardDoc(raw, normalizeWidgetConfig).doc
}
