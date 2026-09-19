import { useCallback, useState } from 'react'
import { App, Flex } from 'antd'
import { boardActions, readGroupTitle } from '../state/board-store.ts'
import { BoardSurface } from '../features/dashboard/BoardSurface.tsx'
import { EditDialog } from '../features/dashboard/EditDialog.tsx'
import { Topbar } from '../features/dashboard/Topbar.tsx'
import { SearchDialog } from '../features/search/SearchDialog.tsx'
import { useLinkSearch } from '../features/search/useLinkSearch.ts'
import { SettingsDialog } from '../features/settings/SettingsDialog.tsx'
import type { ModalState } from '../features/dashboard/EditDialog.tsx'
import type { GroupFormValues } from '../features/groups/GroupForm.tsx'
import type { Item } from '../core/storage/types.ts'

/**
 * 仪表盘页面：组装顶栏、分组看板与编辑弹窗。
 *
 * ⚠️ 这一层**刻意不订阅任何看板数据**。
 *
 * 看板数据的订阅全部下沉：看板结构在 `BoardSurface`，卡片在各自的槽位与卡片上，
 * 弹窗在 `EditDialog` 自己身上。这里只剩下「本地界面状态」与「稳定的回调」——
 * 否则任何一次卡片改动（比如点一下进度卡的 +1）都会让顶栏、搜索框、设置入口一起重渲染。
 *
 * 删除确认要在**点击那一刻**才去 store 读分组名，不能提前闭包捕获一份 doc。
 */
export function DashboardPage(): React.ReactNode {
  const { modal } = App.useApp()

  const [modalState, setModalState] = useState<ModalState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** 编辑模式：刻意不持久化，刷新后回到干净的浏览态，避免误拖误删。 */
  const [editMode, setEditMode] = useState(false)

  // 搜索：顶栏输入与弹窗共享同一份 keyword；任一弹窗打开时把快捷键整体让位
  const search = useLinkSearch({ suspended: modalState !== null || settingsOpen })

  /*
   * 下面这批回调全部是**引用稳定**的：它们要么只依赖 setState，要么依赖模块级常量
   * （`boardActions` / `readGroupTitle`）。这是本次重构能成立的前提之一 ——
   * 它们会被一路透传到 `memo(BoardGroupSlot)` / `memo(SortableCard)` 的比较里，
   * 每次渲染新建闭包会让那些 memo 全部失效。
   */
  const confirmRemoveGroup = useCallback(
    (groupId: string) => {
      modal.confirm({
        title: `删除项目「${readGroupTitle(groupId)}」？`,
        content: '该项目下的所有内容都会一并删除，此操作不可撤销。',
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
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
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
      {/* 顶栏在内容列之外：它自己就是页面顶端那条全宽元素 */}
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

      {/*
       * 看板整块交给 `BoardSurface`：它自己订阅分组结构，因此看板数据的任何变化
       * 都到不了这一层。顶栏不在里面 —— 它是页面顶端的一整条元素，要铺满视口宽度
       * （`.dash-container` 的居中限宽由 BoardSurface 负责）。
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

      {settingsOpen ? <SettingsDialog onClose={closeSettings} /> : null}
    </Flex>
  )
}
