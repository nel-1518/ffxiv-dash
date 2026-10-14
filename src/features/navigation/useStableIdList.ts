import { useMemo } from 'react'

/** 拼接签名用的分隔符。id 由 `core/ids.ts` 生成，不含控制字符。 */
const ID_SEPARATOR = '\u0000'

/** 空列表的共享快照：必须复用同一数组，不能每次新建（否则 `Object.is` 比对会一直「变了」）。 */
const EMPTY_IDS: string[] = []

/**
 * 把「`items.map(item => item.id)`」的**引用**稳住：id 序列没变就返回上一次那个数组。
 * ⚠️ dnd-kit 必需项：SortableContext 的 context value 依赖 items 引用，渲染期新建数组会让组内
 * 每个 useSortable 消费者重渲染（context 传播不受 memo 拦截，外层 memo 全部失效）；须按内容判定、
 * 不能用 useMemo([items])——只改配置时 reducer 也会重建 items 数组，按依赖引用判定仍然会换掉。
 * 实现上由「签名反解出数组」：useMemo 依赖只有一个字符串，「签名相同 ⇒ 同一数组引用」显然成立，
 * 也不会被 exhaustive-deps 误报。
 */
export function useStableIdList(items: readonly { id: string }[]): string[] {
  const signature = items.map((item) => item.id).join(ID_SEPARATOR)
  return useMemo(
    () => (signature === '' ? EMPTY_IDS : signature.split(ID_SEPARATOR)),
    [signature],
  )
}
