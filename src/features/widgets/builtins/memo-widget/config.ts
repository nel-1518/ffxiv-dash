/**
 * 备忘卡的配置类型、默认值与归一化（纯数据，无组件）。
 *
 * config 里只放用户写的原文：要能原样进 localStorage、原样回显在输入框、跟着看板一起导出。
 * 备忘内容是用户数据，住在 config 里；与待办卡每日清零的临时状态（单独落键）不同。
 */

export type MemoConfig = {
  /** markdown 原文，卡片按 GFM 渲染，双击正文时按原文编辑。 */
  text: string
}

export const MEMO_DEFAULT_CONFIG: MemoConfig = {
  text: '',
}

/**
 * 原文长度上限。防呆而非业务限制：正文会进 localStorage、进导出文件、每次落盘整份序列化，
 * 挡的是「整篇小说粘进来」。
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
