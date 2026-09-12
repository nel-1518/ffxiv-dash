import { useEffect, useMemo } from 'react'
import { Divider, Form, Input, Select, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { createId } from '../../core/ids.ts'
import { getWidget, listWidgetOptions } from '../widgets/registry.ts'
import { allowedItemKinds, canPlaceItem } from '../groups/group-types.ts'
import type { GroupType, Item, ItemKind, LinkItem, WidgetItem } from '../../core/storage/types.ts'

/** 表单里的扁平结构：组件自身字段放 config。 */
export type ItemFormValues = {
  kind: ItemKind
  link?: { name?: string; icon?: string; url?: string; desc?: string }
  widget?: { key?: string; title?: string }
  config?: Record<string, unknown>
}

export type ItemFormProps = {
  /** 由 EditDialog 提供的表单实例，Modal 的确定按钮通过它触发提交。 */
  form: FormInstance<ItemFormValues>
  formId: string
  /** 所属分组的类型：紧凑分组只能放网页导航。 */
  groupType: GroupType
  /** 编辑已有条目时传入，用于保留 id。 */
  item: Item | undefined
  onFinish: (item: Item) => void
}

function buildInitialValues(item: Item | undefined, defaultKind: ItemKind): ItemFormValues {
  if (!item) {
    const spec = getWidget('stats')
    return {
      kind: defaultKind,
      link: { name: '', icon: '', url: '', desc: '' },
      widget: { key: spec?.key ?? 'stats', title: spec?.defaultTitle ?? '自定义组件' },
      config: spec?.defaultConfig ?? {},
    }
  }

  if (item.kind === 'link') {
    return {
      kind: 'link',
      link: { name: item.name, icon: item.icon ?? '', url: item.url, desc: item.desc ?? '' },
    }
  }

  return {
    kind: 'widget',
    widget: { key: item.widget, title: item.title },
    config: item.config,
  }
}

/**
 * 项目编辑表单。
 *
 * 关键点：
 * - 组件类型下拉与"组件专属字段"都由注册表驱动 —— 新增一个组件只需注册，这里不用改代码。
 * - 项目类型只允许其注册表声明的内容种类。
 * - ⚠️ **不要给这个 Form 加 `preserve={false}`**（GroupForm 有，这里不能有）：
 *   切换组件类型时新类型的 `FormFields` 是全新挂载的，StrictMode 在 dev 下会把新挂载
 *   组件的 effect 跑两遍（挂载→清理→再挂载）；清理时 rc-field-form 发现 preserve 为
 *   false，就会把该字段的值从 store 里删掉 —— 判据是 `getInitialValue(namePath)`，
 *   而它读的是 Form 的 `initialValues`（这里始终是统计卡的默认配置），于是刚写进去的
 *   新类型默认值会被当成脏值清掉（PvP 的「显示下一个地图」就这么被清成了未勾选）。
 *   表单的"干净"由 `clearOnDestroy` + Modal 的 `destroyOnHidden` 保证，不靠这个属性。
 */
export function ItemForm({ form, formId, groupType, item, onFinish }: ItemFormProps): React.ReactNode {
  const widgetOptions = useMemo(() => listWidgetOptions(), [])
  const kindOptions = useMemo(() => allowedItemKinds(groupType), [groupType])
  const allowedKind = kindOptions[0]?.value ?? 'link'
  const initialValues = useMemo(() => buildInitialValues(item, allowedKind), [item, allowedKind])

  useEffect(() => {
    form.resetFields()
    form.setFieldsValue(initialValues)
  }, [form, initialValues])

  const handleFinish = (values: ItemFormValues): void => {
    // 紧凑分组里 kind 字段不渲染，缺省即视为网页导航
    const kind = canPlaceItem(groupType, values.kind ?? allowedKind) ? (values.kind ?? allowedKind) : allowedKind

    if (kind !== 'widget') {
      const name = values.link?.name?.trim() || '未命名网站'
      const link: LinkItem = {
        id: item?.id ?? createId(),
        kind: 'link',
        name,
        url: values.link?.url?.trim() || 'https://example.com',
        desc: values.link?.desc?.trim() || undefined,
        // 留空就保持留空：由卡片按网址走接口取站点图标，这里不要再塞首字母
        icon: values.link?.icon?.trim() || undefined,
      }
      onFinish(link)
      return
    }

    const key = values.widget?.key ?? 'stats'
    const spec = getWidget(key)
    const config = spec ? spec.normalizeConfig(values.config) : (values.config ?? {})
    const widget: WidgetItem = {
      id: item?.id ?? createId(),
      kind: 'widget',
      widget: key,
      title: values.widget?.title?.trim() || spec?.defaultTitle || '自定义组件',
      config: config as Record<string, unknown>,
    }
    onFinish(widget)
  }

  return (
    <Form<ItemFormValues>
      form={form}
      id={formId}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleFinish}
      clearOnDestroy
    >
      <Form.Item name="kind" initialValue={allowedKind} hidden>
        <Input />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, next) => prev.kind !== next.kind}>
        {({ getFieldValue }) =>
          getFieldValue('kind') === 'widget' ? (
            <WidgetSection widgetOptions={widgetOptions} />
          ) : (
            <LinkSection />
          )
        }
      </Form.Item>
    </Form>
  )
}

