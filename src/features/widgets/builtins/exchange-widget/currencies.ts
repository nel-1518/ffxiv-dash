/**
 * 汇率卡支持的货币表（纯数据，无 React）。
 *
 * Frankfurter v2 实际支持两百多种货币，但选择器里塞两百项没人翻得动 ——
 * 这里按「日常用得上」的口径精选三十来种，人民币 / 日元置顶（默认货币对）。
 * 想加品种就往表里补一行：代码必须在 Frankfurter 支持之列
 * （完整列表见 https://api.frankfurter.dev/v2/currencies ，写一个不支持的代码这张卡就永远取不到数）。
 */
export type CurrencyInfo = {
  /** ISO 4217 代码，也是接口要的参数。 */
  code: string
  /** 中文名（选择器里显示成 `CNY 人民币`）。 */
  label: string
}

export const EXCHANGE_CURRENCIES: CurrencyInfo[] = [
  { code: 'CNY', label: '人民币' },
  { code: 'JPY', label: '日元' },
  { code: 'USD', label: '美元' },
  { code: 'EUR', label: '欧元' },
  { code: 'GBP', label: '英镑' },
  { code: 'HKD', label: '港币' },
  { code: 'TWD', label: '新台币' },
  { code: 'KRW', label: '韩元' },
  { code: 'SGD', label: '新加坡元' },
  { code: 'AUD', label: '澳元' },
  { code: 'CAD', label: '加元' },
  { code: 'CHF', label: '瑞士法郎' },
  { code: 'THB', label: '泰铢' },
  { code: 'MYR', label: '林吉特' },
  { code: 'PHP', label: '菲律宾比索' },
  { code: 'IDR', label: '印度尼西亚卢比' },
  { code: 'VND', label: '越南盾' },
  { code: 'INR', label: '印度卢比' },
  { code: 'RUB', label: '卢布' },
  { code: 'TRY', label: '土耳其里拉' },
  { code: 'BRL', label: '雷亚尔' },
  { code: 'MXN', label: '墨西哥比索' },
  { code: 'NZD', label: '新西兰元' },
  { code: 'SEK', label: '瑞典克朗' },
  { code: 'NOK', label: '挪威克朗' },
  { code: 'DKK', label: '丹麦克朗' },
  { code: 'PLN', label: '兹罗提' },
  { code: 'CZK', label: '捷克克朗' },
  { code: 'HUF', label: '福林' },
  { code: 'ILS', label: '谢克尔' },
  { code: 'ZAR', label: '兰特' },
]

const CODES: ReadonlySet<string> = new Set(EXCHANGE_CURRENCIES.map((item) => item.code))

/** 是否是本表支持的货币代码（大小写不敏感）。 */
export function isCurrencyCode(code: unknown): boolean {
  return typeof code === 'string' && CODES.has(code.toUpperCase())
}

/** 编辑弹窗里的货币选项（`CNY 人民币`，label 给搜索过滤用）。 */
export function currencyOptions(): { value: string; label: string }[] {
  return EXCHANGE_CURRENCIES.map((item) => ({ value: item.code, label: `${item.code} ${item.label}` }))
}
