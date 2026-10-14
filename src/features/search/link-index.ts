import { readBoardDoc } from '../../state/board-store.ts'
import type { Group } from '../../core/storage/types.ts'
import type { LinkHit } from './searchLinks.ts'

/**
 * 链接索引：把看板里的链接条目提前拍平，供搜索使用。
 * 存在的意义是订阅粒度：索引「内容不变则引用不变」，订阅方只在链接集合真变时被唤醒 ——
 * 若让 DashboardPage 直接订阅整份看板，改一张卡片会连带重渲染顶栏与搜索。
 */

/** 上一次用来建索引的 groups 引用，用于短路"根本没换过"的常见情况。 */
let cachedSource: Group[] | undefined
let cachedHits: LinkHit[] = []

export function getLinkIndex(): LinkHit[] {
  const groups = readBoardDoc().groups
  if (groups === cachedSource) {
    return cachedHits
  }

  const next: LinkHit[] = []
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === 'link') {
        next.push({ item, groupId: group.id, groupTitle: group.title })
      }
    }
  }

  /*
   * 逐项比较（item 引用 + 分组名）：全部一致说明链接集合没动过，直接复用旧数组，
   * 订阅者不会被唤醒。与 state/board-store.ts 的「结构快照」同一套判定思路。
   */
  const unchanged =
    next.length === cachedHits.length &&
    next.every((hit, index) => {
      const previous = cachedHits[index]
      return hit.item === previous.item && hit.groupId === previous.groupId && hit.groupTitle === previous.groupTitle
    })

  cachedSource = groups
  if (unchanged) {
    return cachedHits
  }

  cachedHits = next
  return cachedHits
}
