/**
 * 中国区世界表（纯数据 + 基础查询，无 React）。
 *
 * 为什么放在 `core/` 而不是某个组件目录里：区服是跨组件的通用概念
 * （物品价格、将来的人数统计 / 服务器状态都要用），别让第二个用到它的地方
 * 再抄一份表。组件专属的东西（下拉选项怎么分组、怎么映射到接口字段）留在各自目录。
 *
 * 层级：region（中国）→ dc（大区）→ world（服务器）。
 * `id` 与 Universalis `/api/v2/data-centers` 返回的 `worlds` 数组一一对应
 * （1042 = 拉诺西亚、1167 = 红玉海 …），改表时务必与上游核对。
 */

/** 整个中国区的 region 名。Universalis 也接受 `China`，但接口自身返回的是中文。 */
export const CHINA_REGION = '中国'

export type WorldEntry = {
  /** 世界 ID，与 Universalis 一致。 */
  id: number
  /** 服务器名。 */
  name: string
}

export type DataCenterEntry = {
  /** 大区名。 */
  name: string
  /** 所属 region。 */
  region: string
  /** 大区下的服务器，顺序沿用游戏内的排列。 */
  worlds: WorldEntry[]
}

/** 中国区的大区表。 */
export const DATA_CENTERS: DataCenterEntry[] = [
  {
    name: '陆行鸟',
    region: CHINA_REGION,
    worlds: [
      { id: 1042, name: '拉诺西亚' },
      { id: 1044, name: '幻影群岛' },
      { id: 1081, name: '神意之地' },
      { id: 1060, name: '萌芽池' },
      { id: 1167, name: '红玉海' },
      { id: 1173, name: '宇宙和音' },
      { id: 1174, name: '沃仙曦染' },
      { id: 1175, name: '晨曦王座' },
    ],
  },
  {
    name: '莫古力',
    region: CHINA_REGION,
    worlds: [
      { id: 1170, name: '潮风亭' },
      { id: 1171, name: '神拳痕' },
      { id: 1172, name: '白银乡' },
      { id: 1076, name: '白金幻象' },
      { id: 1113, name: '旅人栈桥' },
      { id: 1121, name: '拂晓之间' },
      { id: 1166, name: '龙巢神殿' },
      { id: 1176, name: '梦羽宝境' },
    ],
  },
  {
    name: '猫小胖',
    region: CHINA_REGION,
    worlds: [
      { id: 1043, name: '紫水栈桥' },
      { id: 1169, name: '延夏' },
      { id: 1106, name: '静语庄园' },
      { id: 1045, name: '摩杜纳' },
      { id: 1177, name: '海猫茶屋' },
      { id: 1178, name: '柔风海湾' },
      { id: 1179, name: '琥珀原' },
    ],
  },
  {
    name: '豆豆柴',
    region: CHINA_REGION,
    worlds: [
      { id: 1192, name: '水晶塔' },
      { id: 1183, name: '银泪湖' },
      { id: 1180, name: '太阳海岸' },
      { id: 1186, name: '伊修加德' },
      { id: 1201, name: '红茶川' },
    ],
  },
]

/** 服务器扁平列表，`DATA_CENTERS` 的派生视图（顺序不变）。 */
export const WORLDS: (WorldEntry & { dc: string })[] = DATA_CENTERS.flatMap((dc) =>
  dc.worlds.map((world) => ({ id: world.id, name: world.name, dc: dc.name })),
)

/** 大区名列表。 */
export const DC_NAMES: string[] = DATA_CENTERS.map((dc) => dc.name)

const WORLD_BY_NAME = new Map(WORLDS.map((world) => [world.name, world]))
const WORLD_BY_ID = new Map(WORLDS.map((world) => [world.id, world]))
const DC_BY_NAME = new Map(DATA_CENTERS.map((dc) => [dc.name, dc]))

export function findWorldByName(name: string): (WorldEntry & { dc: string }) | undefined {
  return WORLD_BY_NAME.get(name)
}

export function findWorldById(id: number): (WorldEntry & { dc: string }) | undefined {
  return WORLD_BY_ID.get(id)
}

/** 世界 ID → 服务器名。跨服查询时用来标注「这个价出自哪个服」。 */
export function worldNameById(id: number | undefined): string | undefined {
  return id === undefined ? undefined : WORLD_BY_ID.get(id)?.name
}

/** 服务器名 → 它所属的大区名。 */
export function dataCenterOfWorld(name: string): string | undefined {
  return WORLD_BY_NAME.get(name)?.dc
}

export function findDataCenterByName(name: string): DataCenterEntry | undefined {
  return DC_BY_NAME.get(name)
}

export function isWorldName(name: string): boolean {
  return WORLD_BY_NAME.has(name)
}

export function isDataCenterName(name: string): boolean {
  return DC_BY_NAME.has(name)
}

/** 是否是合法的区服选择项：整个 region、某个大区，或某个服务器。 */
export function isScopeName(scope: string): boolean {
  return scope === CHINA_REGION || isDataCenterName(scope) || isWorldName(scope)
}

/** 下拉选项的形状：要么一项可选，要么一个带子项的分组（antd Select 直接吃）。 */
export type WorldOptionGroup = {
  label: string
  options: { label: string; value: string }[]
}

/**
 * 服务器下拉：大区只当分组标题、组内只有服务器 —— **大区本身不可选**。
 *
 * 给"按单个服务器取数"的接口用（房屋售卖、市场税率）：那些接口只接受一个 world id，
 * 给了大区 / 全区也查不到东西。需要「中国（全区）/ 大区 / 服务器」三档的组件自己拼选项
 * （见 `market-widget/scopes.ts`：那里的档位还要映射到接口的返回结构）。
 */
export function worldOptions(): WorldOptionGroup[] {
  return DATA_CENTERS.map((dc) => ({
    label: dc.name,
    options: dc.worlds.map((world) => ({ label: world.name, value: world.name })),
  }))
}
