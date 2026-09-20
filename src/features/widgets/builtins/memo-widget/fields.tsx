/**
 * 备忘卡的配置字段与渲染。
 *
 * 卡面只有一段正文：默认按 markdown 渲染（`.dash-note-md`），**双击正文**原地换成
 * 编辑原始文本的输入框；失焦或 `Ctrl/Cmd+Enter` 落库，`Esc` 放弃本次改动。
 * 高度沿用 `.dash-card-fill` 的 164px 上限（与待办卡同一套预算），长文只在卡内滚动，
 * 不会把同行的卡片撑高。
 *
 * 编辑态是组件自己的 local state（与看板是否处于编辑模式无关）：双击进编辑、草稿存字符串，
 * 这个形状与统计卡的读数编辑一致。
 */
import { useMemo, useRef, useState } from 'react'
import { Form, Input } from 'antd'
import { boardActions } from '../../../../state/board-store.ts'
import { MAX_MEMO_TEXT_LENGTH, MEMO_DEFAULT_CONFIG } from './config.ts'
import { renderMemoHtml } from './markdown.ts'
import type { MemoConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

function buildSummary(length: number): string {
  if (length === 0) {
    return ''
  }
  return `共 ${length} 字符（上限 ${MAX_MEMO_TEXT_LENGTH}）。`
}

export function MemoFormFields(): React.ReactNode {
  const form = Form.useFormInstance()
  /*
   * ⚠️ `useWatch` 拿不到 Form 的 `initialValues`（本仓有先例，见 `ItemForm` 的注释），
   * 所以这里必须回落到默认值，否则一打开弹窗就会把已有内容显示成空。
   */
  const text = Form.useWatch<string | undefined>(['config', 'text'], form) ?? MEMO_DEFAULT_CONFIG.text

  return (
    <Form.Item label="内容" name={['config', 'text']} extra={buildSummary(text.length)}>
      <Input.TextArea
        placeholder={
          '将可能忘记的事记下来，提醒下次打开页面的自己。\n' +
          '支持 Markdown 语法：标题、列表、表格、代码块、引用、链接…\n' +
          '但不支持图片，只显示替代文字。'
        }
        autoSize={{ minRows: 8, maxRows: 18 }}
        spellCheck={false}
      />
    </Form.Item>
  )
}

/** 卡面渲染。 */
export function MemoRender({ config, item }: WidgetRenderProps<MemoConfig>): React.ReactNode {
  /**
   * 编辑态：`null` = 渲染 markdown；字符串 = 正在编辑的原文。
   * 用字符串而不是布尔量，是为了让草稿与"已保存的原文"随时都分得清。
   */
  const [draft, setDraft] = useState<string | null>(null)
  /**
   * 本次编辑是否已经收尾（提交或取消过）。
   *
   * 一个编辑会话里 `commit` 可能被叫两次：`Ctrl+Enter` 提交后输入框随即卸载，
   * 而浏览器有可能再补一次 blur。用它把第二次挡住，保证一次编辑至多写一次盘。
   * 进入编辑时必须重置 —— 否则上一次的 `Esc` 会让下一次输入静默不保存。
   */
  const settled = useRef(false)

  const html = useMemo(() => renderMemoHtml(config.text), [config.text])

  const startEdit = (): void => {
    settled.current = false
    setDraft(config.text)
  }

  const commit = (): void => {
    if (settled.current) {
      return
    }
    settled.current = true
    const next = draft
    setDraft(null)
    if (next === null) {
      return
    }
    // 与归一化同一把尺子：行内编辑走的是 boardActions，不经过 normalizeConfig
    const clamped = next.length > MAX_MEMO_TEXT_LENGTH ? next.slice(0, MAX_MEMO_TEXT_LENGTH) : next
    /*
     * 只有真的改了才落库：写入会替换这条 item 的引用、连带重渲染整张卡片，
     * 没必要为"点开又原样退出"付这笔账。
     */
    if (clamped !== config.text) {
      boardActions.updateItemConfig(item.id, { text: clamped })
    }
  }

  const cancel = (): void => {
    settled.current = true
    setDraft(null)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // 输入法组字中不响应：这时 `Esc` 通常是"取消候选词"，`Enter` 是"上屏"
    if (event.nativeEvent.isComposing) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      commit()
    }
  }

  if (draft !== null) {
    return (
      /*
       * 编辑态**不套** `.dash-note-scroll`：输入框自己就是唯一的滚动容器（见 global.css 的 `.dash-note--editing`）。
       *
       * ⚠️ 这里刻意**不用** antd 的 `autoSize`：它的高度是"测量"出来的，而测量可能发生在布局还没定下来的那一刻 ——
       * 实测刚进编辑态时量到 795.6px，而按最终宽度排完需要 1402px（差 600 多像素），于是输入框自己
       * 变成第二个滚动容器：滚轮先滚它（文字在动、卡片右边那根滚动条纹丝不动），滚完这一大段才轮到外层。
       * 高度写死之后，"文本比卡片长"这件事只由输入框一个人负责，行为与文本长短无关。
       */
      <div className="dash-card-fill dash-note dash-note--editing">
        <Input.TextArea
          className="dash-note-input"
          value={draft}
          autoFocus
          spellCheck={false}
          placeholder="写点什么，支持 Markdown 语法"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label="备忘内容"
        />
      </div>
    )
  }

  if (config.text.trim() === '') {
    return (
      <div className="dash-note-empty" title="双击编辑" onDoubleClick={startEdit}>
        写点什么，双击开始编辑。
      </div>
    )
  }

  return (
    <div className="dash-card-fill dash-note">
      <div className="dash-note-scroll">
        {/*
         * 双击提示有两半：这里的原生 `title`（悬停出系统提示）与 CSS 里的 `cursor: text`。
         * 刻意不用 antd Tooltip —— 卡片上每多一台 rc-trigger 机器，拖拽期间都要跟着 dnd-kit 的
         * context 一起重渲染（见 global.css 里 `.dash-note-md` 的注释）。
         */}
        <div
          className="dash-note-md"
          title="双击编辑"
          onDoubleClick={startEdit}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
