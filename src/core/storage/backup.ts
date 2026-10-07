/**
 * 备份文件：导出 / 导入的唯一形状（纯逻辑，无 React、无 DOM）。
 *
 * 为什么单独一层：看板数据、跳转设置、搜索引擎、外观偏好各自住在自己的 localStorage 键里，
 * "一份文件带走全部、一份文件恢复全部"不属于其中任何一个 store，收在这里（core 层，
 * 不反向依赖 feature）。
 *
 * 文件形状（四段）：
 * - `board`      看板文档，走与读盘同一套校验（`parseBoardDocValue`）；
 * - `autoOpen`   自动跳转的链接原文（`lastOpenedOn` 是当日记账，不进文件）；
 * - `searchEngines` 搜索引擎清单；
 * - `appearance` 外观偏好。导出是全量（连上传图的文件名与大小；图片本体在 IndexedDB、
 *   永远不进文件），导入只取一部分：色调与槽位照搬，逐主题只搬模糊 / 亮度 / 卡片参数，
 *   背景来源与本机图片保持导入方现状（见 `importAppearance`）。
 *
 * ⚠️ 不兼容早期导出的"裸 BoardDoc"文件：没有 `board` 这一段，`parseBackup` 一律拒掉。
 *
 * 同一份形状还兼职「导入前快照」：导入覆盖前先把当时的四段数据原样存一份
 * （`saveImportUndo`），设置里据此亮出「恢复导入前的数据」按钮。
 * 快照是一次性的：恢复或再次导入都会重写它。
 */
import { getAppearance, normalizeAppearance } from '../appearance/store.ts'
import type { AppearanceState } from '../appearance/store.ts'
import { getAutoOpenLinks, normalizeAutoOpenLinks } from '../auto-open/store.ts'
import { isRecord } from '../guards.ts'
import { getSearchEngines, normalizeSearchEngines } from '../search/store.ts'
import type { SearchEngineConfig } from '../search/store.ts'
import { parseBoardDocValue } from './persistent.ts'
import type { BoardDoc } from './types.ts'

/** 备份文件里四段数据的形状。 */
export type BackupFile = {
  /** 看板文档：分组、卡片与它们的位置。 */
  board: BoardDoc
  /** 自动跳转设置：只带用户填写的原文（每行一个链接）。 */
  autoOpen: { links: string }
  /** 搜索引擎清单（顺序即搜索弹窗里的顺序）。 */
  searchEngines: SearchEngineConfig[]
  /** 外观偏好：只带**落盘**的那部分（导出是全量，导入只取其中一部分，见文件头）。 */
  appearance: AppearanceState
}

/**
 * 把四段数据拼成一份备份文件对象。
 *
 * ⚠️ 外观逐字段取而不是直接塞快照：快照里挂着 `systemScheme` 与 `imageUrls` 两个运行期字段，
 * 写进文件只会在导入方留下垃圾字段。导出与「导入前快照」共用这一份。
 */
function buildBackup(doc: BoardDoc): BackupFile {
  const { colorMode, lightTheme, darkTheme, profiles } = getAppearance()

  return {
    board: doc,
    autoOpen: { links: getAutoOpenLinks() },
    searchEngines: [...getSearchEngines()],
    appearance: { colorMode, lightTheme, darkTheme, profiles },
  }
}

/** 导出：把四段数据拼成一份 JSON 文本。 */
export function serializeBackup(doc: BoardDoc): string {
  return JSON.stringify(buildBackup(doc), null, 2)
}

/**
 * 导入：把备份文件的文本解析成四段数据。校验分两档：
 * - 整体拒绝（返回 `null`）：不是合法 JSON，或看板段认不出来 —— 一点现有数据都不动；
 * - 逐段回落默认：三个设置段各自走对应 store 的归一化，缺失 / 手改坏的部分按默认值处理，
 *   不该因为其中一段坏掉就拒绝整份备份。
 */
export function parseBackup(text: string): BackupFile | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    console.warn('[ffxiv-dash] 备份文件不是合法 JSON', error)
    return null
  }
  return parseBackupValue(parsed)
}

/**
 * `parseBackup` 的按值版本。「导入前快照」也走同一套校验：
 * 快照存在 localStorage 里、同样可能被手改坏，恢复前必须过同样的关卡。
 */
function parseBackupValue(raw: unknown): BackupFile | null {
  if (!isRecord(raw)) {
    return null
  }

  const board = parseBoardDocValue(raw.board)
  if (!board) {
    return null
  }

  return {
    board,
    autoOpen: { links: normalizeAutoOpenLinks(raw.autoOpen) },
    searchEngines: normalizeSearchEngines(raw.searchEngines),
    appearance: normalizeAppearance(raw.appearance),
  }
}

/**
 * 「导入前快照」的落盘键。跟随设置键用 `ffxiv-dash:` 前缀（`-cache:` 那批是组件缓存）。
 * 备份文件本体不进 IndexedDB：这里只有几 KB 的 JSON，localStorage 足够。
 */
const IMPORT_UNDO_KEY = 'ffxiv-dash:import-undo:v1'

/** 一份导入前快照：四段数据 + 存下它的时刻。 */
export type ImportUndo = {
  /** 存快照的时刻（`Date.now()`，毫秒）。只用来在按钮旁展示，恢复不依赖它。 */
  savedAt: number
  file: BackupFile
}

/**
 * 导入覆盖前存一份快照。
 *
 * 失败（隐私模式 / 配额满）只告警并返回 false：撤销是锦上添花，不该因为它存不下
 * 就不让人导入 —— 调用方据此提示"没有恢复这一步"即可。
 */
export function saveImportUndo(doc: BoardDoc): boolean {
  const undo: ImportUndo = { savedAt: Date.now(), file: buildBackup(doc) }
  try {
    localStorage.setItem(IMPORT_UNDO_KEY, JSON.stringify(undo))
    return true
  } catch (error) {
    console.warn('[ffxiv-dash] 未能保存导入前的快照', error)
    return false
  }
}

/**
 * 读取导入前快照；没有、或被手改坏了都返回 `null`。
 * 坏数据顺手清掉：别让「恢复」按钮亮着却恢复不出来。
 */
export function loadImportUndo(): ImportUndo | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(IMPORT_UNDO_KEY)
  } catch {
    return null
  }
  if (!raw) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearImportUndo()
    return null
  }

  if (!isRecord(parsed)) {
    clearImportUndo()
    return null
  }

  const file = parseBackupValue(parsed.file)
  if (!file) {
    clearImportUndo()
    return null
  }

  const savedAt =
    typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0
  return { savedAt, file }
}

/** 清掉快照（恢复之后 / 读取到坏数据时）。 */
export function clearImportUndo(): void {
  try {
    localStorage.removeItem(IMPORT_UNDO_KEY)
  } catch {
    // 隐私模式下 removeItem 也可能抛：清不掉顶多按钮多亮一次，不值得打断谁
  }
}
