/**
 * 公告活动卡的配置字段与渲染。
 * 卡面两段：标题行（来源 + 数据新鲜度 / 获取失败，与房屋售卖、税率等卡同一套写法）→ 公告标题列表；
 * 列表按接口返回顺序排，只有命中置顶规则的条目被拎到最前（highlightNews 稳定分区），
 * 置顶行主色加粗挂「顶」标记，每行只有标题，点条目到官网看详情。
 * limit 就是请求的 pageSize：配置一改就按新配置重新请求；首次打开优先用缓存；
 * 「N 分钟前」跟着分钟粒度的全局时钟走。
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

// 数据到手前摆几行破折号占位（同税率卡）：卡高稳定，数据回来时不跳；取最小数量 5，占位只求"有个列表的样子"。
const SKELETON_ROWS = NEWS_LIMIT_MIN

/** 条目悬停提示：标题一行、摘要在下一行（空串不显示）；「摘要与标题相同」已在 parseNewsItem 做掉。 */
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
         * tags 模式的 Select：值天然是 string[]，回车即成标签，粘「联动, 季节活动」也按中英文逗号分隔符拆开；
         * open={false} 关掉下拉面板 —— 关键字是自由输入，没有候选项可列。
         */}
        <Select mode="tags" placeholder="输入关键字后回车" tokenSeparators={[',', '，']} open={false} suffixIcon={null} />
      </Form.Item>
    </>
  )
}

export function NewsRender({ config }: WidgetRenderProps<NewsConfig>): React.ReactNode {
  const now = useClockAt('minute')

  /*
   * 数据与错误都连着自己那次请求的条数一起存（同税率卡按服务器归档的写法）：
   * 改了「公告数量」后旧条数的数据与错误自然失效，不必在 effect 里手动清空。
   */
  const [entry, setEntry] = useState<{ limit: number; data: NewsCache } | null>(null)
  const [failure, setFailure] = useState<{ limit: number; message: string } | null>(null)

  /*
   * 渲染期读缓存（纯读、无副作用）：命中就立刻有数据可显示；缓存连条数一起存，
   * 条数对不上的那份当作没缓存（请求的 pageSize 就是条数）。
   */
  const cached = useMemo(() => readNewsCache(), [])
  const cachedForLimit = cached !== null && cached.limit === config.limit ? cached : null

  const data = (entry !== null && entry.limit === config.limit ? entry.data : null) ?? cachedForLimit
  const error = failure !== null && failure.limit === config.limit ? failure.message : null
  // 没有数据也没有错误 = 还在等这次配置的结果，不需要单独维护一个 loading 状态
  const pending = data === null && error === null

  const limit = config.limit

  /*
   * 拉取 + 落盘 + 记账。刻意写成同步函数返回 Promise（而非 async）：setState 全落在
   * then/catch 回调里，effect 同步阶段一次都不触发渲染。
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

  // 配置指纹：条数、高亮数、关键字任一变化都算「配置改了」。
  const configKey = `${String(limit)}|${String(config.highlight)}|${JSON.stringify(config.keywords)}`
  const lastConfigKeyRef = useRef<string | null>(null)

  /*
   * 打开 / 改配置时按配置请求一次：首次挂载命中未过期缓存（1 小时内、条数相同）就直接用、不发请求；
   * 之后每次配置变化按当前配置重取（limit 进了 pageSize，高亮 / 关键字虽不影响数据但一并重取，行为可预期）；
   * 同一指纹再进 effect（StrictMode 双挂载）直接跳过 —— 单飞已兜住。
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
   * 先分区再截断：命中条目优先占掉「公告数量」的名额 —— 数量设 5、命中 4 条时应是
   * 4 条置顶 + 1 条普通，而不是先砍数据再把置顶挤掉；数据本就按此条数取回，slice 只是兜底。
   */
  const rows = data === null ? [] : highlightNews(data.items, config.highlight, config.keywords).slice(0, limit)

  return (
    <div className="dash-card-fill dash-news">
      {/*
        * 标题行：与房屋售卖 / 物品价格 / 市场税率同一套写法 —— 左侧加粗 13px 来源名
        * （窄卡先被省略号吃掉），右侧 11px 数据新鲜度；获取失败转警示色，原因悬停可看。
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
