/**
 * 公告活动卡的配置字段与渲染。
 *
 * 卡面两段：标题行（来源 + 数据新鲜度 / 获取失败）→ 公告标题列表。
 * 标题行与房屋售卖 / 物品价格 / 市场税率同一套写法：左侧加粗的来源名，
 * 右侧小号次级色的新鲜度读数（获取失败转警示色）。
 * 列表**按接口返回顺序**排，只有命中置顶规则的条目被拎到最前
 * （`highlightNews`，稳定分区，其余条目顺序不动）；置顶行用主色加粗并挂一个「顶」标记。
 * 每行只有标题 —— 卡面不显示日期，点条目到官网看详情。
 *
 * `limit` 就是请求的 `pageSize`（要几条取几条），因此**配置一改就按新配置重新请求一次**；
 * 首次打开则优先用缓存（1 小时内且条数对得上就不发请求）。
 * 「N 分钟前」跟着**分钟粒度**的全局时钟走，跨分钟才重渲染。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Flex, Form, InputNumber, Select, Typography } from 'antd'
import { useClockAt } from '../../../../core/clock/hooks.ts'
import { formatRelativeTime } from '../../../../core/clock/format.ts'
import { fetchNews, highlightNews } from './api.ts'
import { isNewsCacheFresh, readNewsCache, writeNewsCache } from './cache.ts'
import {
  NEWS_DEFAULT_CONFIG,
  NEWS_DEFAULT_KEYWORDS,
  NEWS_HIGHLIGHT_MAX,
  NEWS_HIGHLIGHT_MIN,
  NEWS_LIMIT_MAX,
  NEWS_LIMIT_MIN,
} from './config.ts'
import type { NewsCache } from './cache.ts'
import type { NewsItem } from './api.ts'
import type { NewsConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

/**
 * 拿到数据前先摆几行占位（同税率卡的破折号）：卡高稳定，数据回来时不会跳一下。
 * 取最小数量 5 —— 占位只求"有个列表的样子"，跟着配置摆满 20 行反而把卡撑高。
 */
const SKELETON_ROWS = NEWS_LIMIT_MIN

/**
 * 条目的悬停提示：标题一行，摘要在下一行；摘要是空串就不出这一行。
 *
 * 「摘要与标题相同」的判断在 `parseNewsItem` 里就做掉了（接口里大量条目是复读标题），
 * 这里只认空串，不再比一次字符串。
 */
function hoverText(item: NewsItem): string {
  const lines = [item.title]
  if (item.summary !== '') {
    lines.push(item.summary)
  }
  if (item.external) {
    lines.push('站外链接')
  }
  return lines.join('\n')
}

export function NewsFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item
        label="公告数量"
        name={['config', 'limit']}
        extra={`组件内共展示几条数据，同时也是向接口请求的条数。（${String(NEWS_LIMIT_MIN)} ~ ${String(NEWS_LIMIT_MAX)}）`}
      >
        <InputNumber
          min={NEWS_LIMIT_MIN}
          max={NEWS_LIMIT_MAX}
          precision={0}
          style={{ width: '100%' }}
          placeholder={String(NEWS_DEFAULT_CONFIG.limit)}
        />
      </Form.Item>

      <Form.Item
        label="高亮数量"
        name={['config', 'highlight']}
        extra={`最多几条重点条目置顶并高亮。（${String(NEWS_HIGHLIGHT_MIN)} ~ ${String(NEWS_HIGHLIGHT_MAX)}）`}
      >
        <InputNumber
          min={NEWS_HIGHLIGHT_MIN}
          max={NEWS_HIGHLIGHT_MAX}
          precision={0}
          style={{ width: '100%' }}
          placeholder={String(NEWS_DEFAULT_CONFIG.highlight)}
        />
      </Form.Item>

      <Form.Item
        label="高亮关键字"
        name={['config', 'keywords']}
        extra={`公告标题含其中任一个的条目会置顶高亮，默认：${NEWS_DEFAULT_KEYWORDS.join('、')}。`}
      >
        {/*
         * tags 模式的 Select：值天然就是 `string[]`，回车即成标签，
         * 粘一串「联动, 季节活动」也会按分隔符拆开（中英文逗号都认）。
         * `open={false}` 关掉下拉面板 —— 关键字是自由输入，没有候选项可列。
         */}
        <Select mode="tags" placeholder="输入关键字后回车" tokenSeparators={[',', '，']} open={false} suffixIcon={null} />
      </Form.Item>
    </>
  )
}

