import { App, Button, Flex, Typography, Upload } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useBoard, useBoardActions } from '../../state/hooks.ts'
import { parseBoardDoc, serializeBoardDoc } from '../../core/storage/persistent.ts'

/** 导出文件名里的时间戳：本地时间、到分钟，够用来区分多次导出。 */
function timestampForFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('')
}

/** 把文本存成文件下载。 */
function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 点击后立刻 revoke 在部分浏览器里会把下载掐断，挪到下一个任务里做
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * 数据管理：把看板整体导出为 JSON，或从 JSON 导入覆盖。
 *
 * 导入走 `parseBoardDoc`，与启动时读 localStorage 是同一套校验与迁移逻辑，
 * 因此导出文件、更老版本的导出文件都能吃下；解析不出来的文件直接拒绝，不动现有数据。
 */
export function DataSettingsPanel(): React.ReactNode {
  const doc = useBoard()
  const actions = useBoardActions()
  const { message, modal } = App.useApp()

  const itemCount = doc.groups.reduce((total, group) => total + group.items.length, 0)

  const handleExport = () => {
    downloadText(
      serializeBoardDoc(doc),
      `ffxiv-dash-board-${timestampForFileName(new Date())}.json`,
    )
    message.success('已导出看板数据')
  }

  const handleImport = (file: File) => {
    void file
      .text()
      .then((text) => {
        const next = parseBoardDoc(text)
        if (!next) {
          message.error('这个文件不是可识别的看板数据')
          return
        }
        const nextItemCount = next.groups.reduce((total, group) => total + group.items.length, 0)
        modal.confirm({
          title: '导入会覆盖当前看板',
          content: `文件里有 ${next.groups.length} 个分组、${nextItemCount} 项内容。导入后当前的分组与卡片会被整体替换，此操作不可撤销。`,
          okText: '覆盖导入',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => {
            actions.replaceDoc(next)
            message.success('导入完成')
          },
        })
      })
      .catch((error: unknown) => {
        console.warn('[ffxiv-dash] 读取导入文件失败', error)
        message.error('文件读取失败')
      })

    // 返回 false：阻止 antd 自己发起上传，这次导入由我们全权处理
    return false
  }

  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          数据
        </Typography.Title>
        <Typography.Text type="secondary" className="dash-settings-hint is-inline">
          当前看板有 {doc.groups.length} 个分组、{itemCount} 项内容，全部保存在本机浏览器里。
          主题与「外观 → 背景」偏好不在导出范围内，导入别人的看板也不会覆盖它们。
        </Typography.Text>

        <Flex className="dash-settings-actions" gap={12} wrap>
          <Button icon={<UploadOutlined />} onClick={handleExport}>
            导出为 JSON
          </Button>
          <Upload
            accept=".json,application/json"
            beforeUpload={handleImport}
            showUploadList={false}
            maxCount={1}
          >
            <Button icon={<DownloadOutlined />}>从 JSON 导入</Button>
          </Upload>
        </Flex>
      </section>
    </Flex>
  )
}
