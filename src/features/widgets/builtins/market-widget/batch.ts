/**
 * 同区服请求合并器（纯逻辑，无 React）。
 *
 * **要解决的问题**：看板上可以摆多张「物品价格」卡片，每张卡查的物品 / 区服各不相同。
 * 早先每张卡各调一次 `fetchMarket`，于是同一次进网页会打出 N 个请求 —— 而 Universalis 的
 * 聚合接口 `.../{itemIds}` 的 itemIds 本来就是**逗号分隔的多个物品**，一次就能查好几个。
 *
 * **做法**：把「这一轮要查什么」先收集起来，等当前这一批挂载结束后，按区服分组、把物品 id
 * 求并集，每个区服只发一次真请求，再把批量结果**按订阅者过滤**分回各张卡。
 *
 * 收集窗口取一个宏任务边界（`setTimeout(flush, 0)`）即可：同一轮 commit 里各卡片的挂载
 * effect 是同步依次执行的，全都落在同一个宏任务里；多出来的延迟只有一个 tick，
 * 影响不到首屏（数据本来就要等网络）。
 *
 * ⚠️ 不同区服**没法合并进同一个请求** —— 接口 URL 按 scope 分段（`/aggregated/{scope}/...`），
 * 所以分组是必须的：同 scope 合一，不同 scope 各发各的。
 */

import { fetchMarket } from './universalis.ts'
import { writeMarketCache } from './cache.ts'
import type { MarketData } from './universalis.ts'

/** 一个等待结果的订阅者：记着它要哪些物品，并留好结果的出口。 */
type Subscriber = {
  itemIds: number[]
  resolve: (data: MarketData) => void
  reject: (error: unknown) => void
}

/**
 * 待发队列：区服 → 这一轮向它订阅的所有卡片。
 *
 * flush 一开始就整体取走并清空（见 `flush`），所以「正在发送」期间新来的订阅会**自然落进
 * 下一批**，不会被这一批吞掉、也不会漏发。
 */
const pending = new Map<string, Subscriber[]>()

/** 是否已经安排了 flush。避免同一轮里每来一个订阅就排一个定时器。 */
let flushScheduled = false

/**
 * 请求某个区服下这些物品的价格。
 *
 * 与 `fetchMarket` 的差别只有一个：**不是立刻发请求**，而是先登记，
 * 等同一轮的其它卡片到齐后合并成一次请求。返回的 Promise 只会拿到
 * 「本订阅者请求的那几个物品」的数据，形状与 `fetchMarket` 完全一致，
 * 卡片侧因此不需要任何适配。
 */
export function requestMarket(scope: string, itemIds: number[]): Promise<MarketData> {
  return new Promise<MarketData>((resolve, reject) => {
    const subscribers = pending.get(scope)
    if (subscribers) {
      subscribers.push({ itemIds, resolve, reject })
    } else {
      pending.set(scope, [{ itemIds, resolve, reject }])
    }
    scheduleFlush()
  })
}

function scheduleFlush(): void {
  if (flushScheduled) {
    return
  }
  flushScheduled = true
  setTimeout(flush, 0)
}

/** 取出这一轮的订阅，按区服逐个合并发送。 */
function flush(): void {
  flushScheduled = false
  // 先整体摘走再发送：发送过程中新到的订阅（若有）归入下一轮
  const batches = [...pending.entries()]
  pending.clear()

  for (const [scope, subscribers] of batches) {
    void runBatch(scope, subscribers)
  }
}

/** 多个订阅者的物品 id 求并集去重（顺序按首次出现，便于日志/缓存可读）。 */
function unionItemIds(subscribers: Subscriber[]): number[] {
  const union: number[] = []
  for (const subscriber of subscribers) {
    for (const id of subscriber.itemIds) {
      if (!union.includes(id)) {
        union.push(id)
      }
    }
  }
  return union
}

/** 从批量结果里切出某个订阅者要的那几个物品。 */
function sliceFor(itemIds: number[], result: MarketData): MarketData {
  const wanted = new Set(itemIds)
  return {
    scope: result.scope,
    itemIds: [...itemIds],
    items: result.items.filter((item) => wanted.has(item.itemId)),
    failedItems: result.failedItems.filter((id) => wanted.has(id)),
    // 时间统一取这一批的到手时刻：同一次请求，本就是一个时间点
    fetchedAt: result.fetchedAt,
  }
}

async function runBatch(scope: string, subscribers: Subscriber[]): Promise<void> {
  const itemIds = unionItemIds(subscribers)
  try {
    const result = await fetchMarket(scope, itemIds)
    // 批量结果按物品拆条落盘：看板以后增删卡片，其它物品的缓存依然命中
    writeMarketCache(result)
    for (const subscriber of subscribers) {
      subscriber.resolve(sliceFor(subscriber.itemIds, result))
    }
  } catch (error: unknown) {
    /*
     * 失败日志不在这里打：`fetchMarket` 已经按「一次真实请求一条」打过一次
     * （见 universalis.ts 里那段注释），这里再打就成了同一次失败两条记录。
     * 这里只负责把同一个错误分发给本区服的所有订阅者 —— 错误隔离在区服这一层：
     * 某个区服挂了，其它区服的卡片照常出数据。
     */
    for (const subscriber of subscribers) {
      subscriber.reject(error)
    }
  }
}
