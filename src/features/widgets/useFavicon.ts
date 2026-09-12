import { useState } from 'react'
import { buildFaviconUrl, faviconEnabled, toHost } from '../../core/favicon.ts'
import { clearFaviconFailure, isFaviconKnownBad, markFaviconFailed } from '../../core/favicon-cache.ts'

export type FaviconState = {
  /** 可直接给 <img src> 使用；为 undefined 表示应显示首字母回退。 */
  src: string | undefined
  onLoad: () => void
  onError: () => void
}

function resolveSrc(url: string): string | undefined {
  if (!faviconEnabled) {
    return undefined
  }
  const host = toHost(url)
  if (!host || isFaviconKnownBad(host)) {
    return undefined
  }
  return buildFaviconUrl(url) ?? undefined
}

/**
 * 网站图标的第三方接口封装。
 *
 * 关键点：不在 effect 里 setState。失败状态记录的是"哪个地址失败了"，
 * 于是 url 一变，派生出来的 src 会自动重新计算，天然完成重置 ——
 * 既没有级联渲染，也不需要用 ref 去追踪上一次的值。
 */
export function useFavicon(url: string): FaviconState {
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined)

  const effectiveUrl = failedUrl === url ? undefined : resolveSrc(url)

  return {
    src: effectiveUrl,
    onLoad: () => {
      const host = toHost(url)
      if (host) {
        clearFaviconFailure(host)
      }
    },
    onError: () => {
      const host = toHost(url)
      if (host) {
        markFaviconFailed(host)
      }
      setFailedUrl(url)
    },
  }
}
