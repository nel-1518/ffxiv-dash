/**
 * 备份文件：导出 / 导入的**唯一形状**（纯逻辑，无 React、无 DOM）。
 *
 * 为什么单独一层：看板数据、跳转设置、搜索引擎、外观偏好各自住在自己的 localStorage 键里
 * （后三者还各自带归一化逻辑），而"一份文件带走全部、一份文件恢复全部"这件事不属于
 * 其中任何一个 store —— 于是把它收在这里。位置落在 core：四段数据都在 core 层，
 * 不反向依赖 feature。
 *
 * 文件形状（四段）：
 * - `board`      看板文档，走与读盘同一套校验（`parseBoardDocValue`）；
 * - `autoOpen`   自动跳转的链接原文（`lastOpenedOn` 是当日记账，不进文件）；
 * - `searchEngines` 搜索引擎清单；
 * - `appearance` 外观偏好（色调模式 / 两个槽位 / 逐主题档案）。导出是**全量**的（连上传图的
 *   文件名与大小也写进去；图片本体在 IndexedDB、永远不进文件），但**导入只吃一部分** ——
 *   色调与两个槽位照搬，逐主题只搬模糊 / 亮度 / 卡片参数，背景来源与本机图片保持导入方现状
 *   （见 `core/appearance/store.ts` 的 `importAppearance`）。
 *
 * ⚠️ **不兼容旧导出文件**（本次改动明确不考虑兼容）：早期导出的"裸 BoardDoc"
 * 没有 `board` 这一段，`parseBackup` 一律拒掉。
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
 * 导出：把四段数据拼成一份 JSON 文本。
 *
 * ⚠️ 外观**逐字段取**而不是直接把快照塞进去：快照里还挂着 `systemScheme`（系统色调）
 * 与 `imageUrls`（上传图的 object URL）两个运行期字段 —— 它们跟着机器走，
 * 写进文件只会在导入方留下垃圾字段。
 */
export function serializeBackup(doc: BoardDoc): string {
  const { colorMode, lightTheme, darkTheme, profiles } = getAppearance()

  const file: BackupFile = {
    board: doc,
    autoOpen: { links: getAutoOpenLinks() },
    searchEngines: [...getSearchEngines()],
    appearance: { colorMode, lightTheme, darkTheme, profiles },
  }

  return JSON.stringify(file, null, 2)
}

/**
 * 导入：把备份文件的文本解析成四段数据。
 *
 * 校验分两档，与"解析不出来就不动现有数据"的约定一致：
 * - **整体拒绝**（返回 `null`）：不是合法 JSON，或者看板那一段认不出来 ——
 *   文件坏了、或者压根不是我们的备份文件时，一点现有数据都不该动；
 * - **逐段回落默认**：三个设置段各自走对应 store 的归一化，缺失 / 手改坏的部分
 *   按默认值处理。设置是锦上添花，不该因为其中一段坏掉就拒绝整份备份。
 */
export function parseBackup(text: string): BackupFile | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    console.warn('[ffxiv-dash] 备份文件不是合法 JSON', error)
    return null
  }

  if (!isRecord(parsed)) {
    return null
  }

  const board = parseBoardDocValue(parsed.board)
  if (!board) {
    return null
  }

  return {
    board,
    autoOpen: { links: normalizeAutoOpenLinks(parsed.autoOpen) },
    searchEngines: normalizeSearchEngines(parsed.searchEngines),
    appearance: normalizeAppearance(parsed.appearance),
  }
}