function LinkSection(): React.ReactNode {
  return (
    <>
      <Form.Item label="名称" name={['link', 'name']} rules={[{ required: true, message: '请输入名称' }]}>
        <Input placeholder="例如：最终幻想14 官网" maxLength={60} />
      </Form.Item>
      <Form.Item label="网址" name={['link', 'url']} rules={[{ required: true, message: '请输入网址' }]}>
        <Input placeholder="https://example.com" maxLength={2048} />
      </Form.Item>
      <Form.Item
        label="图标"
        name={['link', 'icon']}
        extra="填写图标链接或字符，留空则自动获取站点图标"
      >
        <Input placeholder="https://…/icon.png" maxLength={2048} />
      </Form.Item>
      <Form.Item label="描述" name={['link', 'desc']}>
        <Input placeholder="一句话说明" maxLength={120} />
      </Form.Item>
    </>
  )
}

function WidgetSection({ widgetOptions }: { widgetOptions: { label: string; value: string }[] }): React.ReactNode {
  const form = Form.useFormInstance()
  const rawKey = Form.useWatch<string | undefined>(['widget', 'key'], form)
  // initialValues 不会自动同步进 useWatch，因此缺省时回落到第一个已注册组件
  const currentKey = rawKey ?? widgetOptions[0]?.value
  const spec = currentKey ? getWidget(currentKey) : undefined

  return (
    <>
      <Form.Item label="组件类型" name={['widget', 'key']}>
        <Select
          options={widgetOptions}
          onChange={(nextKey: string) => {
            /*
             * 标题始终与组件类型保持一致：换类型就把标题重置成新类型的默认标题，
             */
            const next = getWidget(nextKey)
            form.setFieldValue(['widget', 'title'], next?.defaultTitle ?? '')
            /*
             * 配置也必须跟着换。新建时的 config 来自 `buildInitialValues` 里写死的
             * 统计卡默认值，不换的话新类型的字段会取到 undefined —— PvP 地图的
             * 「显示下一个地图」开关就显示成关，保存时才被 normalizeConfig 补成开，
             * 界面与实际落库的值对不上。
             * 传整个对象（而不是合并）是为了顺手丢掉上一个类型残留的字段。
             */
            form.setFieldValue('config', { ...(next?.defaultConfig ?? {}) })
          }}
        />
      </Form.Item>
      <Form.Item label="标题" name={['widget', 'title']}>
        <Input placeholder="自定义组件" maxLength={60} />
      </Form.Item>

      <Divider titlePlacement="start" plain>
        组件配置
      </Divider>

      {spec ? (
        <spec.FormFields />
      ) : (
        <Typography.Text type="warning">该组件类型未注册，无法编辑其配置。</Typography.Text>
      )}

      {spec ? (
        <div>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, lineHeight: 1.7 }}>
            {spec.description}
          </Typography.Text>
        </div>
      ) : null}

    </>
  )
}
