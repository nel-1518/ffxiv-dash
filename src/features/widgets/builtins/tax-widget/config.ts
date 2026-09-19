/** 市场税率卡的配置类型、默认值与归一化（纯数据，无组件）。 */
import { isWorldName } from '../../../../core/world.ts'

/**
 * 缓存有效期 8 小时。
 *
 * 组件只在页面打开时看一次缓存，命中且未过期就直接用、不发请求；
 * 因此这个值同时也是"最长会看到多久以前的税率"。
 */
export const TAX_CACHE_TTL_MS = 8 * 60 * 60 * 1000

export type TaxConfig = {
  /** 服务器名（`core/world.ts` 里的名字）。接口要的是 id，用 `findWorldByName` 反查。 */
  server: string
}

export const TAX_DEFAULT_CONFIG: TaxConfig = { server: '' }

export function normalizeTaxConfig(raw: unknown): TaxConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  /*
   * 服务器只认世界表里真实存在的名字：写错的、填成大区 / 全区的名字都当成没选
   * （接口只接受单个 world id，大区与全区查不到数据），卡面提示去编辑弹窗选。
   */
  const rawServer = typeof source.server === 'string' ? source.server.trim() : ''
  return { server: isWorldName(rawServer) ? rawServer : '' }
}
