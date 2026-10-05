import { GithubOutlined } from '@ant-design/icons'
import { Flex, Tag, Typography } from 'antd'

/**
 * 项目用到的外部接口。
 *
 * `endpoint` 是**请求地址的模板**（占位符沿用接口自身的写法），只作展示、不渲染成链接：
 * 模板带上真实的物品 / 服务器 ID 才有响应，点开只会 404。想访问的是 `site`。
 * `site` 留空表示数据不来自外部服务（随项目一起分发）。
 */
type EndpointEntry = {
  name: string
  /** 数据来源，显示在名称右侧的标签上。 */
  provider: string
  endpoint: string
  usage: string
  /** 来源站点，可点击；本地资源留空。 */
  site?: string
}

const API_ENDPOINTS: readonly EndpointEntry[] = [
  {
    name: '链接元数据',
    provider: 'LinkMetadata',
    endpoint: 'https://api.linkmetadata.com/v1/metadata?url={链接}&prefer=og',
    usage: '批量添加链接与新建链接时，自动抓取页面标题、描述与站点图标。',
    site: 'https://linkmetadata.com/',
  },
  {
    name: '物品交易行情',
    provider: 'Universalis',
    endpoint: 'https://universalis.app/api/v2/aggregated/{大区}/{物品 ID}',
    usage: '「物品价格」组件获取最低价、平均价与最近成交价。',
    site: 'https://docs.universalis.app/',
  },
  {
    name: '市场税率',
    provider: 'Universalis',
    endpoint: 'https://universalis.app/api/v2/tax-rates?world={服务器 ID}',
    usage: '「市场税率」组件获取各主城市场交易的当前税率。',
    site: 'https://docs.universalis.app/',
  },
  {
    name: '售楼中心',
    provider: 'ffxiv.cyou',
    endpoint: 'https://house.ffxiv.cyou/api/sales?server={服务器 ID}',
    usage: '「房屋售卖」组件显示各房区的在售房屋数量。',
    site: 'https://house.ffxiv.cyou/#/about',
  },
  {
    name: '货币汇率',
    provider: 'Frankfurter',
    endpoint: 'https://api.frankfurter.dev/v2/rates?base={基准货币}&quotes={目标货币}',
    usage: '「汇率」组件用于获取常用货币的参考汇率。',
    site: 'https://frankfurter.dev/',
  },
]

/** 参考的开源项目、官方文档与资料。 */
type ReferenceEntry = {
  name: string
  urls: readonly string[]
  note: string
}

const REFERENCES: readonly ReferenceEntry[] = [
  {
    name: '艾欧泽亚时间换算',
    urls: ['https://github.com/gzifeng/EorzeaTimeConvert'],
    note: '参考了项目中的 Go 实现，改写成 TS 版本。',
  },
  {
    name: '游戏内特殊图标字体',
    urls: ['https://github.com/thewakingsands/ffxiv-axis-font-icons'],
    note: '在网页中引入了字体文件与 CSS，用于显示特殊字符。',
  },
  {
    name: '物品数据',
    urls: ['https://github.com/InfSein/ffxiv-datamining-mixed'],
    note: '从 Item.csv 中提取了部分可交易的物品数据，用于「物品价格」组件中的物品搜索。',
  },
  {
    name: 'PVP 地图轮换算法',
    urls: ['https://github.com/ffxiv-wakeng/pvp-calendar'],
    note: '参考了项目中的算法，用于「PvP 地图轮换」组件。',
  },
  {
    name: '游戏内天气数据',
    urls: ['https://github.com/Asvel/ffxiv-weather'],
    note: '参考天气种子与天气判定，「极光预报」组件据此推算。',
  },
  {
    name: 'FF14 中文维基',
    urls: ['https://ff14.huijiwiki.com/wiki/天气#罕见天象'],
    note: '极光出现规则。',
  },
  {
    name: 'FFXIV 官方专题站',
    urls: [
      'https://na.finalfantasyxiv.com/heavensward/',
      'https://na.finalfantasyxiv.com/stormblood/',
      'https://na.finalfantasyxiv.com/shadowbringers/',
      'https://na.finalfantasyxiv.com/endwalker/',
      'https://na.finalfantasyxiv.com/dawntrail/',
      'https://na.finalfantasyxiv.com/evercold/',
    ],
    note: '八套主题的颜色和背景图等资源的参考来源。',
  },
]

