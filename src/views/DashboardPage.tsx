import { useCallback, useState } from 'react'
import { App, Flex } from 'antd'
import { boardActions, readGroupTitle } from '../state/board-store.ts'
import { BoardLoadAlert } from '../features/dashboard/BoardLoadAlert.tsx'
import { BoardSurface } from '../features/dashboard/BoardSurface.tsx'
import { EditDialog } from '../features/dashboard/EditDialog.tsx'
import { Topbar } from '../features/dashboard/Topbar.tsx'
import { SearchDialog } from '../features/search/SearchDialog.tsx'
import { useLinkSearch } from '../features/search/useLinkSearch.ts'
import { SettingsDialog } from '../features/settings/SettingsDialog.tsx'
import type { ModalState } from '../features/dashboard/EditDialog.tsx'
import type { SettingsSectionKey } from '../features/settings/SettingsDialog.tsx'
import type { GroupFormValues } from '../features/groups/GroupForm.tsx'
import type { Item } from '../core/storage/types.ts'

/**
 * 仪表盘页面：组装顶栏、分组看板与编辑弹窗。
 *
 * ⚠️ 这一层刻意不订阅任何看板数据：订阅全部下沉（结构在 `BoardSurface`，卡片在各自槽位，
 * 弹窗在 `EditDialog` 自身），这里只留本地界面状态与稳定回调 —— 否则任何一次卡片改动
 * 都会让顶栏、搜索框、设置入口一起重渲染。
 */
export function DashboardPage(): React.ReactNode {
  const { modal } = App.useApp()

  const [modalState, setModalState] = useState<ModalState | null>(null)
  /**
   * 设置弹窗开着时记的是**当前分区**，关着是 null。
   *
   * 记分区而不是布尔：读盘失败的提示条要能把用户直接送到「数据管理」，
   * 而"打开哪一页"是设定值，不该由弹窗自己再推一遍（见 `initialSection`）。
   */
  const [settingsSection, setSettingsSection] = useState<SettingsSectionKey | null>(null)
  /** 编辑模式：刻意不持久化，刷新后回到干净的浏览态，避免误拖误删。 */
  const [editMode, setEditMode] = useState(false)

  // 搜索：顶栏输入与弹窗共享同一份 keyword；任一弹窗打开时把快捷键整体让位
  const search = useLinkSearch({ suspended: modalState !== null || settingsSection !== null })

  /*
   * 这批回调全部引用稳定（只依赖 setState 或模块级常量）：它们会被透传到
   * `memo(BoardGroupSlot)` / `memo(SortableCard)` 的 props 比较里，每次渲染新建闭包会让 memo 失效。
   */
  const confirmRemoveGroup = useCallback(
    (groupId: string) => {
      modal.confirm({
        title: `删除分组「${readGroupTitle(groupId)}」？`,
        content: '该分组下的所有内容都会一并删除，此操作不可撤销。',
        okText: '删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => {
          boardActions.removeGroup(groupId)
          // 删除入口在编辑弹窗里，删掉之后弹窗要一起关掉，否则会停在空分组上
          setModalState(null)
        },
      })
    },
    [modal],
  )

  const openGroupCreator = useCallback(() => setModalState({ mode: 'group', groupId: null }), [])
  const openGroupEditor = useCallback((groupId: string) => setModalState({ mode: 'group', groupId }), [])
  const openItemCreator = useCallback(
    (groupId: string) => setModalState({ mode: 'item', groupId, itemId: null }),
    [],
  )
  const openItemEditor = useCallback(
    (groupId: string, itemId: string) => setModalState({ mode: 'item', groupId, itemId }),
    [],
  )

  const closeModal = useCallback(() => setModalState(null), [])
  const openSettings = useCallback(() => setSettingsSection('appearance'), [])
  /** 读盘失败提示条上的「去数据管理」：直接把设置开在数据管理那一页。 */
  const openDataSettings = useCallback(() => setSettingsSection('data'), [])
  const closeSettings = useCallback(() => setSettingsSection(null), [])
  const toggleEditMode = useCallback(() => setEditMode((value) => !value), [])

  const handleSaveGroup = useCallback((groupId: string | null, values: GroupFormValues) => {
    if (groupId) {
      // 类型创建后不可改，编辑只提交名称与列数
      boardActions.updateGroup(groupId, values.title, values.columns)
    } else {
      boardActions.addGroup(values.title, values.type, values.columns)
    }
    setModalState(null)
  }, [])

  const handleSaveItem = useCallback((groupId: string, itemId: string | null, item: Item) => {
    if (itemId) {
      boardActions.updateItem(groupId, item)
    } else {
      boardActions.addItem(groupId, item)
    }
    setModalState(null)
  }, [])

  return (
    <Flex vertical gap={20}>
      {/* 顶栏在内容列之外：它是页面顶端的全宽元素 */}
      <Topbar
        keyword={search.keyword}
        onKeywordChange={search.handleKeywordChange}
        onOpenSearch={search.handleOpenForReplace}
        onStartTyping={search.handleOpenForTyping}
        editMode={editMode}
        onToggleEditMode={toggleEditMode}
        onCreateGroup={openGroupCreator}
        onOpenSettings={openSettings}
      />

      {/* 读盘失败时，顶栏下面先说清楚发生了什么（没失败就什么都不渲染） */}
      <BoardLoadAlert onOpenDataSettings={openDataSettings} />

      {/*
       * 看板整块交给 `BoardSurface`：它自己订阅分组结构，看板数据的变化到不了这一层。
       * 顶栏不在里面 —— 它要铺满视口宽度（`.dash-container` 的居中限宽由 BoardSurface 负责）。
       */}
      <BoardSurface
        editMode={editMode}
        onAddItem={openItemCreator}
        onEditGroup={openGroupEditor}
        onEditItem={openItemEditor}
      />

      {/* 编辑弹窗自己按 id 订阅要编辑的分组 */}
      <EditDialog
        state={modalState}
        onClose={closeModal}
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

      {settingsSection ? (
        <SettingsDialog initialSection={settingsSection} onClose={closeSettings} />
      ) : null}
    </Flex>
  )
}
