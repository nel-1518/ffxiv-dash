/** 房屋售卖组件的配置类型、默认值与归一化（纯数据，无组件）。 */
import { isWorldName } from '../../../../core/world.ts'
import { HOUSE_AREAS, isHouseArea, isHouseUse } from './constants.ts'
import type { HouseUse } from './constants.ts'

/**
 * 缓存有效期 8 小时。
 * 组件只在页面打开 / 换服务器时看一次缓存，命中且未过期就直接用、不发请求。
 */
export const HOUSE_CACHE_TTL_MS = 8 * 60 * 60 * 1000

export type HouseConfig = {
  /** 服务器名（`core/world.ts` 里的名字）。接口要的是 id，用 `findWorldByName` 反查。 */
  server: string
  /** 房区 id（0..4），多选，**只当筛选条件**：卡片显示的是这些房区的合计。 */
  areas: number[]
  /** 房屋用途筛选：不限 / 部队 / 个人。纯展示层筛选，不触发重新请求。 */
  use: HouseUse
}

/** 默认勾选全部房区 + 不限用途：新建一张卡就该立刻有东西看，用户再按需收窄。 */
export const HOUSE_DEFAULT_CONFIG: HouseConfig = {
  server: '',
  areas: HOUSE_AREAS.map((area) => area.id),
  use: 'any',
}

function toAreas(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const ids: number[] = []
  for (const entry of raw) {
    const parsed = typeof entry === 'number' ? entry : Number(entry)
    // 只认已知房区，顺手去重；顺序无所谓，展示时按 HOUSE_AREAS 重排
    if (isHouseArea(parsed) && !ids.includes(parsed)) {
      ids.push(parsed)
    }
  }
  return ids
}

export function normalizeHouseConfig(raw: unknown): HouseConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  // 服务器只认世界表里真实存在的名字：拼错的话接口要的是一个不存在的 id，
  // 与其每次都报一次错，不如当成没选（卡面会提示去编辑弹窗选）
  const rawServer = typeof source.server === 'string' ? source.server.trim() : ''
  const server = isWorldName(rawServer) ? rawServer : ''

  /*
   * 房区**不自动补全**：空数组就是「一个都没选」，卡面提示去勾选。
   * 悄悄补回全部会让这一项永远清不空，用户以为选择没生效。
   */
  // 用途认不出就当「不限」：这是最宽的筛选，不会把数据藏起来
  const use = isHouseUse(source.use) ? source.use : 'any'

  return { server, areas: toAreas(source.areas), use }
}
