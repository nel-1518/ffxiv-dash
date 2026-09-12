import { useMemo } from 'react'
import { Button, Flex, Form, Modal, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { GroupForm } from '../groups/GroupForm.tsx'
import { ItemForm } from './ItemForm.tsx'
import { DEFAULT_GROUP_COLUMNS } from '../../core/storage/types.ts'
import type { GroupFormValues } from '../groups/GroupForm.tsx'
import type { BoardDoc, GroupType, Item } from '../../core/storage/types.ts'

/** 弹窗状态机：一次只开一个弹窗，分组与卡片各自一套模式。 */
export type ModalState =
  | { mode: 'group'; groupId: string | null }
  | { mode: 'item'; groupId: string; itemId: string | null }

export type EditDialogProps = {
  state: ModalState | null
  doc: BoardDoc
  onClose: () => void
  onSaveGroup: (groupId: string | null, values: GroupFormValues) => void
  onSaveItem: (groupId: string, itemId: string | null, item: Item) => void
  /** 删除项目；项目表头已经不放删除按钮了，入口统一在编辑弹窗里。 */
  onRemoveGroup: (groupId: string) => void
}

const GROUP_FORM_ID = 'ffxiv-dash-group-form'
const ITEM_FORM_ID = 'ffxiv-dash-item-form'

/**
 * 编辑弹窗宿主。
 *
 * 两个要点：
 * 1. `Modal` 在 `state` 为 null 时整个不渲染，但 useForm **必须无条件调用**，
 *    否则关闭弹窗时 hook 数量变化会破坏 Hooks 规则。
 * 2. useForm 返回的实例必须通过 `form` 传给真正的 <Form>，否则它是"未连接"的，
 *    控制台会警告、`form.submit()` 也不会触发校验与提交。
 *
 * 用 destroyOnHidden + Form 的 clearOnDestroy / preserve={false}，
 * 保证每次打开都是干净的表单，并且名称与列数按当前分组自动填入。
 */
export function EditDialog({
  state,
  doc,
  onClose,
  onSaveGroup,
  onSaveItem,
  onRemoveGroup,
}: EditDialogProps): React.ReactNode {
  const [form] = Form.useForm()

  const group = state ? doc.groups.find((entry) => entry.id === state.groupId) : undefined
  const item = useMemo<Item | undefined>(() => {
    if (state?.mode !== 'item' || !state.itemId) {
      return undefined
    }
    return group?.items.find((entry) => entry.id === state.itemId)
  }, [state, group])

  const groupInitialValues = useMemo<GroupFormValues>(() => {
    const type = (group?.type ?? 'widget') as GroupType
    return {
      title: group?.title ?? '',
      type,
      // 打开即填入当前值；新建时按类型的推荐列数起步
      columns: group?.columns ?? DEFAULT_GROUP_COLUMNS[type],
    }
  }, [group?.columns, group?.title, group?.type])

  if (!state) {
    return null
  }

  const isGroupMode = state.mode === 'group'
  const isEditing = isGroupMode ? Boolean(state.groupId) : Boolean(state.itemId)

  const title = isGroupMode
    ? isEditing
      ? '编辑项目'
      : '新建项目'
    : isEditing
      ? item?.kind === 'widget'
        ? '编辑小组件'
        : '编辑网页链接'
      : `添加项目 · ${group?.title ?? ''}`

  // 项目表头不再放删除按钮，删除入口收进弹窗左下角（新建时没有可删的东西，不显示）
  const deletableGroupId = isGroupMode && isEditing ? state.groupId : null

  return (
    <Modal
      open 
      title={title}
      destroyOnHidden
      mask={{ closable: true }}
      onCancel={onClose}
      width={620}
      footer={
        <Flex align="center" justify="space-between">
          <div>
            {deletableGroupId ? (
              <Button danger icon={<DeleteOutlined />} onClick={() => onRemoveGroup(deletableGroupId)}>
                删除项目
              </Button>
            ) : null}
          </div>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        </Flex>
      }
    >
      {isGroupMode ? (
        <GroupForm
          form={form}
          formId={GROUP_FORM_ID}
          initialValues={groupInitialValues}
          // 类型只在新建时可选；编辑时窗口里只有名称与列数
          mode={isEditing ? 'edit' : 'create'}
          onFinish={(values) => onSaveGroup(state.groupId, values)}
        />
      ) : (
        <ItemForm
          form={form}
          formId={ITEM_FORM_ID}
          groupType={group?.type ?? 'widget'}
          item={item}
          onFinish={(next) => onSaveItem(state.groupId, state.itemId, next)}
        />
      )}
    </Modal>
  )
}
