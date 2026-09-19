import type { LinkItem } from '../../core/storage/types.ts'

/** 结果条数上限：这是"顺手一开"的场景，再长就要滚动了。 */
export const MAX_LINK_RESULTS = 5

/** 一条命中的已保存链接，附带所属分组，便于后续展示来源。 */
export type LinkHit = {
  item: LinkItem
  groupId: string
  groupTitle: string
}

/**
 * 命中档位：越小越靠前。
 *
 * 名称命中排在最前，是因为用户输入的绝大多数情况就是在找"叫什么"的那个站点；
 * 描述与网址命中并列第二档。
 */
const RANK_NAME = 0
const RANK_OTHER = 1
const RANK_MISS = -1

function rankOf(item: LinkItem, keyword: string): number {
  if (item.name.toLowerCase().includes(keyword)) {
    return RANK_NAME
  }
  if ((item.desc ?? '').toLowerCase().includes(keyword)) {
    return RANK_OTHER
  }
  if (item.url.toLowerCase().includes(keyword)) {
    return RANK_OTHER
  }
  return RANK_MISS
}

/**
 * 在**已保存的链接**里检索关键词。
 *
 * 入参是已经拍平的链接索引（见 `link-index.ts`），因此这里只包含
 * `kind === 'link'` 的条目：组件卡片的标题与配置项不是"链接"，混进来只会稀释结果。
 *
 * 排序：先名称命中、再描述/网址命中，同档内保持看板里的文档顺序，
 * 因此每次输入的结果顺序都是稳定可预期的；最后按 limit 截断。
 */
export function searchLinks(
  links: readonly LinkHit[],
  keyword: string,
  limit: number = MAX_LINK_RESULTS,
): LinkHit[] {
  const normalized = keyword.trim().toLowerCase()
  if (normalized === '' || limit <= 0) {
    return []
  }

  const byName: LinkHit[] = []
  const byOther: LinkHit[] = []

  for (const hit of links) {
    const rank = rankOf(hit.item, normalized)
    if (rank === RANK_MISS) {
      continue
    }
    if (rank === RANK_NAME) {
      byName.push(hit)
    } else {
      byOther.push(hit)
    }
  }

  return [...byName, ...byOther].slice(0, limit)
}
