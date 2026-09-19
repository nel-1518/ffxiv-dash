/**
 * 市场税率卡的静态对照表（纯数据，无 React）。
 *
 * 接口返回的是**以城市英文名为键的一层对象**（`{"Limsa Lominsa": 5, …}`），
 * 中文名与顺序都写死在这里：接口不会告诉我们要显示什么，而卡面需要一个固定顺序。
 *
 * `key` 必须与接口字段**逐字一致**（含撇号与空格）；上游改了字段名的话，
 * 那个城市会显示破折号（解析层把认不出来的值当"没数据"），不会整块失败。
 */
export type TaxCity = {
  /** 接口返回的字段名。 */
  key: string
  /** 卡面显示的中文名。 */
  label: string
}

/**
 * 正常税率（百分比）。**低于它的城市就是"减税"**，卡面在税率旁标一个「减」字。
 *
 * 这是服务器各自调的值，不是常量：国服八个城市里常驻的是 4 个 5% + 4 个 3%，
 * 但活动/改动后上游会变；改了阈值只需改这一个数。
 */
export const TAX_NORMAL_RATE = 5

/** 数据来源站点；卡片正文整块点它就跳这里。 */
export const TAX_SITE_URL = 'https://universalis.app/'

/** 八个有市场交易板的城市。顺序 = 卡面顺序（按行铺进 2×4 的格子）。 */
export const TAX_CITIES: TaxCity[] = [
  { key: 'Limsa Lominsa', label: '利姆萨·罗敏萨' },
  { key: 'Gridania', label: '格里达尼亚' },
  { key: "Ul'dah", label: '乌尔达哈' },
  { key: 'Ishgard', label: '伊修加德' },
  { key: 'Kugane', label: '黄金港' },
  { key: 'Crystarium', label: '水晶都' },
  { key: 'Old Sharlayan', label: '旧萨雷安' },
  { key: 'Tuliyollal', label: '图莱尤拉' },
]
