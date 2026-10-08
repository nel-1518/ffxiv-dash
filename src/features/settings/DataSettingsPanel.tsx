import { App, Button, Flex, Typography, Upload } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { boardActions } from '../../state/board-store.ts'
import { useBoardDoc } from '../../state/hooks.ts'
import { createDefaultBoard } from '../../core/storage/default-board.ts'
import { rawBoardFileName, readStoredBoardText } from '../../core/storage/persistent.ts'
import { downloadText, timestampForFileName } from '../../core/download-file.ts'
import {
  clearImportUndo,
  loadImportUndo,
  parseBackup,
  saveImportUndo,
  serializeBackup,
} from '../../core/storage/backup.ts'
import type { ImportUndo } from '../../core/storage/backup.ts'
import { importAppearance, restoreAppearance } from '../../core/appearance/store.ts'
import { setAutoOpenLinks } from '../../core/auto-open/store.ts'
import { setSearchEngines } from '../../core/search/store.ts'

/** 导入前快照的时间戳转展示文本（`10-07 14:30`）。 */
function formatUndoTime(savedAt: number): string {
  if (!Number.isFinite(savedAt) || savedAt <= 0) {
    return '时间未知'
  }
  const date = new Date(savedAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 数据管理：把看板 + 三项设置（跳转 / 搜索引擎 / 外观）整体导出为一份 JSON，或导入覆盖。
 *
 * 文件形状见 `core/storage/backup.ts`：看板那一段走 `parseBoardDocValue`，
 * 与启动时读 localStorage 是同一套校验，因此解析不出来的文件直接拒绝、不动现有数据。
 *
 * ⚠️ 导入**不是**一律覆盖：外观的粒度更细 —— 只有色调、槽位与各主题的模糊 / 亮度 /
 * 卡片参数会跟过来，每个主题的背景来源与本机图片保持不变（见 `importAppearance`）。
 * 确认弹窗里把这条说清楚，别让用户以为自己的背景图会被别人的备份冲掉。
 */
export function DataSettingsPanel(): React.ReactNode {
  // 面板只在设置弹窗打开时挂载，且要展示"当前有几个分组/几项内容"，所以直接订整份文档
  const doc = useBoardDoc()
  const { message, modal } = App.useApp()

  const itemCount = doc.groups.reduce((total, group) => total + group.items.length, 0)
  // 有快照才亮「恢复」按钮。导入 / 恢复都会换掉整份看板 → 面板重渲染 → 这里自然跟着刷新
  const undo = loadImportUndo()

  const handleRestore = (snapshot: ImportUndo) => {
    modal.confirm({
      title: '恢复导入前的数据',
      content: `将把看板与设置整体恢复到导入前（${formatUndoTime(snapshot.savedAt)}）的样子，导入之后的全部改动会被覆盖，此操作不可撤销。`,
      okText: '恢复',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        boardActions.replaceDoc(snapshot.file.board)
        setAutoOpenLinks(snapshot.file.autoOpen.links)
        setSearchEngines(snapshot.file.searchEngines)
        // 外观走整体替换：快照来自本机，档案里引用的就是本机那批图，整份搬回即恢复原状
        restoreAppearance(snapshot.file.appearance)
        // 快照一次性：恢复完就清掉，不提供"撤销的撤销"
        clearImportUndo()
        message.success('已恢复导入前的数据')
      },
    })
  }

  const handleExport = () => {
    downloadText(
      serializeBackup(doc),
      `ffxiv-dash-backup-${timestampForFileName(new Date())}.json`,
    )
    message.success('已导出看板与设置')
  }

  /**
   * 导出看板原始数据：本机存着的那份文本，**一字不改**（不校验、不补默认值、不包成备份文件）。
   *
   * 与"导出备份"的区别：备份是给人恢复用的（四段数据、结构规整），这一份是给**排查 / 抢救**用的 ——
   * 看板读不出来时，提示条上那个同名按钮导的就是它；用户没在提示条上及时点，也能来这里补上。
   * 只导看板那一段：读盘失败的是看板，而设置各住各的键、各有各的导出方式。
   */
  const handleExportRaw = () => {
    const raw = readStoredBoardText()
    if (raw === null) {
      message.error('本机没有可导出的看板原始数据')
      return
    }
    downloadText(raw, rawBoardFileName(new Date()), 'text/plain')
    message.success('已导出看板原始数据')
  }

  /**
   * 恢复默认看板。
   *
   * 它是"看板读不出来"时那条提示的落点：把本机存着的那份坏数据明确覆盖掉，
   * 用户不必去开发者工具里手动清 localStorage。只动看板 —— 跳转 / 搜索引擎 / 外观
   * 都是另一批键，读盘失败的是看板，没理由顺手把设置也清了。
   */
  const handleResetDefault = () => {
    modal.confirm({
      title: '恢复默认数据',
      content:
        '将把看板整体换回默认内容（当前的分组与卡片会被覆盖），「跳转」「搜索引擎」「外观」等设置不受影响。此操作不可撤销。',
      okText: '恢复默认',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        boardActions.replaceDoc(createDefaultBoard())
        message.success('已恢复默认看板')
      },
    })
  }

  const handleImport = (file: File) => {
    void file
      .text()
      .then((text) => {
        const backup = parseBackup(text)
        if (!backup) {
          message.error('这个文件不是可识别的备份数据')
          return
        }
        const nextItemCount = backup.board.groups.reduce(
          (total, group) => total + group.items.length,
          0,
        )
        modal.confirm({
          title: '导入会覆盖当前看板与设置',
          content: `文件里有 ${backup.board.groups.length} 个分组、${nextItemCount} 项内容，以及设置中的各项内容。导入后每个主题的背景保持为本机图片不变。此操作不可撤销。`,
          okText: '覆盖导入',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => {
            // 覆盖前先把"导入前"存成一份快照；存不进去也只是少了撤销这一步，不拦导入
            const undoSaved = saveImportUndo(doc)
            boardActions.replaceDoc(backup.board)
            setAutoOpenLinks(backup.autoOpen.links)
            setSearchEngines(backup.searchEngines)
            importAppearance(backup.appearance)
            if (undoSaved) {
              message.success('导入完成，导入前的数据已备份，可随时在下方恢复')
            } else {
              message.warning('导入完成，但没能保存导入前的备份（本地存储不可用），无法恢复')
            }
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
          当前有 {doc.groups.length} 个分组、{itemCount} 项内容，全部保存在本机浏览器里。
        </Typography.Text>
      </section>

      {/*
       * 三组按钮按"用户此刻想干什么"分开：整理数据（备份搬进搬出）与修数据
       */}
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          备份与恢复
        </Typography.Title>
        <Flex className="dash-settings-actions" gap={12} wrap>
          <Button icon={<UploadOutlined />} onClick={handleExport}>
            备份数据
          </Button>
          <Upload
            accept=".json,application/json"
            beforeUpload={handleImport}
            showUploadList={false}
            maxCount={1}
          >
            <Button icon={<DownloadOutlined />}>恢复数据</Button>
          </Upload>
        </Flex>
      </section>

      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          修复与重置
        </Typography.Title>
        <Flex className="dash-settings-actions" gap={12} wrap>
          <Button onClick={handleExportRaw}>导出看板原始数据</Button>
          <Button danger onClick={handleResetDefault}>
            恢复默认数据
          </Button>
          {undo ? <Button onClick={() => handleRestore(undo)}>恢复导入前的数据</Button> : null}
        </Flex>

        {undo ? (
          <Typography.Text type="secondary" className="dash-settings-hint">
            导入前备份（{formatUndoTime(undo.savedAt)}）：恢复会覆盖导入后的全部改动。
          </Typography.Text>
        ) : null}
      </section>
    </Flex>
  )
}