export function NewsRender({ config }: WidgetRenderProps<NewsConfig>): React.ReactNode {
  const now = useClockAt('minute')

  /*
   * 数据与错误都**连着自己那次请求的条数一起存**（同税率卡按服务器归档的写法）：
   * 改了「公告数量」之后，旧条数的数据与错误自然失效，不必在 effect 里手动清空。
   */
  const [entry, setEntry] = useState<{ limit: number; data: NewsCache } | null>(null)
  const [failure, setFailure] = useState<{ limit: number; message: string } | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：页面打开时命中缓存就立刻有数据可显示。
   * 缓存连条数一起存，条数对不上的那份当作没缓存 —— 请求的 `pageSize` 就是条数。
   */
  const cached = useMemo(() => readNewsCache(), [])
  const cachedForLimit = cached !== null && cached.limit === config.limit ? cached : null

  const data = (entry !== null && entry.limit === config.limit ? entry.data : null) ?? cachedForLimit
  const error = failure !== null && failure.limit === config.limit ? failure.message : null
  // 没有数据也没有错误 = 还在等这次配置的结果，不需要单独维护一个 loading 状态
  const pending = data === null && error === null

  const limit = config.limit

  /*
   * 拉取 + 落盘 + 记账。
   *
   * 刻意写成**同步函数返回 Promise**（而不是 async 函数）：setState 全部落在
   * then/catch 回调里，effect 同步阶段一次都不会触发渲染。
   */
  const reload = useCallback((): Promise<void> => {
    return fetchNews(limit)
      .then((items) => {
        const fresh: NewsCache = { fetchedAt: Date.now(), limit, items }
        writeNewsCache(fresh)
        setEntry({ limit, data: fresh })
        // 成功就把同一份配置的错误清掉，否则重试成功后错误提示还挂着
        setFailure((previous) => (previous?.limit === limit ? null : previous))
      })
      .catch((requestError: unknown) => {
        setFailure({ limit, message: requestError instanceof Error ? requestError.message : '未知错误' })
      })
  }, [limit])

  /*
   * 配置指纹：条数、高亮数、关键字任一变化都算"配置改了"。
   */
  const configKey = `${String(limit)}|${String(config.highlight)}|${JSON.stringify(config.keywords)}`
  const lastConfigKeyRef = useRef<string | null>(null)

  /*
   * 打开 / 改配置时按配置请求一次：
   * - 首次挂载：命中未过期缓存（1 小时内、条数也相同）就直接用，不发请求；
   * - 之后每次配置变化：按**当前**配置重新请求一次（`limit` 进了 `pageSize`，
   *   高亮数 / 关键字虽然不影响数据，但配置改动一律重取，行为可预期）；
   * - 同一个指纹再进 effect（StrictMode 的双挂载）直接跳过 —— 单飞已经兜住了。
   */
  useEffect(() => {
    const previousKey = lastConfigKeyRef.current
    lastConfigKeyRef.current = configKey
    if (previousKey === configKey) {
      return
    }
    if (previousKey === null) {
      const hit = readNewsCache()
      if (hit !== null && hit.limit === limit && isNewsCacheFresh(hit, Date.now())) {
        return
      }
    }
    void reload()
  }, [configKey, limit, reload])

  // 一条数据都没拿到且失败了：整卡换成提示 + 重试（重试仍走单飞，不会打两遍）
  if (data === null && error !== null) {
    return (
      <Flex vertical gap={8}>
        <Alert type="warning" showIcon title="获取公告失败" description={error} />
        <div>
          <Button size="small" onClick={() => void reload()}>
            重试
          </Button>
        </div>
      </Flex>
    )
  }

  // 失败优先于其他状态：状态行只显示「获取失败」，原因悬停可看，细节在控制台
  const status =
    error !== null
      ? '获取失败'
      : pending
        ? '正在获取…'
        : data
          ? formatRelativeTime(data.fetchedAt, now.getTime())
          : '暂无数据'

  /*
   * 先分区再截断：命中条目优先占掉「公告数量」的名额 ——
   * 数量设 5 而命中 4 条时，应当是 4 条置顶 + 1 条普通，而不是先砍数据再把置顶挤掉。
   * 数据本身就是按这个条数取回来的，`slice` 只是兜底（接口万一多给几条也不会越界）。
   */
  const rows = data === null ? [] : highlightNews(data.items, config.highlight, config.keywords).slice(0, limit)

  return (
    <div className="dash-card-fill dash-news">
      {/*
        * 标题行：与房屋售卖 / 物品价格 / 市场税率同一套写法 ——
        * 左侧加粗 13px 的来源名（窄卡里先被省略号吃掉），
        * 右侧 11px 的数据新鲜度；获取失败时转警示色，原因悬停可看。
        */}
      <Flex className="dash-news-meta" align="baseline" justify="space-between" gap={8} style={{ minWidth: 0 }}>
        <Typography.Text strong ellipsis style={{ fontSize: 13 }}>
          官网公告
        </Typography.Text>
        <Typography.Text
          type={error === null ? 'secondary' : 'warning'}
          title={error ?? undefined}
          className="dash-news-status"
          style={{ fontSize: 11, flex: 'none' }}
        >
          {status}
        </Typography.Text>
      </Flex>

      <div className="dash-news-scroll">
        {pending
          ? /* 占位行只用破折号：像"读数还没回来"，而不是"有一批空标题的公告" */
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <div key={index} className="dash-news-row is-blank">
                <span className="dash-news-title">—</span>
              </div>
            ))
          : rows.map((item) => (
              <a
                key={item.id}
                className={`dash-news-row${item.pinned ? ' is-pinned' : ''}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                title={hoverText(item)}
              >
                <span className="dash-news-title">{item.title}</span>
              </a>
            ))}

        {!pending && rows.length === 0 ? <div className="dash-news-empty">暂无公告</div> : null}
      </div>
    </div>
  )
}
