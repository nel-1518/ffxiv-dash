import { loadInitialDoc } from './board-storage.ts'
import { boardReducer } from './board-reducer.ts'
import { splitIntoRows } from './group-rows.ts'
import type { BoardDoc, Group, Item } from '../core/storage/types.ts'
import type { BoardAction, BoardActions } from './board-types.ts'
import type { GroupRow } from './group-rows.ts'

/**
 * 看板状态的**唯一来源**（纯逻辑，无 React）。
 *
 * 用模块级 store 而不是 context：context 的订阅粒度是整个 value，`doc` 一换引用所有消费者
 * 都要重渲染；store 让每个组件各自订阅自己那一小片，`useSyncExternalStore` 按 `Object.is`
 * 比快照，互不牵连。
 *
 * 与 `core/clock/store.ts`、`core/appearance/store.ts` 同一套形状：
 * 模块级变量 + `Set<Listener>` + `subscribe` + 快照读取，消费侧走 `useSyncExternalStore`。
 */

type Listener = () => void

const listeners = new Set<Listener>()

/**
 * ⚠️ 必须惰性初始化，不能在模块顶层直接读盘。
 *
 * `main.tsx` 里 `installBuiltinWidgets()` 是语句，而 ESM 的 import 先全部求值完才执行语句 ——
 * 模块顶层读盘时组件注册表还是空的，各组件 config 不会被归一化。
 * 首次读盘只能发生在首次渲染（那时注册表已装配好）。
 */
let doc: BoardDoc | undefined

function getDoc(): BoardDoc {
  if (doc === undefined) {
    doc = loadInitialDoc()
  }
  return doc
}

/** 结构快照（分组 id 序列）与行快照，见 `rebuildStructure`。 */
let cachedGroupIds: string[] = []
let cachedGroupRows: GroupRow[] = []

/**
 * 维护两份「结构快照」：分组 id 序列、按行切开的分组结构。
 *
 * ⚠️ 细粒度订阅的性能命门：结构没变就必须复用原来的数组引用。
 * `useSyncExternalStore` 靠 `Object.is` 比快照决定要不要重渲染，每次返回新数组就等于
 * 告诉 React"变了"，细粒度订阅全部失效 —— 且症状只是"仍然整页刷新"，没有任何报错。
 *
 * 只比 id 序列是安全的：行结构只由「id 顺序 + 各分组类型」决定，
 * 而类型创建后不可修改（`board-reducer` 的 `updateGroup` 刻意不收 groupType）。
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
    // 结构没变：两份缓存继续复用，订阅者不会被唤醒
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
 * 派发一个操作。
 * `boardReducer` 未命中目标时返回原引用（例如 patch 的 itemId 不存在），
 * 这时直接返回、不通知订阅者 —— 否则会白跑一遍所有组件的快照比较。
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
 * 语义化操作集合 —— 模块级常量，引用永远不变。
 * 只派发、不订阅的组件靠它彻底避开重渲染：事件处理器直接 import 即可，
 * 所有读取都发生在调用那一刻（见上面各个 `read*`），不会捕获到过期的 doc。
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
