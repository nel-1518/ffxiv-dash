# FFXIV Dash

个人导航仪表盘：把常用网站、服务状态和自定义组件集中到一个页面。

## 快速开始

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm build      # 类型检查 + 生产构建（产物在 dist/）
pnpm lint       # oxlint
pnpm preview    # 预览构建产物
```

可选：复制 `.env.example` 为 `.env` 配置 API 层与应用开关。

## 技术选型

| 关注点 | 选择 | 说明 |
| --- | --- | --- |
| UI | `antd@6` | v6 要求 React >= 18，原生支持 React 19，**不需要** `@ant-design/v5-patch-for-react-19` |
| 图标 | `@ant-design/icons@6` | 版本必须与 antd 6 匹配 |
| 拖拽 | `@dnd-kit` | 指针 + 键盘双传感器，支持触屏与无障碍排序 |
| 样式 | antd Design Token + 少量全局 CSS | 自定义样式一律引用 antd 的 CSS 变量，便于后续换主题 |
| 路由 | 暂无 | 单页仪表盘；接路由时改 `src/app/AppShell.tsx` 一处即可 |

## 架构

```
src/
  app/                    应用外壳与全局装配
    AppProviders.tsx        ConfigProvider(中文/主题) → App → BoardProvider
    theme-config.ts         主题唯一改动点（当前用 antd 默认主题）
    AppShell.tsx            布局外壳；将来接路由的挂载点
  core/                   与 React 无关的通用能力
    ids.ts                  全项目唯一 id 生成入口（含非安全上下文降级）
    guards.ts               通用类型守卫（isRecord）
    theme-preference.ts     主题偏好（light / dark / auto）的读写
    favicon.ts              网站图标第三方接口封装
    favicon-cache.ts        图标失败负缓存（避免离线时反复重试）
    api/
      types.ts              ApiSource 数据来源描述
      errors.ts             ApiError / 中文文案 / 可重试判定
      config.ts             baseURL、超时、重试次数（可运行时覆盖）
      client.ts             request()：超时、重试、错误归一化
    storage/
      types.ts              BoardDoc / Group / Item 数据模型
      schema.ts             校验、归一化、版本迁移
      persistent.ts         localStorage 读写（含回退与归一化回写）
      default-board.ts      初始演示数据
  hooks/
    useAsyncData.ts         统一的异步数据 hook（所有访问 API 的组件都走这里）
  state/                    仪表盘状态
    board-types.ts          action 与 actions 类型
    board-reducer.ts        纯 reducer，全部不可变更新
    board-context.ts        context 常量
    board-storage.ts        读写落盘
    hooks.ts                useBoard / useBoardActions
    BoardProvider.tsx       reducer + debounce 落盘
  features/
    dashboard/              顶栏、编辑弹窗、表单
    search/                 搜索弹窗、链接检索、搜索引擎注册表
    settings/               系统设置弹窗（通用设置 / 数据管理）
    groups/                 分组面板、拖拽编排、分组表单
    navigation/             导航卡片、卡片栅格、可拖拽卡片
    widgets/                组件框架（注册表 + 渲染器 + 数据）
      types.ts              WidgetSpec / WidgetRenderProps / defineWidget
      registry.ts           注册表（不导入任何具体组件，避免循环依赖）
      useWidgetData.ts      apiSource → loading/error/ready 状态
      useFavicon.ts         图标接口 hook
      WidgetRenderer.tsx    统一卡片外壳 + 未注册组件降级
      WidgetStates.tsx      错误/未配置等复用状态块
      api-source.ts         数据源归一化与请求分派
      ApiSourceFormFields.tsx 共用的"数据来源"表单字段
      refresh-interval.ts   秒/毫秒换算 + 状态色
      builtins/             内置组件，每个一个目录
  views/
    DashboardPage.tsx       页面组装
  styles/global.css         仅页面背景、字体栈、少量基线
