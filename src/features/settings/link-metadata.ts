import type { LinkItem } from '../../core/storage/types.ts'
import { createId } from '../../core/ids.ts'

const METADATA_ENDPOINT = 'https://api.linkmetadata.com/v1/metadata'
const MAX_INPUT_LINES = 20
const MAX_DESCRIPTION_LENGTH = 500

export type LinkMetadata = {
  title?: string | null
  description?: string | null
  favicon?: { url?: string | null } | null
  safety_tags?: string[]
}

export type ParsedLinkLine = {
  url: string
  raw: string
}

export type LinkMetadataResult = {
  item: LinkItem
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

export function parseLinkLines(input: string): {
  lines: ParsedLinkLine[]
  emptyCount: number
  duplicateCount: number
  excessCount: number
  invalid: string[]
} {
  const rawLines = input.split(/\r?\n/)
  const excessCount = Math.max(0, rawLines.length - MAX_INPUT_LINES)
  const lines: ParsedLinkLine[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  let emptyCount = 0
  let duplicateCount = 0

  rawLines.slice(0, MAX_INPUT_LINES).forEach((raw) => {
    const trimmed = raw.trim()
    if (trimmed === '') {
      emptyCount += 1
      return
    }
    const url = normalizeLinkUrl(trimmed)
    if (url === null) {
      invalid.push(trimmed)
      return
    }
    if (seen.has(url)) {
      duplicateCount += 1
      return
    }
    seen.add(url)
    lines.push({ url, raw: trimmed })
  })

  return { lines, emptyCount, duplicateCount, excessCount, invalid }
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

export function metadataToLinkItem(url: string, metadata: LinkMetadata): LinkMetadataResult {
  const favicon = metadata.favicon && typeof metadata.favicon === 'object' ? optionalText(metadata.favicon.url) : undefined
  const description = optionalText(metadata.description)?.slice(0, MAX_DESCRIPTION_LENGTH)
  const safetyTags = Array.isArray(metadata.safety_tags)
    ? metadata.safety_tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')
    : []

  return {
    item: {
      id: createId(),
      kind: 'link',
      name: optionalText(metadata.title) ?? '未命名网站',
      url,
      ...(description ? { desc: description } : {}),
      ...(favicon ? { icon: favicon } : {}),
    },
    safetyTags,
  }
}

export function getMaxInputLines(): number {
  return MAX_INPUT_LINES
}
