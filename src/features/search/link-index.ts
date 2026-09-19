import { readBoardDoc } from '../../state/board-store.ts'
import type { Group } from '../../core/storage/types.ts'
import type { LinkHit } from './searchLinks.ts'

/**
 * 链接索引：把看板里的链接条目提前拍平，供搜索使用。
 *
 * 存在的意义是**订阅粒度**：索引做成了「内容不变则引用不变」的缓存，
 * 调用方订阅它，就只在**链接集合真的变了**时才被唤醒 —— 若让调用它的
 * `DashboardPage` 直接订阅整个看板，改一张组件卡片的进度就会把顶栏与搜索框一起重渲染。
 *
 * 两者都不缓存就没事，缓存了就必须逐项比较：组件卡片的配置变化会让
 * `doc.groups` 换引用，但链接条目一个都没动，这种时候必须复用旧数组。
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
   * 逐项比较（比的是 item 的对象引用、以及分组名）：
   * 全部一致说明链接集合没动过，直接复用旧数组 —— 订阅者因此不会被唤醒。
   * 与 `state/board-store.ts` 里「结构快照」是同一套判定思路。
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
