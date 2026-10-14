/**
 * `/t` 税率计算命令（纯逻辑，无 React）。输入标价 P，列出五种含税价格。
 * 税率模型（买卖双方都收税）：买入税固定 5%，卖出按城市分 5% / 3%：买入实付 = P×1.05、
 * 卖出到手 = P×0.95 / P×0.97、保本卖出价 = P×1.05÷0.95 或 P×1.05÷0.97。
 * 取整：保本卖出价向上取整（向下取整会亏），其余四舍五入到整数金币。
 * 每行都是 copy 动作：界面显示千分位金额，复制裸数字。
 */

import { gilFormat } from './format.ts'
import type { ActionRow, SlashCommand } from './types.ts'

/** 各档税率系数，集中在这里方便调整。买入税只有 5% 一档。 */
const BUY_TAX = 1.05
const SELL_TAX_5 = 0.95
const SELL_TAX_3 = 0.97

/** 解析价格：允许千分位逗号与空格（常从别处粘贴「1,000」），只接受正的十进制数，其余返回 null。 */
function parseAmount(query: string): number | null {
  const text = query.trim().replace(/[,\s]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** 一条税率结果：显示千分位金额，复制裸数字。 */
function amountRow(key: string, title: string, value: number): ActionRow {
  return {
    key,
    kind: 'action',
    title,
    note: gilFormat.format(value),
    run: { type: 'copy', text: String(value) },
  }
}

export const taxCommand: SlashCommand = {
  key: 't',
  placeholder: '输入价格数字，计算含税价格…',
  hint: '输入价格（如 325,000），列出买入、卖出与不亏损的含税价格',
  resultTitle: '税率计算结果',
  buildRows(query) {
    const price = parseAmount(query)
    if (price === null) {
      return []
    }
    return [
      amountRow('tax:buy-5', '买入实付（含 5% 税）', Math.round(price * BUY_TAX)),
      amountRow('tax:sell-5', '卖出到手（扣 5% 税）', Math.round(price * SELL_TAX_5)),
      amountRow('tax:sell-3', '卖出到手（扣 3% 税）', Math.round(price * SELL_TAX_3)),
      amountRow('tax:even-5', '保本卖出价（买入 5% 税、卖出 5% 税）', Math.ceil((price * BUY_TAX) / SELL_TAX_5)),
      amountRow('tax:even-3', '保本卖出价（买入 5% 税、卖出 3% 税）', Math.ceil((price * BUY_TAX) / SELL_TAX_3)),
    ]
  },
  notice(query, rowCount) {
    // 还没输入 → 交给通用 hint；输入了但算不出结果 → 提示数字不合法
    if (query.trim() === '') {
      return null
    }
    return rowCount === 0 ? '请输入有效的价格数字' : null
  },
}
