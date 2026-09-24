import { defineWidget } from '../../types.ts'
import { HOUSE_DEFAULT_CONFIG, normalizeHouseConfig } from './config.ts'
import { HouseFormFields, HouseRender } from './fields.tsx'
import type { WidgetSpec } from '../../types.ts'
import type { HouseConfig } from './config.ts'

export const houseWidgetSpec: WidgetSpec<HouseConfig> = defineWidget<HouseConfig>({
  key: 'house',
  label: '房屋售卖',
  description:
    '*查询某个服务器上可以购买的房屋数量，数据来自艾欧泽亚售楼中心。可按房区与用途筛选，展示 M / L / S 房的合计处数。抽签时期（申请期 5 天 + 公示期 4 天）由游戏周期推算。打开页面时获取一次数据，结果缓存 8 小时。',
  defaultTitle: '房屋售卖',
  defaultConfig: HOUSE_DEFAULT_CONFIG,
  maxCount: 5,
  normalizeConfig: normalizeHouseConfig,
  FormFields: HouseFormFields,
  Render: HouseRender,
})
