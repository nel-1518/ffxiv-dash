/**
 * 市场税率接口（纯逻辑，无 React）。
 *
 * 只做三件事：拼 URL、发请求（同一 URL 去重）、把响应折成**按 `TAX_CITIES` 顺序排列的读数**。
 *
 * 接口：`GET https://universalis.app/api/v2/tax-rates?world={worldId}` →
 * `{"Limsa Lominsa":5,"Gridania":5,"Ul'dah":5,"Ishgard":3,…}` ——
 * 一层对象，值是**百分比整数**（5 就是 5%）。**只支持单个服务器**：
 * 传大区 / 全区的名字查不到东西，所以配置里只允许选服务器（见 `config.ts`）。
 */
import { findWorldByName } from '../../../../core/world.ts'
import { TAX_CITIES, TAX_NORMAL_RATE } from './constants.ts'

const API_BASE = 'https://universalis.app/api/v2/tax-rates'

/** 一个城市的读数。`rate` 为 null = 接口没给这个城市的数（卡面显示破折号）。 */
export type TaxRow = {
  /** 接口字段名（也当 React 的 key）。 */
  key: string
  label: string
  /** 百分比：5 就是 5%。 */
  rate: number | null
}

export type TaxRates = {
  /** 服务器 id（与 `core/world.ts` 一致）。 */
  server: number
  /** 服务器名。缓存里也留一份，卡面不必再从 id 反查。 */
  serverName: string
  /** 按 `TAX_CITIES` 的顺序，八个城市一条不少。 */
  rates: TaxRow[]
  /** 数据到手时刻，缓存有效期以它为准。 */
  fetchedAt: number
}

export function buildTaxUrl(serverId: number): string {
  return `${API_BASE}?world=${String(serverId)}`
}

/**
 * 解析成读数表：只认 0–100 的有限数，其余（缺字段、`null`、字符串、越界）一律 null。
 *
 * ⚠️ 0 是合法税率（免税），不能和"没数据"混为一谈 —— 所以判据是"取不到数"，不是"数字为假"。
 */
export function parseTaxRates(
  payload: unknown,
  server: number,
  serverName: string,
  fetchedAt: number,
): TaxRates {
  const source = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}

  const rates = TAX_CITIES.map((city) => {
    const value = Number(source[city.key])
    const rate = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
    return { key: city.key, label: city.label, rate }
  })

  return { server, serverName, rates, fetchedAt }
}

/**
 * 这个城市是否在减税：税率低于正常值（`constants.ts` 的 `TAX_NORMAL_RATE`）。
 * 读不到数的不算 —— 破折号不是"减税"。
 *
 * 刻意**在渲染期现算**，而不是解析时就写进结果：数据要在缓存里躺 8 小时，
 * 存进去的判断会在阈值改了之后一直用旧值，现算则永远跟着当前阈值。
 */
export function isDiscounted(row: TaxRow): boolean {
  return row.rate !== null && row.rate < TAX_NORMAL_RATE
}

/** 同一 URL 的并发请求合并成一次：StrictMode 双挂载、多张同服卡片都只发一次。 */
const inFlight = new Map<string, Promise<TaxRates>>()

export function fetchTaxRates(serverName: string): Promise<TaxRates> {
  const world = findWorldByName(serverName)
  if (!world) {
    // 归一化保证不会走到这里，留个明确的错误好过拼出一个查不到的 URL
    return Promise.reject(new Error(`未知服务器：${serverName}`))
  }

  const url = buildTaxUrl(world.id)
  const running = inFlight.get(url)
  if (running) {
    return running
  }

  const task = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const payload: unknown = await response.json()
      return parseTaxRates(payload, world.id, world.name, Date.now())
    })
    .catch((error: unknown) => {
      /*
       * 失败细节只进控制台：卡面上只在标题行留一个「获取失败」，不占版面。
       * 记在这里而不是调用方 —— 同一 URL 的并发调用共用这一个 Promise，
       * 所以一次真实请求只会打一条（在调用方记会被 StrictMode 双挂载打成两条）。
       */
      console.error('[ffxiv-dash] 市场税率获取失败', { server: serverName, url, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(url)
    })

  inFlight.set(url, task)
  return task
}
