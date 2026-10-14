/**
 * 搜索弹窗「斜杠命令」的类型骨架（纯类型，无副作用）。命令 = 输入框里以 `/` 开头的关键词前缀
 * （如 `/t `、`/i `），命中后弹窗不再显示链接与引擎，整块结果区交给该命令构建的行。
 * 新增命令：写一个 SlashCommand 模块，再到 index.ts 注册表追加，弹窗与状态中枢零改动。
 */

/** 一次物品检索命中的条目（来自 XIVAPI v2 搜索接口）。 */
export type ItemHit = {
  /** 物品 ID（接口的 `row_id`）。 */
  id: number
  name: string
  /** 不可交易：市场买不到也卖不掉。 */
  untradable: boolean
}

  /** 动作行的执行语义：命令只声明，执行统一交给状态中枢（useLinkSearch.handleSelect）——
   *  对所有命令是同一条路径，新增动作既不碰弹窗也不碰状态中枢。 */
export type ActionRun =
  | { type: 'copy'; text: string }
  | { type: 'open'; url: string }
  /** 把文本填进搜索框（用于「选一条命令」这类把查询串补全的动作）。 */
  | { type: 'fill'; text: string }

/** 动作行：可「执行」的一行（税率结果、物品的复制 / 打开动作），具体行为看 `run.type`。 */
export type ActionRow = {
  key: string
  kind: 'action'
  /** 动作说明，如「买入价格（+5%）」「复制物品 ID」。 */
  title: string
  /** 行右侧附注（复制行显示将复制的内容，如 `1,050`、`#12345`）；不需要就不渲染。 */
  note?: string
  run: ActionRun
}

/** 物品结果行：本身可钻取 —— 命令提供 `buildActions` 时选中即进入该物品的动作面板。 */
export type ItemRow = {
  key: string
  kind: 'item'
  title: string
  item: ItemHit
}

/** 命令能产出的行。 */
export type CommandRow = ActionRow | ItemRow

/** 一个斜杠命令的定义。 */
export type SlashCommand = {
  /** 触发前缀（不含斜杠），如 `'t'` 对应输入 `/t `。匹配时大小写不敏感。 */
  key: string
  /** 输入框占位文案（命令模式下替换默认的「搜索已保存的链接…」）。 */
  placeholder: string
  /** 空态提示：还没输入查询内容时提示用户该输入什么。 */
  hint: string
  /** 结果区分段标题（如「税率计算结果」「匹配的物品」）。 */
  resultTitle: string
  /** 同步结果（纯函数）。与 `loadRows` 二选一。 */
  buildRows?(query: string): CommandRow[]
  /** 异步检索（可选）。存在时以它为准、`buildRows` 不再参与；
   *  防抖 / 取消 / 乱序判废由状态中枢统一处理（见 useLinkSearch），远程命令不必各写一遍。 */
  loadRows?(query: string, signal: AbortSignal): Promise<CommandRow[]>
  /** 二级结果（可选）：对某条结果行展开的动作面板（钻取）；空数组 = 不可钻取，一层选物品→二层动作不要求中枢了解具体命令。 */
  buildActions?(row: CommandRow): ActionRow[]
  /** 无结果 / 特殊状态提示（可选），返回 null 回退 hint；各命令「没有结果」含义不同，只有命令自己说得清。 */
  notice?(query: string, rowCount: number): string | null
}

/** 弹窗当前所处的模式。 */
export type SearchMode =
  | { kind: 'links' }
  | { kind: 'command'; command: SlashCommand; query: string }
