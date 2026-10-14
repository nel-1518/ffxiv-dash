import { loadInitialDoc } from './board-storage.ts'
import { boardReducer } from './board-reducer.ts'
import { splitIntoRows } from './group-rows.ts'
import type { BoardLoadFailure } from '../core/storage/persistent.ts'
import type { BoardDoc, Group, Item } from '../core/storage/types.ts'
import type { BoardAction, BoardActions } from './board-types.ts'
import type { GroupRow } from './group-rows.ts'

/**
 * 看板状态的唯一来源（纯逻辑，无 React）：模块级变量 + `Set<Listener>` + `subscribe` + 快照读取，
 * 与 `core/clock/store.ts`、`core/appearance/store.ts` 同一形状，消费侧走 `useSyncExternalStore`。
 * ⚠️ 细粒度订阅的前提（docs/development.md 引用）：**内容不变就复用旧引用**——各 read 系快照函数
 * 在数据未变时必须返回同一引用，否则 `Object.is` 判变、订阅组件全部重渲染。
 */

type Listener = () => void

const listeners = new Set<Listener>()

/**
 * ⚠️ 必须惰性初始化，不能在模块顶层读盘：ESM 的 import 先全部求值完才执行 `main.tsx` 的
 * `installBuiltinWidgets()` 语句，顶层读盘时组件注册表还是空的、config 不会归一化；首次读盘只能发生在首次渲染。
 */
let doc: BoardDoc | undefined

/**
 * 首次读盘是否回退了默认数据（及原因）。只由 `getDoc()` 首次读盘写入、只由 `clearBootFailure()` 清除
 * ——字符串 / null 正好是 `useSyncExternalStore` 按 `Object.is` 比对所需的稳定值。
 */
let bootFailure: BoardLoadFailure | null = null

function getDoc(): BoardDoc {
  if (doc === undefined) {
    const loaded = loadInitialDoc()
    doc = loaded.doc
    bootFailure = loaded.failure
  }
  return doc
}

/** 结构快照（分组 id 序列）与行快照，见 `rebuildStructure`。 */
let cachedGroupIds: string[] = []
let cachedGroupRows: GroupRow[] = []

/**
 * 维护两份「结构快照」：分组 id 序列、按行切开的分组结构。
 * ⚠️ 细粒度订阅的命门：结构没变就必须复用原来的数组引用——`useSyncExternalStore` 按 `Object.is`
 * 比快照，每次返回新数组等于宣告「变了」，细粒度订阅全部失效且无任何报错。
 * 只比 id 序列是安全的：行结构 = f(id 顺序， 各分组类型)，类型创建后不可修改
 * （`board-reducer` 的 `updateGroup` 刻意不收 groupType）。
 */
function rebuildStructure(): void {
  const groups = getDoc().groups
  if (groups.length === cachedGroupIds.length) {
    let same = true
    for (let index = 0; index < groups.length; index += 1) {
      if (groups[index].id !== cachedGroupIds[index]) {
        same = false
        break
      }
    }
    // 结构未变：两份缓存继续复用，订阅者不会被唤醒
    if (same) {
      return
    }
  }

  cachedGroupIds = groups.map((group) => group.id)
  cachedGroupRows = splitIntoRows(groups)
}

/** 订阅任意变更；返回退订函数。 */
export function subscribeBoard(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 当前整份文档。⚠️ 只在确实需要全文时用（导出、统计项数），卡片里不要用。 */
export function readBoardDoc(): BoardDoc {
  return getDoc()
}

/** 首次读盘是否失败（及原因），供提示条订阅；先走一遍 `getDoc()`——提示条可能比看板更早渲染，不能指望读盘一定发生在它之前。 */
export function readBootFailure(): BoardLoadFailure | null {
  getDoc()
  return bootFailure
}

/**
 * 清掉「读盘失败」。由落盘闸门在**写盘成功**时调用：那一刻本机存的就是当前这份看板，
 * 坏数据已被覆盖，提示没有理由继续挂着（localStorage 不可用时写盘也不会成功，提示自然留着）。
 */
export function clearBootFailure(): void {
  if (bootFailure === null) {
    return
  }
  bootFailure = null
  for (const listener of listeners) {
    listener()
  }
}

/** 分组 id 序列。结构未变时返回同一个数组引用。 */
export function readGroupIds(): string[] {
  rebuildStructure()
  return cachedGroupIds
}

/** 按行切开的分组结构。结构未变时返回同一个数组引用。 */
export function readGroupRows(): GroupRow[] {
  rebuildStructure()
  return cachedGroupRows
}

/** 单个分组；该分组未变时返回同一个对象引用。 */
export function readGroup(groupId: string): Group | undefined {
  return getDoc().groups.find((group) => group.id === groupId)
}

/** 单个卡片（跨分组按 id 反查）；该卡片未变时返回同一个对象引用。 */
export function readItem(itemId: string): Item | undefined {
  for (const group of getDoc().groups) {
    const found = group.items.find((item) => item.id === itemId)
    if (found) {
      return found
    }
  }
  return undefined
}

/** 卡片所属分组的 id。拖拽落位时用来反推来源分组。 */
export function readGroupIdOfItem(itemId: string): string | undefined {
  return getDoc().groups.find((group) => group.items.some((item) => item.id === itemId))?.id
}

/** 分组标题。删除确认弹窗要在**点击那一刻**读，不能提前闭包捕获。 */
export function readGroupTitle(groupId: string): string {
  return readGroup(groupId)?.title ?? ''
}

/**
 * 派发一个操作。reducer 未命中目标时返回原引用（如 patch 的 itemId 不存在），
 * 这时直接返回、不通知订阅者——否则会白跑一遍所有组件的快照比较。
 */
export function dispatchBoard(action: BoardAction): void {
  const current = getDoc()
  const next = boardReducer(current, action)
  if (next === current) {
    return
  }
  doc = next
  for (const listener of listeners) {
    listener()
  }
}

/**
 * 语义化操作集合——模块级常量，引用永远不变。
 * 只派发不订阅的组件直接 import 即可：读取都发生在调用那一刻（见各 `read*`），不会捕获过期的 doc。
 */
export const boardActions: BoardActions = {
  addGroup: (title, groupType, columns) => dispatchBoard({ type: 'addGroup', title, groupType, columns }),
  updateGroup: (groupId, title, columns) => dispatchBoard({ type: 'updateGroup', groupId, title, columns }),
  removeGroup: (groupId) => dispatchBoard({ type: 'removeGroup', groupId }),
  reorderGroups: (orderedIds) => dispatchBoard({ type: 'reorderGroups', orderedIds }),
  addItem: (groupId, item) => dispatchBoard({ type: 'addItem', groupId, item }),
  updateItem: (groupId, item) => dispatchBoard({ type: 'updateItem', groupId, item }),
  updateItemConfig: (itemId, patch) => dispatchBoard({ type: 'updateItemConfig', itemId, patch }),
  removeItem: (groupId, itemId) => dispatchBoard({ type: 'removeItem', groupId, itemId }),
  reorderItems: (groupId, orderedIds) => dispatchBoard({ type: 'reorderItems', groupId, orderedIds }),
  moveItemToGroup: (itemId, sourceGroupId, targetGroupId, overItemId) =>
    dispatchBoard({ type: 'moveItemToGroup', itemId, sourceGroupId, targetGroupId, overItemId }),
  replaceDoc: (next) => dispatchBoard({ type: 'replaceDoc', doc: next }),
}
