import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Flex, Form, InputNumber, Select, Spin, Typography } from 'antd'
import { useNow } from '../../../../core/clock/hooks.ts'
import { formatRelativeTime } from '../../../../core/clock/format.ts'
import { isFresh, readMarketCache, writeMarketCache } from './cache.ts'
import { findItem, getItemDbStatus, loadItemDb, searchItems } from './items.ts'
import { resolveTier, scopeLabel, scopeOptions } from './scopes.ts'
import { buildMarketPageUrl, fetchMarket } from './universalis.ts'
import type { ItemDbStatus, ItemEntry } from './items.ts'
import type { MarketData, PriceReading, QualityReadings } from './universalis.ts'
import type { MarketConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

/**
 * 物品库的加载状态。
 *
 * 库本身只有一份（`items.ts` 里的模块级 Promise），多个调用方共享同一个请求，
 * 这里只负责把它映射成"能搜了 / 还在读 / 读失败"三态。
 */
function useItemDb(): ItemDbStatus {
  const [status, setStatus] = useState<ItemDbStatus>(getItemDbStatus)

  useEffect(() => {
    if (getItemDbStatus().status === 'ready') {
      return
    }
    // 卸载后不再 setState；组件重挂载时会重试（loadItemDb 失败后不保留 Promise）
    let alive = true
    loadItemDb().then(
      () => {
        if (alive) {
          setStatus({ status: 'ready' })
        }
      },
      (error: unknown) => {
        if (alive) {
          setStatus({ status: 'error', message: error instanceof Error ? error.message : '未知错误' })
        }
      },
    )
    return () => {
      alive = false
    }
  }, [])

  return status
}

/**
 * 物品选择器。
 *
 * config 里存的是数组（给将来的多选留位置），当前 UI 只允许选一个，
 * 所以这里做一层「数组 ↔ 单个 id」的转换。
 *
 * 选项完全来自物品库的实时检索 —— 库里没有的物品根本选不出来，
 * 这就是「不存在于 json 的物品不可使用」的落地方式。
 */
function ItemPicker({
  value,
  onChange,
}: {
  value?: number[]
  onChange?: (next: number[]) => void
}): React.ReactNode {
  const db = useItemDb()
  const [query, setQuery] = useState('')
  const selected = value?.[0]

  // 不 memo：物品库是**模块级状态**，加载完成时靠组件重渲才带上真正的数据，
  // 用 memo 反而会把"还没加载完"的空结果缓存住（依赖里写 db.status 也只是补偿）。
  // 一次过滤就是几毫秒，直接算最直白。
  const results = searchItems(query)
  const known = new Set(results.map((item) => item.id))
  // 已选项必须始终留在列表里：否则编辑已有条目时值还在、标签却找不到，
  // 回显会退化成一串裸 id，而且用户一下拉就像"被清空"了
  const pinned: ItemEntry[] =
    selected === undefined || known.has(selected)
      ? []
      : [findItem(selected)].filter((item): item is ItemEntry => item !== undefined)

  // 选项只显示名称：ID 只用于检索，不往界面上摆
  const options = [...pinned, ...results].map((item) => ({
    label: item.name,
    value: item.id,
  }))

  if (db.status === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        title="物品库读取失败"
        description={`无法读取 data/item-db.json（${db.message}）。刷新页面可以重试。`}
      />
    )
  }

  return (
    <Select<number>
      showSearch
      allowClear
      // 检索在本地物品库里做（几万条），不走 antd 的选项内过滤
      filterOption={false}
      onSearch={setQuery}
      value={selected}
      onChange={(next) => {
        // 选完清掉关键词：列表回到"只有已选项"，下次点开是干净的
        setQuery('')
        onChange?.(next === undefined ? [] : [next])
      }}
      options={options}
      placeholder={db.status === 'loading' ? '正在加载物品库…' : '输入物品名称或 ID'}
      notFoundContent={
        db.status === 'loading' ? (
          <Spin size="small" />
        ) : query.trim() === '' ? (
          '输入关键词开始检索'
        ) : (
          '物品库中没有匹配项'
        )
      }
    />
  )
}

export function MarketFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item
        label="物品"
        name={['config', 'itemIds']}
        rules={[{ required: true, message: '请选择一个物品' }]}
        extra="输入名称或 ID 检索，最多显示 10 条（按 ID 倒序）。只能选物品库里已有的物品"
      >
        <ItemPicker />
      </Form.Item>

      <Form.Item
        label="区服"
        name={['config', 'scope']}
        rules={[{ required: true, message: '请选择区服' }]}
        extra="可选整个中国区、某个大区，或单个服务器"
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="选择中国全区、大区或服务器"
          options={scopeOptions()}
          listHeight={320}
        />
      </Form.Item>

      <Form.Item
        label="基准价格"
        name={['config', 'basePrice']}
        extra="可选。最低价格高于基准价标红、低于基准价标绿"
      >
        <InputNumber min={1} style={{ width: '100%' }} placeholder="留空即不比较" />
      </Form.Item>
    </>
  )
}

