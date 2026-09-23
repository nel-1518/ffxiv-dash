/**
 * LinkMetadata 接口客户端（https://linkmetadata.com/docs/api-reference）。
 *
 * 放在 `core/` 而不是某个 feature 下：**两处**都在用它 —— 设置里的「批量添加链接」
 * 与编辑弹窗里新建链接的「自动获取数据」。放 feature 里会让另一处反向依赖。
 * 请求实现照 `market-widget/universalis.ts` / `house-widget/sale.ts` 的三条惯例来：
 * 模块内拼 URL、自己校验未知 JSON、按 URL 在飞去重。
 *
 * ⚠️ 这是**第三方公开服务**：无需 API key，但按 IP 限流（每 10 秒 20 次，超了封 10 秒）。
 * 批量调用方必须顺序或低并发地发请求，别在这里加并发池把它撑爆。
 */

const METADATA_ENDPOINT = 'https://api.linkmetadata.com/v1/metadata'

/**
 * 描述写进看板前的上限，与 `storage/schema.ts` 的 `MAX_TEXT_LENGTH` 一致：
 * 元数据的 description 可能是一整段，不切会让落盘时被 schema 静默截断。
 */
export const MAX_METADATA_DESCRIPTION_LENGTH = 500

export type LinkMetadata = {
  title?: string | null
  description?: string | null
  favicon?: { url?: string | null } | null
  safety_tags?: string[]
}

/** 从元数据里挑出来的、可直接写进表单或 `LinkItem` 的字段。 */
export type LinkMetadataFields = {
  name?: string
  desc?: string
  icon?: string
  /** 只用于提示，不落盘。 */
  safetyTags: string[]
}

export class LinkMetadataError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'LinkMetadataError'
    this.status = status
  }
}

const inFlight = new Map<string, Promise<LinkMetadata>>()

/**
 * 把用户输入收敛成绝对 HTTP(S) URL；认不出来返回 null。
 *
 * 没写协议头的补 `https://`（与「跳转」设置、便签里的链接规则一致），
 * `javascript:` 之类非 http(s) 一律拒绝。
 */
export function normalizeLinkUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function errorMessage(status: number): string {
  if (status === 400) return '链接地址无效'
  if (status === 422) return '目标页面无法抓取或解析'
  if (status === 429) return 'API 请求过于频繁，请稍后再试'
  if (status === 500) return '元数据服务发生错误'
  return `元数据请求失败（${status}）`
}

async function requestMetadata(url: string): Promise<LinkMetadata> {
  const response = await fetch(`${METADATA_ENDPOINT}?${new URLSearchParams({ url, prefer: 'og' })}`)
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // 非 JSON 错误响应仍按 HTTP 状态处理。
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : errorMessage(response.status)
    throw new LinkMetadataError(message, response.status)
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new LinkMetadataError('元数据响应格式无效')
  }
  return payload as LinkMetadata
}

/** 同一 URL 的并发请求共用一份结果，避免重复点击打出多次请求。 */
export function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const existing = inFlight.get(url)
  if (existing) {
    return existing
  }
  const request = requestMetadata(url).finally(() => inFlight.delete(url))
  inFlight.set(url, request)
  return request
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * 元数据 → 可落盘字段。
 *
 * 字段选择是**刻意的**：只取标题 / 描述 / favicon，
 * 不用 `url`（canonical 会改写用户填的地址）、也不用 `image` 与原始 OG/Twitter 数据。
 */
export function linkFieldsFromMetadata(metadata: LinkMetadata): LinkMetadataFields {
  const favicon =
    metadata.favicon && typeof metadata.favicon === 'object' ? optionalText(metadata.favicon.url) : undefined
  const desc = optionalText(metadata.description)?.slice(0, MAX_METADATA_DESCRIPTION_LENGTH)
  const safetyTags = Array.isArray(metadata.safety_tags)
    ? metadata.safety_tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')
    : []

  return {
    name: optionalText(metadata.title),
    desc,
    icon: favicon,
    safetyTags,
  }
}
