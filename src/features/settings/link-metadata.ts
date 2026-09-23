import { createId } from '../../core/ids.ts'
import { linkFieldsFromMetadata, normalizeLinkUrl, type LinkMetadata } from '../../core/link-metadata.ts'
import type { LinkItem } from '../../core/storage/types.ts'

/**
 * 「批量添加链接」专属的纯逻辑：多行文本 → 去重后的链接列表 → `LinkItem[]`。
 *
 * ⚠️ 接口请求与元数据字段提取**不在这里**，它们在 `core/link-metadata.ts`：
 * 编辑弹窗的「自动获取数据」也要用同一份实现（含按 URL 在飞去重）。
 */

const MAX_INPUT_LINES = 20

export type ParsedLinkLine = {
  url: string
  raw: string
}

export type LinkMetadataResult = {
  item: LinkItem
  safetyTags: string[]
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

export function metadataToLinkItem(url: string, metadata: LinkMetadata): LinkMetadataResult {
  const fields = linkFieldsFromMetadata(metadata)

  return {
    item: {
      id: createId(),
      kind: 'link',
      name: fields.name ?? '未命名网站',
      url,
      ...(fields.desc ? { desc: fields.desc } : {}),
      ...(fields.icon ? { icon: fields.icon } : {}),
    },
    safetyTags: fields.safetyTags,
  }
}

export function getMaxInputLines(): number {
  return MAX_INPUT_LINES
}
