import './dashboard.css'
import { useMemo, useState } from 'react'
import { Alert, Button, Flex, Form, Modal, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useBoardGroup } from '../../state/hooks.ts'
import { GroupForm } from '../groups/GroupForm.tsx'
import { ItemForm, MAX_LINK_DESC_INPUT_LENGTH } from './ItemForm.tsx'
import { DEFAULT_GROUP_COLUMNS } from '../../core/storage/types.ts'
import { LinkMetadataError, fetchLinkMetadata, linkFieldsFromMetadata, normalizeLinkUrl } from '../../core/link-metadata.ts'
import type { LinkFormLayout } from './ItemForm.tsx'
import type { GroupFormValues } from '../groups/GroupForm.tsx'
import type { GroupType, Item } from '../../core/storage/types.ts'

/** 弹窗状态机：一次只开一个弹窗，分组与卡片各自一套模式。 */
export type ModalState =
  | { mode: 'group'; groupId: string | null }
  | { mode: 'item'; groupId: string; itemId: string | null }

export type EditDialogProps = {
  state: ModalState | null
  onClose: () => void
  onSaveGroup: (groupId: string | null, values: GroupFormValues) => void
  onSaveItem: (groupId: string, itemId: string | null, item: Item) => void
  /** 删除项目；项目表头已经不放删除按钮了，入口统一在编辑弹窗里。 */
  onRemoveGroup: (groupId: string) => void
}

const GROUP_FORM_ID = 'ffxiv-dash-group-form'
const ITEM_FORM_ID = 'ffxiv-dash-item-form'

/**
 * 编辑弹窗外壳。
 *
 * 两个要点：
 * 1. `Modal` 在 `state` 为 null 时整个不渲染；`useForm` 等 hook 因此都住在下面的
 *    `EditDialogSession` 里 —— 会话不存在时它们根本不需要被调用，也就没有"hook 数量变化"的问题。
 * 2. 会话用 `key` 按"编辑对象"重挂：每次打开都是干净的一份临时状态
 *    （链接的「下一步」走到了哪、请求中标记、错误文案），不必写 effect 去比对上一次是谁。
 *
 * 用 destroyOnHidden + Form 的 clearOnDestroy / preserve={false}，
 * 保证每次打开都是干净的表单，并且名称与列数按当前分组自动填入。
 */
export function EditDialog(props: EditDialogProps): React.ReactNode {
  const { state } = props
  if (!state) {
    return null
  }
  const sessionKey =
    state.mode === 'group' ? `group:${state.groupId ?? 'new'}` : `item:${state.groupId}:${state.itemId ?? 'new'}`

  return <EditDialogSession key={sessionKey} {...props} state={state} />
}

type EditDialogSessionProps = Omit<EditDialogProps, 'state'> & { state: ModalState }

function EditDialogSession({ state, onClose, onSaveGroup, onSaveItem, onRemoveGroup }: EditDialogSessionProps): React.ReactNode {
  /*
   * 刻意**不给 `useForm` 传类型参数**：同一个实例要服务分组表单与卡片表单两套字段形状，
   * 钉死成 `ItemFormValues` 会让 `GroupForm` 那侧不兼容（TS2322）。
   */
  const [form] = Form.useForm()

  /*
   * 自己订阅要编辑的那个分组：调用方（`DashboardPage`）因此不必为了弹窗去读整份看板
   * （否则它会被任何一次卡片改动带着重渲染）。
   */
  const group = useBoardGroup(state.groupId ?? '')

  const item = useMemo<Item | undefined>(() => {
    if (state.mode !== 'item' || !state.itemId) {
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

  const isGroupMode = state.mode === 'group'
  const isEditing = isGroupMode ? Boolean(state.groupId) : Boolean(state.itemId)

  /**
   * 「自动获取数据」只服务**新建网页链接**：编辑已有链接时字段都已经填好了，
   * widget 分组里也不会有链接（`link` 分组的 `allowedKinds` 只有 `link`，因此
   * "新建链接"就等于"在 link 分组里新建卡片"，不需要再判断内容种类）。
   */
  const isNewLink = state.mode === 'item' && !state.itemId && group?.type === 'link'
  const [autoFetch, setAutoFetch] = useState(true)
  // 元数据已经取回来（或用户取消了自动获取）：此时才展示完整字段
  const [fetched, setFetched] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  /** 第一步：只填网址 + 自动获取。取消勾选后这一步就不再出现（用户选了手填）。 */
  const urlStep = isNewLink && autoFetch && !fetched
  const linkLayout: LinkFormLayout = urlStep ? 'url-only' : isNewLink ? 'url-first' : 'default'

  /**
   * 「下一步」：只校验网址 → 取元数据 → 回填标题 / 描述 / 图标。
   *
   * ⚠️ 这里**不能**调 `form.submit()`：那会立刻走 `onFinish` 把半成品链接存下来。
   */
  const goNext = async (): Promise<void> => {
    let raw = ''
    try {
      const values = await form.validateFields([['link', 'url']])
      raw = values.link?.url ?? ''
    } catch {
      return // 校验失败的信息由字段自己显示
    }

    const url = normalizeLinkUrl(raw)
    if (url === null) {
      setFetchError('请输入有效的 http 或 https 网址。')
      return
    }
    // 补上协议头后写回表单：请求与最终保存用的是同一个地址
    form.setFieldValue(['link', 'url'], url)

    setFetching(true)
    setFetchError(null)
    try {
      const metadata = await fetchLinkMetadata(url)
      const fields = linkFieldsFromMetadata(metadata)
      form.setFieldsValue({
        link: {
          url,
          // 取不到标题就留空，交给提交时的「未命名网站」兜底
          name: fields.name ?? '',
          icon: fields.icon ?? '',
          // 元数据描述按输入框上限切一刀（`maxLength` 管不到程序化写入）
          desc: (fields.desc ?? '').slice(0, MAX_LINK_DESC_INPUT_LENGTH),
        },
      })
      setFetched(true)
    } catch (error) {
      // 失败就停在第一步：网址留着，用户可以改地址或直接重试
      setFetchError(error instanceof LinkMetadataError ? error.message : '获取网页信息失败，请稍后重试，或手动添加。')
      console.warn('[ffxiv-dash] 获取网页信息失败', error)
    } finally {
      setFetching(false)
    }
  }

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
      className="dash-edit-dialog"
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
            {urlStep ? (
              <Button type="primary" loading={fetching} onClick={() => void goNext()}>
                下一步
              </Button>
            ) : (
              <Button type="primary" onClick={() => form.submit()}>
                保存
              </Button>
            )}
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
        <>
          {fetchError ? (
            <Alert type="warning" showIcon title={fetchError} style={{ marginBottom: 16 }} />
          ) : null}
          <ItemForm
            form={form}
            formId={ITEM_FORM_ID}
            groupType={group?.type ?? 'widget'}
            item={item}
            linkLayout={linkLayout}
            autoFetch={autoFetch}
            onAutoFetchChange={setAutoFetch}
            loading={fetching}
            onFinish={(next) => onSaveItem(state.groupId, state.itemId, next)}
          />
        </>
      )}
    </Modal>
  )
}
