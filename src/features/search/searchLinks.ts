import type { LinkItem } from '../../core/storage/types.ts'

/** 结果条数上限：这是"顺手一开"的场景，再长就要滚动了。 */
export const MAX_LINK_RESULTS = 5

/** 一条命中的已保存链接，附带所属分组，便于后续展示来源。 */
export type LinkHit = {
  item: LinkItem
  groupId: string
  groupTitle: string
}

/** 命中档位：越小越靠前。缩写最前（用户专为快速搜索设的短名字）→ 名称 → 描述/网址并列最后。 */
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
   * 缩写按存储原样参与匹配，只把"比较用"的一份小写化，不回写数据。
   * 空缩写必须跳过：参与 includes 的话任何关键词都会命中空串。
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
 * 在已保存的链接里检索关键词（入参是拍平的链接索引，见 link-index.ts；组件卡片的标题与
 * 配置不是「链接」，不混入检索）。排序：缩写精确 → 缩写前缀 → 缩写包含 → 名称 → 描述/网址；
 * 同档内保持看板文档顺序，结果顺序稳定，最后按 limit 截断。
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
