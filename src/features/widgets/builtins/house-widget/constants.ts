/**
 * 房屋组件的静态对照表（纯数据，无 React）。
 *
 * 房区与尺寸的取值都来自售楼中心的字段定义，数组顺序即接口的枚举顺序。
 * 服务器下拉不在这里 —— 那是几个组件共用的东西，已提到 `core/world.ts` 的 `worldOptions()`。
 */

export type HouseArea = {
  /** 接口的 `Area` 值。 */
  id: number
  name: string
}

/** 五个房区。⚠️「白银乡」既是房区名、也是莫古力的服务器名，两个别混。 */
export const HOUSE_AREAS: HouseArea[] = [
  { id: 0, name: '海雾村' },
  { id: 1, name: '薰衣草苗圃' },
  { id: 2, name: '高脚孤丘' },
  { id: 3, name: '白银乡' },
  { id: 4, name: '穹顶皓天' },
]

const AREA_NAME_BY_ID = new Map(HOUSE_AREAS.map((area) => [area.id, area.name]))

export function houseAreaName(id: number): string | undefined {
  return AREA_NAME_BY_ID.get(id)
}

/** 是否是已知房区。接口将来加新区时，这里（以及 HOUSE_AREAS）要同步。 */
export function isHouseArea(id: number): boolean {
  return AREA_NAME_BY_ID.has(id)
}

/** 尺寸：0 S / 1 M / 2 L。 */
export type HouseSize = 's' | 'm' | 'l'

/** 计数表的列顺序：M、L 在前，S 垫底 —— 主次就靠这个顺序，不靠说明文字。 */
export const HOUSE_SIZE_KEYS: readonly HouseSize[] = ['m', 'l', 's']

export const HOUSE_SIZE_LABELS: Record<HouseSize, string> = { s: 'S', m: 'M', l: 'L' }

/** 接口的 `Size` 值 → 内部键。未知值返回 undefined，由调用方忽略。 */
export function houseSizeOf(raw: number): HouseSize | undefined {
  if (raw === 0) {
    return 's'
  }
  if (raw === 1) {
    return 'm'
  }
  if (raw === 2) {
    return 'l'
  }
  return undefined
}

/** 用户可选、可筛选的房屋用途。 */
export type HouseUse = 'any' | 'fc' | 'personal'

export const HOUSE_USES: { value: HouseUse; label: string }[] = [
  { value: 'any', label: '不限' },
  { value: 'fc', label: '部队' },
  { value: 'personal', label: '个人' },
]

export const HOUSE_USE_LABELS: Record<HouseUse, string> = {
  any: '个人或部队房',
  fc: '部队房',
  personal: '个人房',
}

/**
 * 筛选值 → 计入的 `RegionType` 集合。
 *
 * ⚠️ `RegionType = 0` 是「个人/部队」—— 两种买家都能买，所以**两边都算上**。
 */
export function regionTypesOf(use: HouseUse): readonly number[] {
  if (use === 'fc') {
    return [0, 1]
  }
  if (use === 'personal') {
    return [0, 2]
  }
  return [0, 1, 2]
}

export function isHouseUse(value: unknown): value is HouseUse {
  return value === 'any' || value === 'fc' || value === 'personal'
}

/** 售楼中心首页；卡片正文整块点它就跳这里。 */
export const HOUSE_SITE_URL = 'https://house.ffxiv.cyou/'
