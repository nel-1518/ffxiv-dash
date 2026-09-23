import { App, Button, Flex, Input, Select, Typography } from 'antd'
import { ImportOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { fetchLinkMetadata } from '../../core/link-metadata.ts'
import { DEFAULT_GROUP_COLUMNS, type LinkItem } from '../../core/storage/types.ts'
import { useBoardDoc } from '../../state/hooks.ts'
import { boardActions, readBoardDoc } from '../../state/board-store.ts'
import { getMaxInputLines, metadataToLinkItem, parseLinkLines } from './link-metadata.ts'

const NEW_GROUP_VALUE = '__new-link-group__'

export function BatchLinksSettingsPanel(): React.ReactNode {
  const { notification } = App.useApp()
  const board = useBoardDoc()
  const [targetGroupId, setTargetGroupId] = useState(() => board.groups.find((group) => group.type === 'link')?.id ?? NEW_GROUP_VALUE)
  const [newGroupName, setNewGroupName] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const linkGroups = useMemo(() => board.groups.filter((group) => group.type === 'link'), [board.groups])
  const parsed = useMemo(() => parseLinkLines(input), [input])
  const selectedExistingGroup = linkGroups.some((group) => group.id === targetGroupId)
    ? targetGroupId
    : NEW_GROUP_VALUE
  const canSubmit = !loading && parsed.excessCount === 0 && parsed.lines.length > 0 && (
    selectedExistingGroup !== NEW_GROUP_VALUE || newGroupName.trim() !== ''
  )

  const showValidation = (): void => {
    if (parsed.excessCount > 0) {
      notification.warning({
        title: '链接数量超过限制',
        description: `最多输入 ${getMaxInputLines()} 行，请删除多出的 ${parsed.excessCount} 行后再导入。`,
      })
      return
    }
    if (parsed.lines.length === 0) {
      notification.warning({
        title: '没有可导入的链接',
        description: parsed.invalid.length > 0 ? '输入中没有可识别的 HTTP 或 HTTPS 链接。' : '请先输入链接。',
      })
      return
    }
    if (selectedExistingGroup === NEW_GROUP_VALUE && newGroupName.trim() === '') {
      notification.warning({ title: '请输入分组名称' })
    }
  }

  const importLinks = async (): Promise<void> => {
    if (!canSubmit) {
      showValidation()
      return
    }

    const targetGroup = selectedExistingGroup === NEW_GROUP_VALUE
      ? undefined
      : readBoardDoc().groups.find((group) => group.id === selectedExistingGroup)
    const existingUrls = new Set(
      targetGroup?.items
        .filter((item): item is LinkItem => item.kind === 'link')
        .map((item) => item.url) ?? [],
    )
    const candidates = parsed.lines.filter(({ url }) => !existingUrls.has(url))
    const skippedExistingCount = parsed.lines.length - candidates.length

    setLoading(true)
    try {
      const results = await Promise.all(candidates.map(async ({ url, raw }) => {
        try {
          const metadata = await fetchLinkMetadata(url)
          return { status: 'fulfilled' as const, result: metadataToLinkItem(url, metadata), raw }
        } catch (error) {
          return { status: 'rejected' as const, raw, error }
        }
      }))

      const imported = results.filter((result) => result.status === 'fulfilled')
      if (imported.length === 0) {
        notifyImportResult(notification, 0, skippedExistingCount, parsed.invalid.length, results, [])
        return
      }

      let destinationGroupId = selectedExistingGroup
      if (selectedExistingGroup === NEW_GROUP_VALUE) {
        boardActions.addGroup(newGroupName.trim(), 'link', DEFAULT_GROUP_COLUMNS.link)
        destinationGroupId = readBoardDoc().groups[0]?.id ?? ''
      }

      for (const result of imported) {
        if (destinationGroupId !== '') {
          boardActions.addItem(destinationGroupId, result.result.item)
        }
      }

      const risks = imported.flatMap((result) => result.result.safetyTags.map((tag) => `${result.raw}: ${tag}`))
      notifyImportResult(notification, imported.length, skippedExistingCount, parsed.invalid.length, results, risks)
      setInput('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>批量添加链接</Typography.Title>
        <Typography.Text type="secondary" className="dash-settings-hint is-inline">
          每行输入一个链接，导入时会通过 <a href="https://linkmetadata.com/" target="_blank" rel="noopener noreferrer">LinkMetadata</a> 获取标题、描述和网站图标。
          <br />
          API 限制每个 IP 地址每 10 秒 20 次，出现错误时请等待十秒后重试。
        </Typography.Text>
      </section>

      <section>
        <Typography.Text strong>目标分组</Typography.Text>
        <Select
          value={selectedExistingGroup}
          disabled={loading}
          style={{ width: '100%', marginTop: 8 }}
          options={[
            ...linkGroups.map((group) => ({ label: group.title || '未命名分组', value: group.id })),
            { label: '新建链接分组', value: NEW_GROUP_VALUE },
          ]}
          onChange={setTargetGroupId}
        />
        {selectedExistingGroup === NEW_GROUP_VALUE ? (
          <Input
            value={newGroupName}
            disabled={loading}
            maxLength={60}
            placeholder="请输入新分组名称"
            aria-label="新分组名称"
            style={{ marginTop: 8 }}
            onChange={(event) => setNewGroupName(event.target.value)}
          />
        ) : null}
      </section>

      <section>
        <Typography.Text strong>链接列表</Typography.Text>
        <Input.TextArea
          value={input}
          disabled={loading}
          autoSize={{ minRows: 8, maxRows: 16 }}
          spellCheck={false}
          placeholder={'https://example.com\nwww.example.org'}
          style={{ marginTop: 8 }}
          onChange={(event) => setInput(event.target.value)}
        />
        <Typography.Text type="secondary" className="dash-settings-hint">
          {parsed.lines.length}/{getMaxInputLines()} 个有效链接
          {parsed.emptyCount > 0 ? `，${parsed.emptyCount} 个空行` : ''}
          {parsed.duplicateCount > 0 ? `，${parsed.duplicateCount} 个重复链接` : ''}
          {parsed.invalid.length > 0 ? `，${parsed.invalid.length} 个无效链接` : ''}
          {parsed.excessCount > 0 ? `，超出 ${parsed.excessCount} 行` : ''}
        </Typography.Text>
      </section>

      <Button
        type="primary"
        icon={<ImportOutlined />}
        loading={loading}
        onClick={() => void importLinks()}
      >
        导入链接
      </Button>
    </Flex>
  )
}

type ImportNotification = {
  success: (config: { title: string; description?: string; duration?: number }) => void
  warning: (config: { title: string; description?: string; duration?: number }) => void
  error: (config: { title: string; description?: string; duration?: number }) => void
}

type BatchResult =
  | { status: 'fulfilled'; raw: string; result: { item: LinkItem; safetyTags: string[] } }
  | { status: 'rejected'; raw: string; error: unknown }

function notifyImportResult(
  notification: ImportNotification,
  importedCount: number,
  skippedExistingCount: number,
  invalidCount: number,
  results: BatchResult[],
  risks: string[],
): void {
  const failures = results.filter((result): result is Extract<BatchResult, { status: 'rejected' }> => result.status === 'rejected')
  const details = [
    `成功导入 ${importedCount} 条`,
    skippedExistingCount > 0 ? `跳过已存在 ${skippedExistingCount} 条` : '',
    invalidCount > 0 ? `忽略无效链接 ${invalidCount} 条` : '',
    failures.length > 0 ? `获取元数据失败 ${failures.length} 条` : '',
    risks.length > 0 ? `检测到风险标签 ${risks.length} 条` : '',
  ].filter(Boolean)
  const failureDetails = failures.map((failure) => `${failure.raw}：${getFailureMessage(failure.error)}`)
  const riskDetails = risks.length > 0 ? [`风险项：${risks.join('；')}`] : []
  const description = [...details, ...failureDetails, ...riskDetails].join('\n')

  if (importedCount > 0 && failures.length === 0 && risks.length === 0) {
    notification.success({ title: '批量导入完成', description })
  } else if (importedCount > 0) {
    notification.warning({ title: '批量导入完成，但有部分项目需要注意', description, duration: 0 })
  } else {
    notification.error({ title: '没有成功导入链接', description, duration: 0 })
  }
}

function getFailureMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '网络请求失败'
}
