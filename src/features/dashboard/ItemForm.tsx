import { useEffect, useMemo } from 'react'
import { Checkbox, Divider, Flex, Form, Input, Select, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { createId } from '../../core/ids.ts'
import { getWidget, listWidgets } from '../widgets/registry.ts'
import { canPlaceItem, countWidgetInstances } from '../../core/group-rules.ts'
import { maxCountOf } from '../widgets/types.ts'
import { allowedItemKinds } from '../groups/group-types.ts'
import { useBoardDoc } from '../../state/hooks.ts'
import {
  LINK_ABBREVIATION_PATTERN,
  MAX_LINK_ABBREVIATION_LENGTH,
} from '../../core/storage/types.ts'
import type { GroupType, Item, ItemKind, LinkItem, WidgetItem } from '../../core/storage/types.ts'

/**
 * 链接字段的三种排版。
 *
 * - `url-only`：新建链接的第一步 —— 只有网址，右侧带「自动获取数据」开关；
 * - `url-first`：自动获取成功后 —— 网址在最上，名称 / 图标 / 描述在其下方；
 * - `default`：编辑已有链接（当前与 `url-first` 同序）。
 */
export type LinkFormLayout = 'url-only' | 'url-first' | 'default'

/** 描述输入框的字数上限（比落盘上限小，元数据回填时要按这个切一刀）。 */
export const MAX_LINK_DESC_INPUT_LENGTH = 120

/** 表单里的扁平结构：组件自身字段放 config。 */
export type ItemFormValues = {
  kind: ItemKind
  link?: { name?: string; icon?: string; url?: string; desc?: string; abbreviation?: string }
  /** 组件已不再支持自定义标题：表单里没有 title 字段，保存时统一取类型的 defaultTitle。 */
  widget?: { key?: string }
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
  /** 链接字段的排版，见 `LinkFormLayout`。 */
  linkLayout?: LinkFormLayout
  /** 「自动获取数据」开关的状态（仅 `url-only` 排版渲染它）。 */
  autoFetch?: boolean
  onAutoFetchChange?: (checked: boolean) => void
  /** 元数据请求进行中：禁用输入，避免用户改了网址又拿到上一版的回填。 */
  loading?: boolean
}

function buildInitialValues(
  item: Item | undefined,
  defaultKind: ItemKind,
  defaultWidgetKey: string,
): ItemFormValues {
  if (!item) {
    const spec = getWidget(defaultWidgetKey)
    return {
      kind: defaultKind,
      link: { name: '', icon: '', url: '', desc: '', abbreviation: '' },
      widget: { key: spec?.key ?? defaultWidgetKey },
      config: spec?.defaultConfig ?? {},
    }
  }

  if (item.kind === 'link') {
    return {
      kind: 'link',
      link: {
        name: item.name,
        icon: item.icon ?? '',
        url: item.url,
        desc: item.desc ?? '',
        abbreviation: item.abbreviation ?? '',
      },
    }
  }

  return {
    kind: 'widget',
    widget: { key: item.widget },
    config: item.config,
  }
}

/**
 * 卡片编辑表单。
 *
 * - 组件类型下拉与"组件专属字段"都由注册表驱动 —— 新增一个组件只需注册，这里不用改。
 * - ⚠️ 不要给这个 Form 加 `preserve={false}`（GroupForm 有，这里不能有）：
 *   切换组件类型时新类型的 `FormFields` 全新挂载，StrictMode 在 dev 下会把新挂载组件的
 *   effect 跑两遍；清理时 rc-field-form 发现 preserve 为 false，会按 `getInitialValue(namePath)`
 *   （读的是 Form 的 `initialValues`，即新建时的默认配置）把刚写进字段的新类型默认值
 *   当成脏值清掉。表单的"干净"由 `clearOnDestroy` + Modal 的 `destroyOnHidden` 保证。
 */
export function ItemForm({
  form,
  formId,
  groupType,
  item,
  onFinish,
  linkLayout = 'default',
  autoFetch = false,
  onAutoFetchChange,
  loading = false,
}: ItemFormProps): React.ReactNode {
  const doc = useBoardDoc()
  /*
   * 组件类型选项：达到实例上限（全局计数，缺省 20，见 `widgets/types.ts`）的类型禁用并标注，
   * 但当前正在编辑的实例自己的类型保持可选 —— 否则已存在的卡片连配置都改不了。
   */
  const widgetOptions = useMemo(() => {
    const currentKey = item?.kind === 'widget' ? item.widget : undefined
    return listWidgets().map((spec) => {
      const count = countWidgetInstances(doc, spec.key)
      const max = maxCountOf(spec.maxCount)
      const disabled = count >= max && spec.key !== currentKey
      return {
        label: disabled ? `${spec.label}（已达上限 ${count}/${max}）` : spec.label,
        value: spec.key,
        disabled,
      }
    })
  }, [doc, item])
  const kindOptions = useMemo(() => allowedItemKinds(groupType), [groupType])
  const allowedKind = kindOptions[0]?.value ?? 'link'
  /*
   * 新建时的默认组件类型：偏好 pvp-map，但它已达上限时退回第一个还可选的类型，
   * 避免表单初始值就是被禁用的选项、保存时被 reducer 拒掉。
   */
  const defaultWidgetKey = useMemo(() => {
    if (item) {
      return item.kind === 'widget' ? item.widget : ''
    }
    const preferred = getWidget('pvp-map')?.key ?? widgetOptions[0]?.value ?? 'pvp-map'
    const preferredOption = widgetOptions.find((entry) => entry.value === preferred)
    if (preferredOption && !preferredOption.disabled) {
      return preferred
    }
    return widgetOptions.find((entry) => !entry.disabled)?.value ?? preferred
  }, [item, widgetOptions])
  const initialValues = useMemo(
    () => buildInitialValues(item, allowedKind, defaultWidgetKey),
    [item, allowedKind, defaultWidgetKey],
  )

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
        // 留空就保持留空：卡片会用名称首字 + `core/pastel.ts` 的 pastel 底色，这里不要塞首字母
        icon: values.link?.icon?.trim() || undefined,
        // 合法性由字段校验拦在提交前，这里只把空串收成"没设"
        abbreviation: values.link?.abbreviation || undefined,
      }
      onFinish(link)
      return
    }

    const key = values.widget?.key ?? 'pvp-map'
    const spec = getWidget(key)
    const config = spec ? spec.normalizeConfig(values.config) : (values.config ?? {})
    const widget: WidgetItem = {
      id: item?.id ?? createId(),
      kind: 'widget',
      widget: key,
      /*
       * 标题不由用户填写，统一取组件类型的默认标题（落盘仍保留 title 字段：
       * 删除确认、番茄钟通知等还在用它）。
       */
      title: spec?.defaultTitle || '自定义组件',
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
      {/*
        `kind` 的初始值由 Form 的 `initialValues` 给（`buildInitialValues` 一定写 `kind`）。
        ⚠️ 不要再写字段级 `initialValue`：与同路径的 Form `initialValues` 冲突时 antd 会告警，
        且字段级的值会被丢弃。
      */}
      <Form.Item name="kind" hidden>
        <Input />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, next) => prev.kind !== next.kind}>
        {({ getFieldValue }) =>
          getFieldValue('kind') === 'widget' ? (
            <WidgetSection widgetOptions={widgetOptions} />
          ) : (
            <LinkSection
              layout={linkLayout}
              autoFetch={autoFetch}
              onAutoFetchChange={onAutoFetchChange}
              loading={loading}
            />
          )
        }
      </Form.Item>
    </Form>
  )
}