// 金币只显示整数：接口的平均售价带小数（如 47.15475960236723），小数点后几位没有意义
const gilFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 })

/** 与基准价比较：高于基准 = 贵了 = 红，低于 = 便宜 = 绿，相等/无基准/无数据 → 不着色。 */
function priceTone(price: number, basePrice: number | undefined): 'above' | 'below' | null {
  if (basePrice === undefined || price <= 0) {
    return null
  }
  if (price > basePrice) {
    return 'above'
  }
  if (price < basePrice) {
    return 'below'
  }
  return null
}

function ReadingValue({
  reading,
  tone,
}: {
  reading: PriceReading | undefined
  tone: 'above' | 'below' | null
}): React.ReactNode {
  // 接口在无数据时返回 0，显示成「0 金币」会误导，统一用破折号
  if (!reading || !reading.hasData) {
    return <span className="dash-market-value is-blank">—</span>
  }

  return (
    <span className={`dash-market-value${tone === null ? '' : ` is-${tone}`}`}>
      {gilFormat.format(reading.price)}
    </span>
  )
}

/** 一个品质（NQ / HQ）的信息块。 */
function QualityBlock({
  label,
  readings,
  basePrice,
  scope,
}: {
  label: string
  readings: QualityReadings | undefined
  basePrice: number | undefined
  /** 所选区服；决定最低价格的出处怎么写。 */
  scope: string
}): React.ReactNode {
  const minListing = readings?.minListing
  /*
   * 最低价格下方的出处行：
   * - 查大区/全区：价格可能出自任意服务器，用接口给的 worldName（最低价所在的那个服）。
   * - 查单个服务器：价格就是这个服的，直接写区服名 —— 接口在这一档**不返回 worldId**，
   *   不补上就只剩大区/全区才有出处行，两种粒度下读数行数不一致。
   */
  const origin = minListing?.hasData
    ? resolveTier(scope) === 'world'
      ? scope
      : minListing.worldName
    : undefined

  return (
    <div className="dash-market-block">
      <span className="dash-market-quality">{label}</span>

      <Flex vertical gap={1} style={{ minWidth: 0 }}>
        <Flex className="dash-market-row" align="baseline" gap={6}>
          <span className="dash-market-label">最低价格</span>
          {/* 只给最低价格上色：三项都比会满屏红绿，反而看不出重点 */}
          <ReadingValue reading={minListing} tone={priceTone(minListing?.price ?? 0, basePrice)} />
        </Flex>
        {/* 与价格分行：挤在一行会压窄数字。两者贴成一组（gap 1）—— 出处是给最低价格做注解的，
            中间不该再留一道行距，否则会像另一项读数 */}
        {origin ? <span className="dash-market-origin">{origin}</span> : null}
      </Flex>

      <Flex className="dash-market-row" align="baseline" gap={6}>
        <span className="dash-market-label">平均售价</span>
        <ReadingValue reading={readings?.averageSalePrice} tone={null} />
      </Flex>

      <Flex className="dash-market-row" align="baseline" gap={6}>
        <span className="dash-market-label">最近成交</span>
        {/* 最近成交不带区服：一项只给一个出处就够，多了就成噪声 */}
        <ReadingValue reading={readings?.recentPurchase} tone={null} />
      </Flex>
    </div>
  )
}

