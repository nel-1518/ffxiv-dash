import { createId } from '../core/ids.ts'
import { canPlaceItem, countWidgetInstances } from '../core/group-rules.ts'
import { clampGroupColumns } from '../core/storage/types.ts'
import type { BoardDoc, Group, WidgetItem } from '../core/storage/types.ts'
import { getWidget } from '../features/widgets/registry.ts'
import { maxCountOf } from '../features/widgets/types.ts'
import type { BoardAction } from './board-types.ts'

function replaceGroups(doc: BoardDoc, groups: Group[]): BoardDoc {
  return { ...doc, groups }
}

function updateGroupById(doc: BoardDoc, groupId: string, update: (group: Group) => Group): BoardDoc {
  return replaceGroups(
    doc,
    doc.groups.map((group) => (group.id === groupId ? update(group) : group)),
  )
}

/** 依据 id 顺序重排；缺失的 id 保持原有相对顺序追加在末尾。 */
function applyOrder<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  for (const id of orderedIds) {
    const found = byId.get(id)
    if (found) {
      ordered.push(found)
      byId.delete(id)
    }
  }
  for (const item of items) {
    if (byId.has(item.id)) {
      ordered.push(item)
    }
  }
  return ordered
}

/**
 * 某组件类型是否已达实例上限（整块看板全局计数，见 `core/group-rules.ts`）。
 * spec 未注册时没有上限信息，按"不设限"处理，避免把未知类型的落库全堵死。
 */
function widgetLimitReached(doc: BoardDoc, widgetKey: string): boolean {
  const spec = getWidget(widgetKey)
  if (!spec) {
    return false
  }
  return countWidgetInstances(doc, widgetKey) >= maxCountOf(spec.maxCount)
}

/**
 * 仪表盘状态 reducer —— 纯函数，全部不可变更新。
 * 不改动入参，便于后续直接写单测。
 */
export function boardReducer(doc: BoardDoc, action: BoardAction): BoardDoc {
  switch (action.type) {
    case 'addGroup': {
      const group: Group = {
        id: createId(),
        title: action.title,
        type: action.groupType,
        columns: clampGroupColumns(action.columns, action.groupType),
        items: [],
      }
      // 新建的分组放在**最顶层**：刚建好的项目立刻出现在眼前，
      // 不必再点一串「上移项目」把它挪上来。
      // 需要换位置时表头有 置顶 / 上移 / 下移 / 置底 四个按钮。
      return replaceGroups(doc, [group, ...doc.groups])
    }

    case 'updateGroup':
      return updateGroupById(doc, action.groupId, (group) => ({
        ...group,
        title: action.title,
        // 类型创建后不可修改：这里不从 action 取类型，界面就算传了也影响不到数据
        columns: clampGroupColumns(action.columns, group.type),
      }))

    case 'removeGroup':
      return replaceGroups(
        doc,
        doc.groups.filter((group) => group.id !== action.groupId),
      )

    case 'reorderGroups':
      return replaceGroups(doc, applyOrder(doc.groups, action.orderedIds))

    case 'addItem': {
      // 组件实例上限：达上限的类型不再落库（界面层已把选项禁用，这里是最后闸门）
      if (action.item.kind === 'widget' && widgetLimitReached(doc, action.item.widget)) {
        console.warn(`[ffxiv-dash] 组件 "${action.item.widget}" 已达实例上限，拒绝添加`)
        return doc
      }
      return updateGroupById(doc, action.groupId, (group) =>
        canPlaceItem(group.type, action.item.kind) ? { ...group, items: [...group.items, action.item] } : group,
      )
    }

    case 'updateItem': {
      /*
       * 编辑已有条目本身不占新名额；但把组件**改成另一种类型**等价于"再放一个新类型的实例"，
       * 同样要过上限。同类型改标题 / 配置不受限。
       */
      const existing = doc.groups
        .flatMap((group) => group.items)
        .find((entry) => entry.id === action.item.id)
      const switchedType =
        action.item.kind === 'widget' &&
        (existing?.kind !== 'widget' || existing.widget !== action.item.widget)
      if (switchedType && widgetLimitReached(doc, action.item.widget)) {
        console.warn(`[ffxiv-dash] 组件 "${action.item.widget}" 已达实例上限，拒绝修改类型`)
        return doc
      }
      return updateGroupById(doc, action.groupId, (group) =>
        canPlaceItem(group.type, action.item.kind)
          ? { ...group, items: group.items.map((item) => (item.id === action.item.id ? action.item : item)) }
          : group,
      )
    }

    case 'updateItemConfig': {
      // 按 id 反查所属分组：组件内部只拿得到自己的 item.id
      let touched = false
      const nextGroups = doc.groups.map((group) => {
        const target = group.items.find((item) => item.id === action.itemId)
        if (!target || target.kind !== 'widget') {
          return group
        }
        touched = true
        const updated: WidgetItem = { ...target, config: { ...target.config, ...action.patch } }
        return { ...group, items: group.items.map((item) => (item.id === action.itemId ? updated : item)) }
      })
      // 没命中就别换引用，免得白跑一次落盘
      return touched ? replaceGroups(doc, nextGroups) : doc
    }

    case 'removeItem':
      return updateGroupById(doc, action.groupId, (group) => ({
        ...group,
        items: group.items.filter((item) => item.id !== action.itemId),
      }))

    case 'reorderItems':
      return updateGroupById(doc, action.groupId, (group) => ({
        ...group,
        items: applyOrder(group.items, action.orderedIds),
      }))

    case 'moveItemToGroup': {
      const source = doc.groups.find((group) => group.id === action.sourceGroupId)
      const target = doc.groups.find((group) => group.id === action.targetGroupId)
      const item = source?.items.find((entry) => entry.id === action.itemId)
      if (!source || !target || !item || !canPlaceItem(target.type, item.kind)) {
        return doc
      }

      // 先从源分组移除，再插入目标分组的参照卡片之前（或末尾）
      const withoutItem = source.items.filter((entry) => entry.id !== action.itemId)
      const nextGroups = doc.groups.map((group) => {
        if (group.id === action.sourceGroupId) {
          return { ...group, items: withoutItem }
        }
        if (group.id !== action.targetGroupId) {
          return group
        }
        const targetIndex = action.overItemId
          ? group.items.findIndex((entry) => entry.id === action.overItemId)
          : -1
        const items = [...group.items]
        items.splice(targetIndex >= 0 ? targetIndex : items.length, 0, item)
        return { ...group, items }
      })

      return replaceGroups(doc, nextGroups)
    }

    case 'replaceDoc':
      // 导入已经过 parseBoardDoc 校验；这里直接换引用，store 会广播变更并由落盘闸门写盘
      return action.doc

    default: {
      // 穷尽检查：新增 action 却忘了处理时，这里会报类型错误
      const exhaustive: never = action
      return exhaustive
    }
  }
}
