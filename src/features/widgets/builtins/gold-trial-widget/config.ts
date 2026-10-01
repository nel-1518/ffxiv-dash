/**
 * 黄金的试炼卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * 这张卡**没有用户可配项**：它展示的是活动方每周公布的公共信息（期号、挑战副本、
 * 时间窗口、奖励），与服务器 / 角色都无关。config 因此是个空对象 ——
 * 保留类型与归一化只是为了跟其它组件走同一条注册路径（spec 要求有
 * `defaultConfig` / `normalizeConfig`），旧数据与手改过的 config 都会被归一化成 `{}`。
 */

/** 数据来源：ffxiv-api 的代理接口 */
export const GOLD_TRIAL_API_URL = 'https://ffxiv-api.neeeel.com/api/goldTrial'

/** 活动专题页：挑战成功后的**登记入口**（规则要求登记确认，否则视为放弃）。 */
export const GOLD_TRIAL_SITE_URL = 'https://actff1.web.sdo.com/20241130_GoldTrial/#/index'

/** 无配置项。写成空对象类型，别处就不会误以为能读某个字段。 */
export type GoldTrialConfig = Record<string, never>

export const GOLD_TRIAL_DEFAULT_CONFIG: GoldTrialConfig = {}

/** 不为空对象也不行：一律归一化成同一份 `GOLD_TRIAL_DEFAULT_CONFIG`（引用稳定）。 */
export function normalizeGoldTrialConfig(_raw: unknown): GoldTrialConfig {
  return GOLD_TRIAL_DEFAULT_CONFIG
}
