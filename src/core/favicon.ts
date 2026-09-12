/**
 * 网站图标（favicon）第三方接口的封装。
 *
 * 接口形态：`https://ico.faviconkit.net/favicon/{domain}?sz={size}`
 * 实测返回 `image/png`，可以直接作为 `<img src>` 使用。
 *
 * 需要替换图标服务时，只改这里的 FAVICON_SERVICE 即可。
 */

const FAVICON_SERVICE = 'https://ico.faviconkit.net'

/** 卡片头像尺寸为 36 / 28 px，取 64 以便在 2x DPR 屏幕上依然清晰。 */
const FAVICON_SIZE = 64

/**
 * 从任意用户输入的网址里取出 host。
 * 先按原样解析，失败再补 `https://` 重试，仍失败返回 null。
 */
export function toHost(url: string): string | null {
  const raw = url.trim()
  if (!raw) {
    return null
  }
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const parsed = new URL(candidate)
      if (parsed.hostname) {
        return parsed.hostname
      }
    } catch {
      // 继续尝试下一种写法
    }
  }
  return null
}

/** 依据网址拼出图标地址；无法解析域名时返回 null（调用方应回退首字母）。 */
export function buildFaviconUrl(url: string): string | null {
  const host = toHost(url)
  if (!host) {
    return null
  }
  return `${FAVICON_SERVICE}/favicon/${host}?sz=${FAVICON_SIZE}`
}

/** 失败缓存的作用域标识：换服务或换尺寸时自动失效。 */
export const FAVICON_CACHE_SCOPE = `${FAVICON_SERVICE}|${FAVICON_SIZE}`

/**
 * 隐私开关：关掉后只显示首字母，不再向第三方发起图标请求。
 * 通过 `VITE_FAVICON_ENABLED=false` 关闭。
 */
export const faviconEnabled = import.meta.env.VITE_FAVICON_ENABLED !== 'false'