function LinkSection({ layout, autoFetch, onAutoFetchChange, loading }: {
  layout: LinkFormLayout
  autoFetch: boolean
  onAutoFetchChange: ((checked: boolean) => void) | undefined
  loading: boolean
}): React.ReactNode {
  const name = (
    <Form.Item label="名称" name={['link', 'name']} rules={[{ required: true, message: '请输入名称' }]}>
      <Input placeholder="例如：最终幻想14 官网" maxLength={60} disabled={loading} />
    </Form.Item>
  )
  const url = (
    <Form.Item label="网址" name={['link', 'url']} rules={[{ required: true, message: '请输入网址' }]}>
      <Input placeholder="https://example.com" maxLength={2048} disabled={loading} />
    </Form.Item>
  )
  const abbreviation = (
    <Form.Item
      label="缩写"
      name={['link', 'abbreviation']}
      extra={`填写字母或数字，最多 ${MAX_LINK_ABBREVIATION_LENGTH} 个，可留空，搜索时会优先匹配它。`}
      rules={[
        {
          // 空值合法（就是不设）；非空必须是纯字母数字
          validator: (_rule, value: unknown) =>
            value === undefined || value === '' || (typeof value === 'string' && LINK_ABBREVIATION_PATTERN.test(value))
              ? Promise.resolve()
              : Promise.reject(new Error('缩写只能包含字母或数字')),
        },
      ]}
    >
      <Input placeholder="例如：FF14" maxLength={MAX_LINK_ABBREVIATION_LENGTH} disabled={loading} />
    </Form.Item>
  )
  const icon = (
    <Form.Item
      label="图标"
      name={['link', 'icon']}
      extra="图片链接或字符；留空则显示名称首字 + 自动底色"
    >
      <Input placeholder="https://…/icon.png" maxLength={2048} disabled={loading} />
    </Form.Item>
  )
  const desc = (
    <Form.Item label="描述" name={['link', 'desc']}>
      <Input placeholder="一句话说明" maxLength={MAX_LINK_DESC_INPUT_LENGTH} disabled={loading} />
    </Form.Item>
  )

  if (layout === 'url-only') {
    return (
      <>
        {/*
          网址与「自动获取数据」同一行：网址是这一步唯一要填的东西，
          开关贴在它右边，默认勾选（由 `EditDialog` 给初值）。
          因为是自绘的行头，输入框要自己挂 `aria-label`。
        */}
        <Flex align="center" justify="space-between" gap={12} style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 14, lineHeight: '22px' }}>网址</span>
          <Checkbox
            checked={autoFetch}
            disabled={loading}
            onChange={(event) => onAutoFetchChange?.(event.target.checked)}
          >
            自动获取数据
          </Checkbox>
        </Flex>
        <Form.Item name={['link', 'url']} rules={[{ required: true, message: '请输入网址' }]} style={{ marginBottom: 0 }}>
          <Input placeholder="https://example.com" maxLength={2048} aria-label="网址" disabled={loading} />
        </Form.Item>
      </>
    )
  }

  // `url-first`：刚用网址换回元数据，网址留在原处、其余字段出现在它下方
  return layout === 'url-first' ? (
    <>
      {url}
      {name}
      {abbreviation}
      {icon}
      {desc}
    </>
  ) : (
    <>
      {url}
      {name}
      {abbreviation}
      {icon}
      {desc}
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
             * 配置必须跟着类型换：不换的话新类型的字段会取到 undefined，界面显示的值
             * 与保存时 normalizeConfig 补出来的值对不上。
             * 传整个对象（而不是合并）是为了顺手丢掉上一个类型残留的字段。
             */
            const next = getWidget(nextKey)
            form.setFieldValue('config', { ...(next?.defaultConfig ?? {}) })
          }}
        />
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
