import { FAVICON_CACHE_SCOPE } from './favicon.ts'

/**
 * 图标请求失败的负缓存。
 *
 * 离线 / 接口被墙时，如果不记下来，每次渲染都会对同一批域名重新发起请求，
 * 造成闪烁与请求风暴。这里用 localStorage 记录失败的 host，TTL 后允许重试。
 */

const CACHE_KEY = 'ffxiv-dash:favicon-fail:v1'
const FAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000

type FailEntry = { scope: string; hosts: Record<string, number> }

function readCache(): FailEntry {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) {
      return { scope: FAVICON_CACHE_SCOPE, hosts: {} }
    }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'scope' in parsed &&
      typeof (parsed as FailEntry).scope === 'string' &&
      typeof (parsed as FailEntry).hosts === 'object' &&
      (parsed as FailEntry).hosts !== null
    ) {
      const entry = parsed as FailEntry
      // 换了图标服务或尺寸就整体作废
      if (entry.scope !== FAVICON_CACHE_SCOPE) {
        return { scope: FAVICON_CACHE_SCOPE, hosts: {} }
      }
      return entry
    }
    return { scope: FAVICON_CACHE_SCOPE, hosts: {} }
  } catch {
    return { scope: FAVICON_CACHE_SCOPE, hosts: {} }
  }
}

function writeCache(entry: FailEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // 隐私模式 / 配额超限：放弃缓存即可，不影响功能
  }
}

/** 该 host 是否在失败冷却期内。 */
export function isFaviconKnownBad(host: string): boolean {
  const entry = readCache()
  const failedAt = entry.hosts[host]
  if (typeof failedAt !== 'number') {
    return false
  }
  if (Date.now() - failedAt > FAIL_TTL_MS) {
    return false
  }
  return true
}

/** 标记某 host 图标请求失败。 */
export function markFaviconFailed(host: string): void {
  const entry = readCache()
  entry.hosts[host] = Date.now()
  writeCache(entry)
}

/** 图标加载成功后清除该 host 的失败记录。 */
export function clearFaviconFailure(host: string): void {
  const entry = readCache()
  if (!(host in entry.hosts)) {
    return
  }
  delete entry.hosts[host]
  writeCache(entry)
}
