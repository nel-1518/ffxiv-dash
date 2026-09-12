import { useCallback, useState } from 'react'
import { App, Divider, Flex } from 'antd'
import { useBoard, useBoardActions } from '../state/hooks.ts'
import { EditDialog } from '../features/dashboard/EditDialog.tsx'
import { Topbar } from '../features/dashboard/Topbar.tsx'
import { SearchDialog } from '../features/search/SearchDialog.tsx'
import { useLinkSearch } from '../features/search/useLinkSearch.ts'
import { SettingsDialog } from '../features/settings/SettingsDialog.tsx'
import { GroupBoard } from '../features/groups/GroupBoard.tsx'
import type { ModalState } from '../features/dashboard/EditDialog.tsx'
import type { GroupFormValues } from '../features/groups/GroupForm.tsx'
import type { Item } from '../core/storage/types.ts'

/** 仪表盘页面：组装顶栏、分组看板与编辑弹窗。 */
export function DashboardPage(): React.ReactNode {
  const doc = useBoard()
  const actions = useBoardActions()
  const { modal } = App.useApp()

  const [modalState, setModalState] = useState<ModalState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** 编辑模式：刻意不持久化，刷新后回到干净的浏览态，避免误拖误删。 */
  const [editMode, setEditMode] = useState(false)

  // 搜索：顶栏输入与弹窗共享同一份 keyword；任一弹窗打开时把快捷键整体让位
  const search = useLinkSearch({ doc, suspended: modalState !== null || settingsOpen })

  const confirmRemoveGroup = useCallback(
    (groupId: string) => {
      const group = doc.groups.find((entry) => entry.id === groupId)
      modal.confirm({
        title: `删除项目「${group?.title ?? ''}」？`,
        content: '该项目下的所有内容都会一并删除，此操作不可撤销。',
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => {
          actions.removeGroup(groupId)
          // 删除入口在编辑弹窗里，删掉之后弹窗要一起关掉，否则会停在空分组上
          setModalState(null)
        },
      })
    },
    [actions, doc.groups, modal],
  )

  // 删除条目的确认由卡片自身负责（弹窗标题会带上条目名称），
  // 这里直接落库即可，否则点一次删除会连续弹两次确认。
  const removeItem = useCallback(
    (groupId: string, itemId: string) => {
      actions.removeItem(groupId, itemId)
    },
    [actions],
  )

  const handleSaveGroup = useCallback(
    (groupId: string | null, values: GroupFormValues) => {
      if (groupId) {
        // 类型创建后不可改，编辑只提交名称与列数
        actions.updateGroup(groupId, values.title, values.columns)
      } else {
        actions.addGroup(values.title, values.type, values.columns)
      }
      setModalState(null)
    },
    [actions],
  )

  const handleSaveItem = useCallback(
    (groupId: string, itemId: string | null, item: Item) => {
      if (itemId) {
        actions.updateItem(groupId, item)
      } else {
        actions.addItem(groupId, item)
      }
      setModalState(null)
    },
    [actions],
  )

  return (
    <Flex vertical gap={20}>
      <Topbar
        keyword={search.keyword}
        onKeywordChange={search.handleKeywordChange}
        onOpenSearch={search.handleOpenForReplace}
        onStartTyping={search.handleOpenForTyping}
        editMode={editMode}
        onToggleEditMode={() => setEditMode((value) => !value)}
        onCreateGroup={() => setModalState({ mode: 'group', groupId: null })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <Divider style={{ margin: 0 }} />

      <GroupBoard
        groups={doc.groups}
        editMode={editMode}
        onAddItem={(groupId) => setModalState({ mode: 'item', groupId, itemId: null })}
        onEditGroup={(groupId) => setModalState({ mode: 'group', groupId })}
        onEditItem={(groupId, itemId) => setModalState({ mode: 'item', groupId, itemId })}
        onRemoveItem={removeItem}
      />

      <EditDialog
        state={modalState}
        doc={doc}
        onClose={() => setModalState(null)}
        onSaveGroup={handleSaveGroup}
        onSaveItem={handleSaveItem}
        onRemoveGroup={confirmRemoveGroup}
      />

      {search.open ? (
        <SearchDialog
          keyword={search.keyword}
          selectAllOnOpen={search.selectAllOnOpen}
          rows={search.rows}
          activeIndex={search.activeIndex}
          onKeywordChange={search.handleKeywordChange}
          onMoveActive={search.handleMoveActive}
          onActivate={search.handleActivate}
          onSelect={search.handleSelect}
          onClose={search.handleClose}
        />
      ) : null}

      {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
    </Flex>
  )
}
