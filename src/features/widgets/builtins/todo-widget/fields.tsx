/**
 * 待办卡的配置字段与渲染。
 *
 * 卡面两段：一行小字（刷新规则 + 完成进度）→ 待办列表。
 * 列表**按列填充**：先把第一列从上往下填满「卡片能显示的行数」，装不下才开第二列 ——
 * 所以待办变多时先是纵向延长，到顶之后才往右铺，而不是把卡片一直顶高。
 * 列装不下时才出现滚动条。
 *
 * 勾选状态按「卡片 id + 当前刷新窗口」归档在 `state.ts` 里，**不进 config**；
 * 窗口一变（过了刷新时刻）读出来就是空的，全部自动回到未完成态。
 */
import { useMemo, useState } from 'react'
import { Checkbox, Form, Input, Select, TimePicker } from 'antd'
import dayjs from 'dayjs'
import { useClockValue } from '../../../../core/clock/hooks.ts'
import {
  DEFAULT_TODO_CYCLE,
  MAX_TODO_ITEMS,
  TODO_DEFAULT_CONFIG,
  parseTodos,
} from './config.ts'
import { TODO_CYCLE_OPTIONS, formatRefreshLabel, windowKeyOf } from './schedule.ts'
import { readTodoDone, writeTodoDone } from './state.ts'
import type { TodoConfig } from './config.ts'
import type { TodoCycle } from './schedule.ts'
import type { WidgetRenderProps } from '../../types.ts'
import type { Dayjs } from 'dayjs'

function buildSummary(count: number, duplicates: number, overflow: number): string {
  if (count === 0 && duplicates === 0 && overflow === 0) {
    return '还没有待办：每行写一项，最多 20 项。'
  }
  const notes: string[] = []
  if (duplicates > 0) {
    notes.push(`${duplicates} 行重复`)
  }
  if (overflow > 0) {
    notes.push(`${overflow} 行超出上限`)
  }
  const head = `共 ${count} 项（上限 ${MAX_TODO_ITEMS} 项）`
  return notes.length === 0 ? `${head}。` : `${head}；${notes.join('、')}已忽略。`
}

export function TodoFormFields(): React.ReactNode {
  const form = Form.useFormInstance()
  /*
   * ⚠️ `useWatch` 拿不到 Form 的 `initialValues`（本仓有先例，见 `ItemForm` 的注释），
   * 所以两个字段都要回落到默认值，否则一打开弹窗就会显示成"没选周期 / 没有待办"。
   */
  const cycle = Form.useWatch<TodoCycle | undefined>(['config', 'cycle'], form) ?? DEFAULT_TODO_CYCLE
  const items = Form.useWatch<string | undefined>(['config', 'items'], form) ?? ''
  const parsed = useMemo(() => parseTodos(items), [items])

  return (
    <>
      <Form.Item
        label="刷新周期"
        name={['config', 'cycle']}
        extra="到点后所有待办自动重置为未完成。"
      >
        <Select options={TODO_CYCLE_OPTIONS} />
      </Form.Item>

      <Form.Item
        label="刷新时间"
        name={['config', 'time']}
        extra={
          cycle === 'none'
            ? '当前选的是「不刷新」，这个时刻不会生效。'
            : '按本机时间判定，可以直接输入精确值。'
        }
        /*
         * config 里存 `HH:mm` 字符串（要能原样进 localStorage），而 TimePicker 只吃 dayjs 对象 ——
         * 转换就地做在这条 Form.Item 的两端，与倒数日的 DatePicker 同一做法。
         */
        getValueProps={(value: string | undefined) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
        normalize={(value: Dayjs | null | undefined) => (value ? value.format('HH:mm') : TODO_DEFAULT_CONFIG.time)}
      >
        {/*
         * `minuteStep={5}` 只改面板里那一列的候选（0 / 5 / 10…），不限制手动输入，直接敲 17:23 仍然能提交。
         */}
        <TimePicker
          format="HH:mm"
          minuteStep={5}
          showNow={false}
          placeholder="16:00"
        />
      </Form.Item>

      <Form.Item
        label="待办事项"
        name={['config', 'items']}
        extra={buildSummary(parsed.items.length, parsed.duplicates, parsed.overflow)}
      >
        <Input.TextArea
          placeholder={'每行一项，例如：\n每周六仙人彩\n幻巧战\n刷满神典石'}
          autoSize={{ minRows: 6, maxRows: 14 }}
          spellCheck={false}
        />
      </Form.Item>
    </>
  )
}

/** 卡面渲染。 */
export function TodoRender({ config, item }: WidgetRenderProps<TodoConfig>): React.ReactNode {
  /*
   * 本卡唯一吃时钟的地方：快照是**当前刷新窗口的 id（字符串）**，
   * 因此只在跨过刷新时刻那一秒变一次；周期为「不刷新」时恒为 `'none'`，一次都不会重渲染。
   */
  const windowKey = useClockValue((now) => windowKeyOf(config.cycle, config.time, now))

  /*
   * 勾选状态只在本组件里改，用 local state 就够；初值从存储里读一次。
   * 窗口不匹配时 `readTodoDone` 已经返回空数组，这里不必再判断时间。
   */
  const [done, setDone] = useState(() => ({ key: windowKey, values: readTodoDone(item.id, windowKey) }))

  const parsed = useMemo(() => parseTodos(config.items), [config.items])

  // 窗口变了 = 过了刷新时刻：这份勾选整体作废，连存储都不用读
  const active = done.key === windowKey ? done.values : []
  const doneSet = new Set(active)
  const completed = parsed.items.filter((line) => doneSet.has(line))

  const toggle = (line: string, checked: boolean): void => {
    const next = checked ? [...completed, line] : completed.filter((value) => value !== line)
    setDone({ key: windowKey, values: next })
    writeTodoDone(item.id, windowKey, next)
  }

  const refreshLabel = formatRefreshLabel(config.cycle, config.time)
  const allDone = parsed.items.length > 0 && completed.length === parsed.items.length
  const progressLabel = parsed.items.length === completed.length
    ? '已全部完成'
    : `已完成 ${completed.length} / ${parsed.items.length}`

  if (parsed.items.length === 0) {
    return <div className="dash-todo-empty">还没有待办，请在编辑弹窗里填写。</div>
  }

  return (
    <div className="dash-card-fill dash-todo">
      {/* 两端对齐的一行小字：左边刷新规则（窄卡里先省略），右边完成进度（悬停放全文） */}
      <div className="dash-todo-meta" title={`${refreshLabel} · ${progressLabel}`}>
        <span className="dash-todo-rule">{refreshLabel}</span>
        {/* 全部完成时这个读数转强调色 */}
        <span className={`dash-todo-progress${allDone ? ' is-complete' : ''}`}>{progressLabel}</span>
      </div>

      <div className="dash-todo-scroll">
        <div className="dash-todo-list">
          {/* 顺序永远是填写顺序：勾选**不改变位置**，只变色加删除线 */}
          {parsed.items.map((line) => {
            const isDone = doneSet.has(line)
            return (
              <div key={line} className={`dash-todo-item${isDone ? ' is-done' : ''}`}>
                <Checkbox
                  className="dash-todo-check"
                  checked={isDone}
                  onChange={(event) => toggle(line, event.target.checked)}
                >
                  {/* 列宽已经由网格定住，超长只省略（悬停看全文） */}
                  <span className="dash-todo-text" title={line}>
                    {line}
                  </span>
                </Checkbox>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
