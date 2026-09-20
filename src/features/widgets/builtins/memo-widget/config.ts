/**
 * 备忘卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * config 里只放用户写的**原文**：它要能原样进 localStorage、原样回显在输入框里，
 * 也要跟着看板一起导出。备忘与待办卡的「勾选」不同 —— 那是每天会被清掉的临时状态
 * （所以单独落一个键），而备忘内容本身是用户数据，就应该住在 config 里。
 */

export type MemoConfig = {
  /** markdown 原文，卡片按 GFM 渲染，双击正文时按原文编辑。 */
  text: string
}

export const MEMO_DEFAULT_CONFIG: MemoConfig = {
  text: '',
}

/**
 * 原文长度上限。
 *
 * 防呆而不是业务限制：正文存的是原文（输入框要能原样回显），它会进 localStorage、
 * 进导出的看板文件，也会在每次落盘时被整份序列化一遍。正常人写的便签远到不了这个数，
 * 它挡的是"整篇小说粘进来"。
 */
export const MAX_MEMO_TEXT_LENGTH = 2000

export function normalizeMemoConfig(raw: unknown): MemoConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const rawText = typeof source.text === 'string' ? source.text : ''

  // 只按上限切一刀：换行、缩进、行尾空格都以原样保留，否则输入框回显的与用户写的不一致
  return {
    text: rawText.length > MAX_MEMO_TEXT_LENGTH ? rawText.slice(0, MAX_MEMO_TEXT_LENGTH) : rawText,
  }
}
