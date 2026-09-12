import { useEffect, useRef } from 'react'
import { Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import { GROUP_TYPE_OPTIONS, showsColumns } from '../groups/group-types.ts'
import { DEFAULT_GROUP_COLUMNS, GROUP_COLUMNS_MAX, GROUP_COLUMNS_MIN } from '../../core/storage/types.ts'
import type { GroupType } from '../../core/storage/types.ts'

export type GroupFormValues = {
  title: string
  type: GroupType
  /** 分组内卡片的排布列数，1-6。 */
  columns: number
}

export type GroupFormProps = {
  /** 由 EditDialog 提供的表单实例，Modal 的确定按钮通过它触发提交。 */
  form: FormInstance<GroupFormValues>
  formId: string
  /** 当前值；打开弹窗时自动填入，新建时用各类型的推荐默认值。 */
  initialValues: GroupFormValues
  /**
   * create：类型可选；
   * edit：类型不可修改，因此窗口里根本不出现类型配置，只留名称与列数。
   */
  mode: 'create' | 'edit'
  onFinish: (values: GroupFormValues) => void
}

/** 1-6 列的候选项；用下拉而不是滑块，避免"点了一下不小心改到"的情况。 */
const COLUMN_OPTIONS = Array.from(
  { length: GROUP_COLUMNS_MAX - GROUP_COLUMNS_MIN + 1 },
  (_, index) => GROUP_COLUMNS_MIN + index,
).map((value) => ({ label: `${value} 列`, value }))

/** 分组表单：名称 + 列数（新建时多一项类型）。提交由 EditDialog 的保存按钮触发 form.submit()。 */
export function GroupForm({ form, formId, initialValues, mode, onFinish }: GroupFormProps): React.ReactNode {
  const isCreate = mode === 'create'
  /** 上一次的类型，用来判断"新建时切换类型要不要顺手把列数换成新类型的默认值"。 */
  const lastType = useRef<GroupType>(initialValues.type)

  useEffect(() => {
    form.resetFields()
    form.setFieldsValue(initialValues)
    lastType.current = initialValues.type
  }, [form, initialValues])

  /**
  * 新建时切换项目类型，如果列数还停在旧类型的默认值上，就跟着换成新类型的默认值；
   * 用户手动挑过列数则原样保留，不覆盖他的选择。
   */
  const handleValuesChange = (changed: Partial<GroupFormValues>) => {
    const nextType = changed.type
    if (!isCreate || !nextType) {
      return
    }
    const untouched = form.getFieldValue('columns') === DEFAULT_GROUP_COLUMNS[lastType.current]
    if (untouched) {
      form.setFieldValue('columns', DEFAULT_GROUP_COLUMNS[nextType])
    }
    lastType.current = nextType
  }

  return (
    <Form<GroupFormValues>
      form={form}
      id={formId}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
      onValuesChange={handleValuesChange}
      clearOnDestroy
      preserve={false}
    >
      <Form.Item label="项目名称" name="title" rules={[{ required: true, message: '请输入项目名称' }]}>
        <Input placeholder="例如：常用链接" maxLength={40} />
      </Form.Item>

      {isCreate ? (
        <Form.Item label="项目类型" name="type">
          <Select options={GROUP_TYPE_OPTIONS} />
        </Form.Item>
      ) : (
        // 编辑时类型不可修改：控件不展示，但字段保留在表单里，提交时带着原类型一起走
        <Form.Item name="type" hidden>
          <Input />
        </Form.Item>
      )}

      <Form.Item noStyle shouldUpdate={(prev, next) => prev.type !== next.type}>
        {({ getFieldValue }) => {
          const current = (getFieldValue('type') as GroupType | undefined) ?? initialValues.type
          return showsColumns(current) ? (
            <Form.Item
              label="每行列数"
              name="columns"
            >
              <Select options={COLUMN_OPTIONS} style={{ width: 160 }} />
            </Form.Item>
          ) : null
        }}
      </Form.Item>
    </Form>
  )
}