export function MarketRender({ config }: WidgetRenderProps<MarketConfig>): React.ReactNode {
  // 全局时钟：艾欧泽亚时间、PvP 轮换与这里的「N 分钟前」都从同一份 now 派生
  const now = useNow()
  const db = useItemDb()

  const scope = config.scope
  /*
   * ⚠️ WidgetRenderer 每次渲染都会重新 normalizeConfig，config.itemIds 的引用不稳定，
   * 先拼成字符串再还原：数组因此有了稳定引用，可以安全地进 effect 依赖。
   */
  const itemsKey = config.itemIds.join(',')
  const itemIds = useMemo(() => (itemsKey === '' ? [] : itemsKey.split(',').map(Number)), [itemsKey])
  const itemId = itemIds[0]
  /** 当前请求的唯一标识：数据与错误都按它归档，切参数时旧数据自然失效。 */
  const requestKey = `${scope}|${itemsKey}`

  /*
   * 数据与错误都**连着自己那份请求标识一起存**，而不是在 effect 里手动清空。
   * 好处有二：① 渲染期拿 key 一比就知道这条数据是不是当前参数的，
   * 不必"先置空再请求"（那会多触发一轮渲染）；
   * ② 切区服时不会把上一个区服的价格挂在新区服的标题下面。
   */
  const [entry, setEntry] = useState<{ key: string; data: MarketData } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  // 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示
  const cached = useMemo(() => readMarketCache(scope, itemIds), [scope, itemIds])

  const data = (entry?.key === requestKey ? entry.data : null) ?? cached
  const error = failure?.key === requestKey ? failure.message : null
  // 没有数据也没有错误 = 还在等第一次结果，不需要单独维护一个 loading 状态
  const pending = itemIds.length > 0 && data === null && error === null

  /*
   * 拉取 + 落盘 + 记账。
   *
   * 刻意写成**同步函数返回 Promise**（而不是 async 函数）：setState 全部落在
   * then/catch 回调里，effect 同步阶段一次都不会触发渲染。
   */
  const reload = useCallback((): Promise<void> => {
    if (itemIds.length === 0) {
      return Promise.resolve()
    }
    return fetchMarket(scope, itemIds)
      .then((result) => {
        writeMarketCache(result)
        setEntry({ key: requestKey, data: result })
        // 成功就把同一份请求的错误记录清掉，否则重试成功后错误提示还挂着
        setFailure((previous) => (previous?.key === requestKey ? null : previous))
      })
      .catch((requestError: unknown) => {
        setFailure({
          key: requestKey,
          message: requestError instanceof Error ? requestError.message : '未知错误',
        })
      })
  }, [itemIds, requestKey, scope])

  /*
   * 打开 / 换物品 / 换区服时请求一次，**只此一次**：
   * 命中未过期缓存（1 小时内）就直接用、不发请求；
   * 停留期间不做任何轮询，页面一直开着看到的就是这次拿到的价格。
   */
  useEffect(() => {
    if (itemIds.length === 0) {
      return
    }
    const hit = readMarketCache(scope, itemIds)
    if (hit && isFresh(hit, Date.now())) {
      return
    }
    void reload()
  }, [itemIds, reload, scope])

  if (itemId === undefined) {
    return (
      <Alert
        type="warning"
        showIcon
        title="还没有选择物品"
        description="打开编辑弹窗，在「物品」里检索并选择一个物品。"
      />
    )
  }

  if (db.status === 'error') {
    return <Alert type="error" showIcon title="物品库读取失败" description={db.message} />
  }

  const item = findItem(itemId)
  if (db.status === 'ready' && !item) {
    return (
      <Alert
        type="warning"
        showIcon
        title={`物品 #${itemId} 不在物品库中`}
        description="它可能已被移除或改名。请打开编辑弹窗重新选择。"
      />
    )
  }

  const result = data?.items.find((entry) => entry.itemId === itemId)
  const failed = data?.failedItems.includes(itemId) ?? false
  // 物品库还没读出 hq 标志时先按「没有 HQ」处理：宁可不显示，也别先闪一个空块再收回去
  const hasHq = item !== undefined && item.hq !== 0
  // 失败优先于其他状态：标题行只显示「获取失败」，原因悬停可看，细节在控制台
  const status =
    error !== null
      ? '获取失败'
      : pending
        ? '正在获取…'
        : data
          ? formatRelativeTime(data.fetchedAt, now.getTime())
          : '暂无数据'

  return (
    <Flex vertical gap={10} style={{ minWidth: 0 }}>
      {/*
        正文整块可点，跳到 Universalis 的物品页。
        链接只包住读数区：**标题栏**里有编辑/删除按钮，交互元素不能嵌在 <a> 里。
      */}
      <a
        href={buildMarketPageUrl(itemId)}
        target="_blank"
        rel="noopener noreferrer"
        title="在 Universalis 查看该物品"
        style={{ display: 'block', color: 'inherit' }}
      >
        <Flex vertical gap={10} style={{ minWidth: 0 }}>
          <Flex align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
              {item?.name ?? `物品 #${itemId}`}
            </Typography.Text>
            {/*
              区服与更新时间挤在标题行右侧，不独占一行；获取失败时这里转警示色。
              这里是纯文本 —— 它位于 <a> 内部，不能放按钮。
            */}
            <Typography.Text
              type={error === null ? 'secondary' : 'warning'}
              title={error ?? undefined}
              style={{ fontSize: 11, flex: 'none' }}
            >
              {scopeLabel(scope)} · {status}
            </Typography.Text>
          </Flex>

          <Flex gap={8} align="stretch" style={{ minWidth: 0 }}>
            {/* 有 HQ 时 HQ 在左、NQ 在右；这个物品没有 HQ 版本就整块不出现 */}
            {hasHq ? (
              <QualityBlock label="HQ" readings={result?.hq} basePrice={config.basePrice} scope={scope} />
            ) : null}
            <QualityBlock label="NQ" readings={result?.nq} basePrice={config.basePrice} scope={scope} />
          </Flex>
        </Flex>
      </a>

      {failed ? (
        <Typography.Text type="warning" style={{ fontSize: 11 }}>
          接口没有返回这个物品的价格数据。
        </Typography.Text>
      ) : null}
    </Flex>
  )
}
