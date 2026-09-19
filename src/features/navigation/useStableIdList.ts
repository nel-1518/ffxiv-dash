import { useMemo } from 'react'

/** 拼接签名用的分隔符。id 由 `core/ids.ts` 生成，不含控制字符。 */
const ID_SEPARATOR = '\u0000'

/** 空列表的共享快照：必须复用同一个数组，不能每次新建（否则订阅方会一直"变了"）。 */
const EMPTY_IDS: string[] = []

/**
 * 把「`items.map(item => item.id)`」的**引用**稳住：id 序列没变就返回上一次那个数组。
 *
 * ⚠️ 这不是优化项，是 `dnd-kit` 的必需项。
 *
 * `SortableContext` 的 context value 依赖 `items` 的引用，而组件的渲染函数每次都会
 * 新建一个数组 —— context value 一变，组内**每一个** `useSortable` 消费者都会重渲染，
 * 把外层辛苦加的 `memo` 全部无视掉（React 的 context 传播不受 memo 拦截）。
 * 表现就是：点一下某张进度卡，同组其它卡片一起重渲染。
 *
 * 为什么不用 `useMemo(..., [items])`：只改配置时 reducer 也会重建那个分组的 `items`
 * 数组（数组里其它 item 的对象引用没变），按依赖引用判定仍然会换掉，必须按**内容**判定。
 *
 * 实现上先把 id 序列压成一个签名字符串，再**由签名反解**出数组：
 * `useMemo` 的依赖因此只有一个字符串，"签名相同 ⇒ 返回同一个数组引用"是显然成立的，
 * 也不会被 `exhaustive-deps` 误报。
 */
export function useStableIdList(items: readonly { id: string }[]): string[] {
  const signature = items.map((item) => item.id).join(ID_SEPARATOR)
  return useMemo(
    () => (signature === '' ? EMPTY_IDS : signature.split(ID_SEPARATOR)),
    [signature],
  )
}
