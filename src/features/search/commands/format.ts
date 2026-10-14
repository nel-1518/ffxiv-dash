/** 命令结果展示格式（纯常量，无 React）：界面显示千分位、复制到剪贴板用原始数字（见 useLinkSearch）—— 游戏里粘贴裸数字；金币只显示整数，接口价格的小数没有意义。 */
export const gilFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 })
