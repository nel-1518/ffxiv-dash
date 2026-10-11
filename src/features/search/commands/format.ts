/**
 * 命令结果的展示格式（纯常量，无 React）。
 *
 * 数字格式集中在这里，方便后续统一调整：界面显示走千分位，
 * 复制到剪贴板则用原始数字（见 `useLinkSearch`）—— 游戏里粘贴的是裸数字。
 */

/** 金币只显示整数：接口的价格带小数，小数点后几位没有意义。 */
export const gilFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 })