```

### 数据流

```
展示层 (features/*)
  └─ useBoardActions() 派发 action
       └─ boardReducer（纯函数）产出新 BoardDoc
            └─ BoardProvider 以 300ms 防抖写入 localStorage
                 └─ 组件从 useBoard() 读到新状态并重渲染
```

API 路径是**横向独立**的，不经过 state 层：

```
组件 Render
  └─ useAsyncData / request()（core/api）
       └─ 错误统一为 ApiError → toErrorMessage() 给出中文文案
```

### 数据模型

```ts
type BoardDoc = { version: number; groups: Group[] }

/**
 * 分组只有两种，区别在"能放什么"和"怎么排布"：
 * - web     ：可放网页导航与组件，每个分组独占一行
 * - compact ：只能放网页导航，同类分组并排，每行最多 4 个
 */
type Group = {
  id: string; title: string; type: 'web' | 'compact'
  columns: number   // 分组内卡片的列数，1-6；缺省按类型取默认值（web 4 / compact 3）
  items: Item[]
}

type LinkItem = { id; kind: 'link'; name; url; desc?; icon? }

type WidgetItem = {
  id; kind: 'widget'
  widget: string                 // 注册表里的 WidgetSpec.key
  title; label?
  config: Record<string, unknown> // 由各组件的 normalizeConfig 解释
  apiSource?: ApiSource          // static | mock | http
}
```

分组"放在哪一行"的规则集中在 `src/features/groups/group-types.ts` 的 `GROUP_TYPE_META`：
每种类型声明 `allowsWidgets`（能否放组件）与 `perRow`（同类一行放几个）。
`GroupBoard` 依据 `perRow` 把连续的同类型分组切行——`web` 的 `perRow` 是 1，所以每个网页与组件分组独占一行；
`compact` 是 4，不足 4 个时按 24 栅格均分。

分组"内部怎么排"由 `Group.columns` 决定（1-6 列）。排布用 CSS Grid
（`src/features/navigation/ItemGrid.tsx` + `.dash-item-grid`）而不是 antd 的 24 栅格，因为 24 除不尽 5；
列数通过自定义属性 `--dash-grid-columns` 下发，窄屏由媒体查询自动降列（中屏最多 3 列、小屏最多 2 列、手机 1 列）。

### 分组的配置入口

分组的全部配置都收在**编辑分组弹窗**里（表头点 ✎ 打开），打开即按当前值填入：

| 场景 | 弹窗内容 |
| --- | --- |
| 新建分组 | 分组名称 + 分组类型 + 每行列数 |
| 编辑分组 | 分组名称 + 每行列数，左下角多一个「删除分组」 |

- **分组表头只做展示与两个动作**：添加项目（＋）、编辑分组（✎）。列数控件与删除按钮都不再放表头，紧凑分组的表头不会被挤到换行。
- **删除入口统一在弹窗左下角**（`danger` 按钮，仅编辑已有分组时出现），点击后仍走 `modal.confirm` 二次确认，确认删除的同时会关掉弹窗，不会停在已删除的分组上。
- **每行列数**用 `Select` 选择；新建时若列数还停在旧类型的默认值上，切换类型会跟着换成新类型的默认值（手动改过则保留）。
- **分组类型创建后就锁定**：编辑时弹窗里根本不出现类型配置（不是禁用），提交时用隐藏字段带着原类型走。
  这条约束同时落在数据层——`updateGroup` action 根本不接受 `groupType`，reducer 只更新名称与列数，
  所以界面之外的调用也改不动类型；需要换类型就新建一个分组。

### 搜索

搜索是**独立的弹窗**，不过滤看板——看板永远显示全部内容。

| 项 | 行为 |
| --- | --- |
| 检索范围 | 只检索**已保存的链接**（`kind: 'link'`）的 `name` / `desc` / `url`；组件卡片不参与 |
| 结果条数 | 链接最多 5 条（`MAX_LINK_RESULTS`），名称命中排在前，其次描述/网址命中，同档内保持看板里的顺序 |
| 结果行 | 单行：左侧名称，右侧描述（没填描述就回退显示网址），过长一侧省略 |
| 搜索引擎 | 链接结果之后追加「搜索引擎」段，回车即跳转 |
| 入口 | 进页时顶栏输入框已聚焦；**开始打字或点击搜索框**才弹出卡片，两者共享同一份关键词 |
| 遮罩 | 纯半透明色 |

新增一个搜索引擎只需要往 `src/features/search/engines.tsx` 的 `SEARCH_ENGINES` 追加一项
（`urlTemplate` 里用 `%%` 占位关键词，替换前会做 `encodeURIComponent`），
弹窗与键盘导航会自动带上它，不用改 UI 代码。

键盘（全局监听在 `src/features/search/useLinkSearch.ts`）：

| 按键 | 行为 |
| --- | --- |
| `Tab` | 无条件开关搜索弹窗 |
| `Esc` | 关闭弹窗，关键词保留 |
| `↑` / `↓` | 移动高亮（首尾循环回绕；链接行与引擎行是同一条扁平列表） |
| `Enter` | 打开高亮行（新标签） |
| 空白处敲字母/数字 | 直接开窗并带着该字符开始搜索 |
| 输入法起手 | 开窗并把焦点交给弹窗输入框，组合输入直接落在那里（中文可正常上屏） |

三处刻意的实现选择：

- **弹窗是内联 `position: fixed` overlay，不是 antd `Modal`。**
  `Modal` 会 portal 到 `document.body`，从而逃出 `ConfigProvider` 的 `.css-var-*` 容器，
  `var(--ant-color-*)` 全部失效；内联 overlay 既保住变量又与参考实现一致。
  代价是焦点陷阱与 `Esc` 要自己处理。
- **`flushSync` + `useLayoutEffect` 交接焦点。**
  IME 的 composition 事件要求元素在本次按键处理里就已经聚焦，等 effect 再聚焦会丢首键。
  因为同一个字符可能被浏览器再插一遍，触发开窗的那个按键会 `preventDefault`。
- **`suspended` 让位。** `DashboardPage` 在编辑弹窗打开时把 `suspended` 传为 `true`，
  全局快捷键整体停用——否则 `Tab` 会把表单字段之间的焦点移动抢走。
- **开窗分两种，区别只在光标位置。** 「点击搜索框 / 按 Tab」传 `selectAllOnOpen: true`
  （全选，直接输入即替换）；「开始打字」传 `false`，光标置末尾。
  打字时**不能**全选——弹窗输入框挂载后如果全选，用户紧接着敲的下一个字符会替掉整个选区，
  看起来就像吞了一个字母。

overlay 的 `height` / `top` 跟随 `visualViewport`（`--vv-top` / `--vv-height`），
移动端键盘弹出时卡片是被压缩而不是被顶出屏幕。

### 系统设置

顶栏最右侧的齿轮按钮打开，标题「系统设置」，左侧分组 + 右侧内容。

| 分组 | 内容 |
| --- | --- |
| 通用设置 | 主题：浅色 / 深色 / 跟随系统，选择结果写进 `localStorage`（`ffxiv-dash:theme:v1`） |
| 数据管理 | 把看板导出为 JSON；或从 JSON 导入覆盖当前看板 |

**主题目前只做了 UI 与持久化，尚未真的变色。** 落地时有两个接入点：
`src/app/theme-config.ts` 改切 `theme.darkAlgorithm`；
`global.css` 里 `html/body` 的底色要额外用 `data-theme` 属性兜底——
antd 的 CSS 变量只挂在组件自身（`html/body` 取不到），光换算法页面底色不会跟着变。
面板里写明了这一点，免得选了「深色」以为坏了。

**导入导出复用落盘格式**：`core/storage/persistent.ts` 的 `serializeBoardDoc` / `parseBoardDoc`
产出与读取的都是 `{ version, board }` 这个信封，校验也走与启动时同一套 `sanitizeBoardDoc`。
因此导出的文件既能被别人导入，也能直接当作 `localStorage` 的值用；反过来，
把本地原始值导出来也照样能读。导入经 state 层的 `replaceDoc` action 整体替换，
替换前弹二次确认（列出行数，且是不可撤销的危险操作）。
扩展方式：往 `SettingsDialog.tsx` 的 `SECTIONS` 追加一项，并在面板分发里补一个分支。

### 拖拽规则

拖拽手柄只绑在 `DragHandle` 上（不是整张卡片），所以卡片内的链接与按钮照常可点。

| 拖动对象 | 可落点 | 结果 |
| --- | --- | --- |
| 分组 | 同类型分组 | 插入到该位置。把紧凑分组拖到已有紧凑分组旁边，它会**并入同一行**；该行满了（4 个）则挤出最后一个 |
| 网页导航卡片 | 同 kind 的卡片 | 同分组内排序；拖到另一分组的同类卡片上则移入那个分组 |
| 组件卡片 | 同 kind 的卡片 | 同上 |

"只能同类型互相吸附"由 `GroupBoard` 里的 `sameTypeCollision` 碰撞检测实现：
它在比较前按 `parseDragData` 的 `type` / `kind` 过滤候选容器，因此网页卡片不会被组件挤位、
紧凑分组也不会被网页分组落下（这样做也避免了"行内分组数超上限"的状态）。

**动画**分三层，各管一段，互不覆盖：

| 阶段 | 由谁负责 | 表现 |
| --- | --- | --- |
| 拖拽中 | `DragOverlay` | 跟随指针的实体卡片由 overlay 渲染，原位置只留一个半透明占位（`SortableGroup` / `SortableCard` 的 `isLanding` 与占位透明度） |
| 拖拽中 | dnd-kit 的 `transition` + `rectSortingStrategy` | 卡片在自己的分组里换位时，同组其它卡片平滑让位。`ItemGrid` 给每组卡片套了一层 `SortableContext`，dnd-kit 才拿得到 `activeIndex` / `overIndex`（缺了它卡片既不会跟随指针，也不会有让位过渡） |
| 落下后 | dnd-kit 的 `dropAnimation` + 索引变化过渡 | overlay 飞回新的卡槽，顺序真正变化时其余卡片平滑滑到新位置；`DROP_LANDING_MS`（240ms）内原卡片保持半透明，等实体落定再淡入，不会一份卡片同时出现两次 |

`withFadeTransition()` 负责把 dnd-kit 给的 transform 过渡和透明度过渡拼成一条 `transition`——
直接覆盖 `style.transition` 会把让位动画一起弄丢。

落盘结构为 `{ version, board }`，键名 `ffxiv-dash:board:v1`。
`loadDoc()` 会依次做 JSON 解析 → 结构校验 → 版本迁移，任何一步失败都回退到默认数据并在控制台告警；
校验过程中若补齐或丢弃了字段，会自动回写一次。
旧数据里的 `type: 'widget'`（原"组件"分组）在迁移时自动并入 `'web'`，不会丢分组。

## 如何新增一个组件类型

组件框架的目标是：**新增组件不需要改动任何既有组件，也不需要新增依赖。**

1. 新建目录 `src/features/widgets/builtins/<name>-widget/`，放三个文件：

   **`config.ts`** — 纯数据，不导入 React：
   ```ts
   export type WeatherConfig = { city: string; unit: 'c' | 'f' }
   export const WEATHER_DEFAULT_CONFIG: WeatherConfig = { city: 'Shanghai', unit: 'c' }
   export function normalizeWeatherConfig(raw: unknown): WeatherConfig {
     const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
     return {
       city: typeof source.city === 'string' && source.city.trim() ? source.city : WEATHER_DEFAULT_CONFIG.city,
       unit: source.unit === 'f' ? 'f' : 'c',
     }
   }
   ```

   **`fields.tsx`** — 只导出组件。`FormFields` 里的 `Form.Item` 用 `['config', ...]` 作为 name 路径：
   ```tsx
   import type { WeatherConfig } from './config.ts'
   import type { WidgetRenderProps } from '../../types.ts'

   export function WeatherFormFields(): React.ReactNode {
     return (
       <Form.Item label="城市" name={['config', 'city']}>
         <Input />
       </Form.Item>
     )
   }

   export function WeatherRender({ config }: WidgetRenderProps<WeatherConfig>): React.ReactNode {
     return <Typography.Text>{config.city}</Typography.Text>
   }
   ```

   **`widget.ts`** — 组装规格：
   ```ts
   import { defineWidget } from '../../types.ts'
   export const weatherWidgetSpec = defineWidget<WeatherConfig>({
     key: 'weather',            // 会写进用户数据，发布后不要改
     label: '天气',
     defaultTitle: '今日天气',
     defaultConfig: WEATHER_DEFAULT_CONFIG,
     normalizeConfig: normalizeWeatherConfig,
     FormFields: WeatherFormFields,
     Render: WeatherRender,
   })
   ```

2. 在 `src/features/widgets/builtins/index.ts` 的 `installBuiltinWidgets()` 里追加一行 `registerWidget(weatherWidgetSpec)`。

完成后它会自动出现在"组件类型"下拉与组件配置区。

### 组件要访问 API 怎么做

有两条路，都在 `core/api` 之上，不需要碰网络细节：

- **通用数据源（推荐，零代码）**：让用户在表单里选「数据来源 = HTTP 接口」并填地址。
  `useWidgetData` 会把结果显示在 `Render` 的 `data` 里（`data.status` 为 `loading | error | ready`），
  URL 为空时自动不发请求。适合"取回 JSON 直接展示"的组件。
- **组件自己请求**：需要状态码、耗时等请求细节时（参考
  `builtins/http-status-widget/fields.tsx`），在 `Render` 里用
  `useAsyncData((signal) => request({ path, signal }), [deps])`；
  错误用 `toErrorMessage(error)` 转中文，`isAbortError` 判断主动取消。

两种方式都自动获得：超时控制、按策略指数退避重试、卸载/依赖变化时 abort、中文错误文案。

## 网站图标

导航卡片的图标来自第三方接口：

```
https://ico.faviconkit.net/favicon/{domain}?sz=64
```

- 域名从用户填写的网址解析（先按原样解析，失败再补 `https://` 重试）。
- 图标取不到、离线或被墙时，`Avatar`/图标块回退显示名称首字母，不会留空。
- 失败的域名会写入 7 天的负缓存，避免每次渲染都重新请求同一批地址。
- **隐私**：启用后，浏览器会把访问的域名发给该第三方服务；图片请求带
  `referrerPolicy="no-referrer"`。若不想发外部请求，设置环境变量
  `VITE_FAVICON_ENABLED=false`，卡片即只显示首字母。
- 需要换服务时，只改 `src/core/favicon.ts` 里的 `FAVICON_SERVICE`；缓存 key 带服务标识，会自动失效。

## 主题

当前使用 **antd 默认主题**。后续要随主题切换（暗色、自定义主色、FFXIV 配色）时：

- 改 `src/app/theme-config.ts` 的返回值即可，例如 `theme.algorithm = theme.darkAlgorithm`、
  `token.colorPrimary = ...`。
- 自定义样式一律引用 antd 的 CSS 变量（`var(--ant-color-*)`、`var(--ant-border-radius)`），
  因此换主题时这些地方会自动跟随，**不需要逐个改组件**。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 空 | 相对路径请求的前缀；留空则 `request()` 的 path 必须是完整地址 |
| `VITE_API_TIMEOUT_MS` | `10000` | 单次请求超时（毫秒） |
| `VITE_API_RETRIES` | `1` | 重试次数（仅网络错误、超时、5xx；4xx 与主动取消不重试） |
| `VITE_FAVICON_ENABLED` | `true` | 是否请求第三方图标接口 |

## 已知事项

- **构建产物体积**：antd + dnd-kit 后主包约 916 kB（gzip 约 299 kB）。
  这是 antd 全量引入的正常水平；若要优化，可按需做
  `build.rolldownOptions.output.codeSplitting`，或改用 antd 的按需引入方案。
- **`scripts/dsh-sandbox-shim.cjs`**：仅用于受限沙箱环境。
  Vite 在 Windows 上会执行一次 `net use` 探测（识别网络映射盘），
  而受限环境禁止创建管道，导致构建以 `spawn EPERM` 失败。
  该脚本把这一条探测短路掉，让 `pnpm build` 能正常跑：
  ```powershell
  $env:NODE_OPTIONS = "--require C:/path/to/scripts/dsh-sandbox-shim.cjs"
  pnpm build
  ```
  正常开发机与 CI **不需要**它，可以直接删除该文件。
- **未实现（本期范围外）**：路由、导入/导出 JSON、云同步、后端持久化、
  鉴权与密钥管理、跨分组拖拽之外的批量操作。`core/storage/persistent.ts`
  是唯一落盘点，`core/api/config.ts` 的 `configureApi()` 是多后端接入点。

## 参考

- [Ant Design 6 文档](https://ant.design/components/overview-cn)
- [从 v5 到 v6 迁移说明](https://ant.design/docs/react/migration-v6-cn)（本项目已按 v6 写法实现，
  未使用 `bodyStyle` / `bordered` / `maskClosable` / `Space.direction` 等已废弃 API）
- [dnd-kit 文档](https://docs.dndkit.com/)
