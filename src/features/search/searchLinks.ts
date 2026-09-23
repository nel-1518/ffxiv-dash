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
 * 缩写排在最前，因为它是用户专门为"快速搜索"设的短名字；
 * 名称命中紧随其后（用户输入的绝大多数情况就是在找"叫什么"的那个站点）；
 * 描述与网址命中并列最后一档。
 */
const RANK_ABBREVIATION_EXACT = 0
const RANK_ABBREVIATION_PREFIX = 1
const RANK_ABBREVIATION_CONTAINS = 2
const RANK_NAME = 3
const RANK_OTHER = 4
const RANK_MISS = -1
/** 档位总数（0 到 `RANK_OTHER` 各一个桶）。 */
const RANK_COUNT = RANK_OTHER + 1

function rankOf(item: LinkItem, keyword: string): number {
  /*
   * 缩写按存储原样参与匹配，只把"比较用"的这一份小写化，不回写数据。
   * 空缩写直接跳过 —— 别让它参与 `includes`，否则任何关键词都会命中一个空串。
   */
  const abbreviation = item.abbreviation?.toLowerCase() ?? ''
  if (abbreviation !== '') {
    if (abbreviation === keyword) {
      return RANK_ABBREVIATION_EXACT
    }
    if (abbreviation.startsWith(keyword)) {
      return RANK_ABBREVIATION_PREFIX
    }
    if (abbreviation.includes(keyword)) {
      return RANK_ABBREVIATION_CONTAINS
    }
  }
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
 * 排序：缩写精确 → 缩写前缀 → 缩写包含 → 名称命中 → 描述/网址命中，
 * 同档内保持看板里的文档顺序，因此每次输入的结果顺序都是稳定可预期的；
 * 最后按 limit 截断。
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

  // 每个档位一个桶（同档内自然就是看板顺序），最后按档位拼接
  const buckets: LinkHit[][] = Array.from({ length: RANK_COUNT }, () => [])

  for (const hit of links) {
    const rank = rankOf(hit.item, normalized)
    if (rank === RANK_MISS) {
      continue
    }
    buckets[rank].push(hit)
  }

  return buckets.flat().slice(0, limit)
}