/** 技术栈；标签整体可点，跳到各自的官网 / 仓库。 */
type TechEntry = {
  name: string
  url: string
}

const TECH_STACK: readonly TechEntry[] = [
  { name: 'Vite 8', url: 'https://vite.dev/' },
  { name: 'React 19', url: 'https://react.dev/' },
  { name: 'TypeScript', url: 'https://www.typescriptlang.org/' },
  { name: 'Ant Design 6', url: 'https://ant.design/' },
  { name: 'dnd-kit', url: 'https://dndkit.com/' },
  { name: 'Marked', url: 'https://marked.js.org/' },
  { name: 'Day.js', url: 'https://day.js.org/' },
]

export function AboutSettingsPanel(): React.ReactNode {
  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          数据接口
        </Typography.Title>
        <Typography.Text type="secondary" className="dash-settings-hint is-inline">
          项目中使用到的第三方公开接口。
        </Typography.Text>

        <ul className="dash-about-list">
          {API_ENDPOINTS.map((entry) => (
            <li className="dash-about-item" key={entry.name}>
              <Flex align="center" justify="space-between" gap={8}>
                <Typography.Text strong>{entry.name}</Typography.Text>
                <Tag>{entry.provider}</Tag>
              </Flex>
              <Typography.Text type="secondary" className="dash-about-note">
                {entry.usage}
              </Typography.Text>
              <Typography.Text className="dash-about-endpoint">{entry.endpoint}</Typography.Text>
              {entry.site ? (
                <Typography.Link
                  className="dash-about-link"
                  href={entry.site}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.site}
                </Typography.Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          参考
        </Typography.Title>
        <Typography.Text type="secondary" className="dash-settings-hint is-inline">
          本项目参考了以下项目、代码、文档与资料。
        </Typography.Text>

        <ul className="dash-about-list">
          {REFERENCES.map((entry) => (
            <li className="dash-about-item" key={entry.name}>
              <Typography.Text strong>{entry.name}</Typography.Text>
              <Typography.Text type="secondary" className="dash-about-note">
                {entry.note}
              </Typography.Text>
              <div className="dash-about-links">
                {entry.urls.map((url) => (
                  <Typography.Link
                    key={url}
                    className="dash-about-link"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {url}
                  </Typography.Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          代码编写
        </Typography.Title>
        <Flex className="dash-about-tags" gap={6} wrap>
          <Tag>DeepSeek </Tag>
          <Tag>GLM</Tag>
          <Tag>Copilot</Tag>
          <Tag>Nel <i className="xiv e05d"></i> 静语庄园</Tag>
        </Flex>
      </section>

      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          项目技术栈
        </Typography.Title>

        <Flex className="dash-about-tags" gap={6} wrap>
          {TECH_STACK.map((tech) => (
            /*
             * 跳转交给外层 <a>（整块标签都是命中区，也保住中键新标签、右键复制链接），
             * Tag 只负责外观 —— 长按拖动等浏览器默认行为照旧走原生链接这一套。
             */
            <a
              key={tech.name}
              className="dash-about-tech"
              href={tech.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Tag>{tech.name}</Tag>
            </a>
          ))}
        </Flex>

        <Flex align="center" gap={6} className="dash-about-repo">
          <GithubOutlined />
          <Typography.Text type="secondary">项目仓库：</Typography.Text>
          <Typography.Link
            href="https://github.com/nel-1518/ffxiv-dash"
            target="_blank"
            rel="noopener noreferrer"
          >
            nel-1518/ffxiv-dash
          </Typography.Link>
        </Flex>
      </section>
    </Flex>
  )
}
