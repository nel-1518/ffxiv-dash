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
    theme-config.ts         基线主题 + 把主题规格合成 antd ThemeConfig
    AppShell.tsx            布局外壳；将来接路由的挂载点（只负责把视图放进 Layout）
    background-layer.ts     外观快照 + 主题预设 → 背景层样式（纯函数，无 React）
    themes/                 八套主题，一套一个文件夹
      types.ts              ThemeSpec（antd 令牌 / 默认背景 / 默认卡片外观）
      index.ts              注册表（Record<ThemeKey, ThemeSpec>，缺一套会编译报错）
      hooks.ts              useTheme()
      appearance-sync.ts    换主题时把该主题的背景与卡片参数写进外观偏好
      <key>/index.ts        该主题的 antd 令牌与元信息
      <key>/theme.css       该主题的 --dash-* 变量（按需）
  core/                   与 React 无关的通用能力
    ids.ts                  全项目唯一 id 生成入口（含非安全上下文降级）
    guards.ts               通用类型守卫（isRecord）
    theme-preference.ts     主题偏好（默认-浅色 / 默认-深色 / 苍穹 / 红莲 / 暗影 / 晓月 / 金曦 / 银海）
    appearance/
      store.ts              外观偏好（背景来源 / 模糊 / 亮度 / 卡片不透明度 / 卡片模糊）
      image-store.ts        上传的背景图片存 IndexedDB（不进导出）
      hooks.ts              useAppearance()
    clock/
      store.ts              全局秒级时钟（引用计数订阅，无 Provider）
      hooks.ts              useClock() / useNow()
    world.ts                中国区服务器表（大区 / 世界）
    favicon.ts              网站图标第三方接口封装
    favicon-cache.ts        图标失败负缓存（避免离线时反复重试）
    storage/
      types.ts              BoardDoc / Group / Item 数据模型
      schema.ts             校验、归一化、版本迁移
      persistent.ts         localStorage 读写（含回退与归一化回写）
      default-board.ts      初始演示数据
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
    settings/               系统设置弹窗（外观 / 数据管理）
      SettingsDialog.tsx      左侧分组 + 面板容器（分区是数据驱动的）
      AppearanceSettingsPanel.tsx 外观外壳：主题 → 背景 → 卡片
      appearance/             外观面板的三个自洽子模块
        ThemePicker.tsx         八选一 + 换主题时同步背景与卡片参数
        BackgroundSection.tsx   背景来源四选一 + 三种编辑器 + 图片显示
        Tunings.tsx             滑块行 + 背景显示 / 卡片底色两组调节
      DataSettingsPanel.tsx   导入导出
    groups/                 分组面板、拖拽编排、分组表单
    navigation/             导航卡片、卡片栅格、可拖拽卡片
    widgets/                组件框架（注册表 + 渲染器）
      types.ts              WidgetSpec / WidgetRenderProps / defineWidget
      registry.ts           注册表（不导入任何具体组件，避免循环依赖）
      useFavicon.ts         图标接口 hook
      WidgetRenderer.tsx    统一卡片外壳 + 未注册组件降级
      builtins/             内置组件，每个一个目录（stats / pvp-map / market）
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
| 外观 | 主题（八选一，默认-浅色 / 默认-深色 / 金曦 / 晓月 / 银海 / 暗影 已做完）；背景（无·跟随主题 / 纯色 / 图片链接 / 上传图片，图片固定铺满裁切、可调模糊·亮度）；卡片（不透明度、毛玻璃模糊） |
| 数据管理 | 把看板导出为 JSON；或从 JSON 导入覆盖当前看板 |

以上参数都**立即生效**；主题与外观偏好都不属于看板数据（各自独立 key），因此不进导出。

**换主题会连外观一起换**（`app/themes/appearance-sync.ts`）——**主题会盖掉你自己调过的值**：

| 项 | 规则 |
| --- | --- |
| 背景 | 主题自带图（银海是 `/bg/8-evercold.webp`）就自动写进「图片链接」并把模糊/亮度改成预设值；主题不带图（其余两套还没做）就退回「无」 |
| 卡片 | 取 `ThemeSpec.cards` 的不透明度 / 毛玻璃模糊 |
| 主题没声明的项 | 回到基线（背景 →「无」、卡片 → 62 / 12），**不沿用上一套主题留下的值** |

背景写成「图片链接」而不是留个隐形回落，是为了让这张图的参数能在设置里直接调
（「图片显示」一节只在图片来源下才出现）。换完随时可以自己再改。
被盖掉的值不会丢：颜色 / 地址 / 上传文件名都还在状态里（上传的图也仍在 IndexedDB），
点回对应来源就回来了。点到已选中的主题不做任何事（不会把调过的滑块重置）。

「背景来源 = 无」= 跟随主题自带的背景（主题有图就显示图，没图才只剩底色）。
主题细节见下面「主题」一节。

**顶栏是页面顶端的一整条元素**（不在内容列里，所以天然铺满视口宽），它挂 `dash-card-surface` ——
与卡片**同一套材质与适配**（同一个 `--dash-card-bg` / 毛玻璃 / 投影），**无圆角**（一条平直的横幅），
下面不再需要分割线。内容靠 `padding-inline: max(--dash-page-pad-x, (100% - 1600px) / 2 + 留白)`
卡进内容列 —— 与 `.dash-container` 的「居中限宽 + 两侧留白」是等价写法，
所以主色紫条与分组卡左右缘都对得上（实测同宽：745 = 745）。
⚠️ `--dash-page-pad-x` 必须在 `:root` 里给到（断点只负责覆盖）：它一旦解析不到，
`padding-inline` 会退成 `0`，顶栏与整个看板都会顶到屏幕边缘。
⚠️ 把它挂上 `dash-card-surface` 是必须的：银海是"深色主题 + 浅色卡片"，顶栏拿到那块白玻璃的同时，
必须一并拿到卡片那套浅色令牌，否则会变成**白底白字**（问候语读的是 `colorTextHeading`，
所以那一项也得在浅色岛里给到）。
（**晓月与银海是例外**：晓月刻意让顶栏留在暗色、只让卡片变亮；银海的顶栏是
**半透明白玻璃**（`rgba(255,255,255,.25)` + `blur(10px)`），文字改用白系。
两套的做法都是把顶栏用 `:not(.dash-topbar)` 排除出浅色岛 ——
⚠️ 只把 `--dash-card-bg` 换成半透明白是**不够的**：那层白透出来的是压暗后的背景图，
浅色岛的 `#333` 压上去只剩 **1.9:1**，整条栏读不了。）
起因是实测数据：Dawntrail 背景图在顶栏那一带平均亮度 0.434、最亮处 0.70（照片的天空），
浅色问候语压在上面只有约 1.2:1 —— 换字体颜色救不回来（照片的暗部又会反过来吃掉深色字）。
有底后那一带实测亮度降到 0.058，问候语 8.3:1、时间读数 6:1（银海那种白玻璃上则是 9.8:1）。

原来的「通用设置」里只有主题一项，主题搬到「外观」后该分区空了，整个分区已删除。

**导入导出复用落盘格式**：`core/storage/persistent.ts` 的 `serializeBoardDoc` / `parseBoardDoc`
产出与读取的都是 `{ version, board }` 这个信封，校验也走与启动时同一套 `sanitizeBoardDoc`。
因此导出的文件既能被别人导入，也能直接当作 `localStorage` 的值用；反过来，
把本地原始值导出来也照样能读。导入经 state 层的 `replaceDoc` action 整体替换，
替换前弹二次确认（列出行数，且是不可撤销的危险操作）。
扩展方式：往 `SettingsDialog.tsx` 的 `SECTIONS` 追一项（标签 / 图标 / 面板各一个字段）即可，
导航与面板由同一份数据驱动，不必再去补分支。

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
     description: '显示指定城市当前的天气与温度，数据每 10 分钟刷新一次。', // 编辑弹窗里展示的用途说明
     defaultTitle: '今日天气',
     defaultConfig: WEATHER_DEFAULT_CONFIG,
     normalizeConfig: normalizeWeatherConfig,
     FormFields: WeatherFormFields,
     Render: WeatherRender,
   })
   ```

2. 在 `src/features/widgets/builtins/index.ts` 的 `installBuiltinWidgets()` 里追加一行 `registerWidget(weatherWidgetSpec)`。

完成后它会自动出现在"组件类型"下拉与组件配置区。

### 组件要访问接口怎么做

**没有统一的请求层**（早先"数据来源 = HTTP 接口"那套能力已整体删除，`core/api` 已不存在）。
需要联网的组件自己封装，可参考 `builtins/market-widget/` 的分工：

- `universalis.ts` 只管 URL / 请求 / 解析（模块级**按 URL 在飞去重**，避免重复请求）；
- `cache.ts` 管 localStorage 缓存（带 TTL、写入时顺手清过期）；
- 组件在 `Render` 里自己渲染加载与失败态（市场卡把状态挤在标题行右侧，不占版面）。

`WidgetRenderProps` 只给 `{ config, item }`，**没有任何异步态**。

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

设置 → 外观里有八套主题：**默认-浅色 / 默认-深色** 与 **苍穹 / 红莲 / 暗影 / 晓月 / 金曦 / 银海**。

- **默认-浅色（默认主题）**：就是基线本身（`ThemeSpec.antd` 为空），不维护任何色值 ——
  基线改了什么它就跟着改什么。
- **默认-深色**：antd 深色算法（`darkAlgorithm`）的原生观感，只覆盖 `colorBgLayout`
  （基线里的浅灰版必须盖掉，否则会变成"浅色页面 + 深色卡片"）。
  ⚠️ 它**不需要**银海那套"把卡片内文字整体翻成浅色"的写法：那边是"深色主题 + 浅色卡片"
  的错配才要补，这里卡片与页面同属深色系，正文色直接来自深色令牌。
- **银海**：完整配色（参考官方专题站 <https://na.finalfantasyxiv.com/evercold/>，
  只取颜色/边框/阴影，不带站内的图片与视频）。**深色页面 + 浅色玻璃卡**，
  卡片内需要一整套浅色令牌覆盖（见下面的「银海：深色页面上的浅色卡」）。
- **金曦**（参考 <https://na.finalfantasyxiv.com/dawntrail/>，同一套采样手法）：
  暖黑底 `#1a1918` + 亮金 `#ffd966` + 古金链接 `#d9bf57`，分区靠一条**淡金发丝边**
  （站点是 `rgba(255,244,128,.1)`）而不是实线；背景用本地 `7-dawntrail.webp`（暖深棕底）。
  ⚠️ 站点上出现最多的蓝 `#73bfe6` 是 **Lodestone 公共站导航**的颜色，不代表 Dawntrail，
  所以没有采用（否则会和银海撞脸）。
  ⚠️ 它**不需要**银海那套浅色岛：站点自己的面板就是暖棕黑，卡片与页面同属深色系。
  两个实测值（种子渲染后会变一档，同银海）：`colorPrimary #ffd966` → 实测 `#dcbb5a`；
  `colorError #ff6b7d` → 实测 `#dc5e6d`（直接用站点的绋红 `#e52e4d` 会渲染成 `#c62a44`，
  压在暖棕卡上只有 2.8:1，删除图标看不清）。另外 `colorTextDescription` 要显式抬到 .6：
  它是 `type="secondary"` 真正读的令牌，深色算法默认的 .45 在暖棕卡上只有 4.3:1。
- **晓月**（参考 <https://na.finalfantasyxiv.com/endwalker/>，同一套采样手法）：
  冷黑底 `#18181a` + 月光白标题 `#f0f0f0` + 灰紫发丝边 `#bcbccc`。
  站点真正的签名是 `.endwalker-btn` 上那支**三色渐变**
  `linear-gradient(to right, #3d4d99 0%, #3689b3 50%, #cc7a29 100%)`（蓝紫 → 青 → 琥珀），
  但靛蓝端 `#3d4d99` 压在卡上只有 1.8:1，所以只取**色相方向**再往亮提
  （主色靛蓝紫 `#9aa8ff` → 实测 `#8692dc`；链接与警告取琥珀端 `#d9a05c` / `#cc7a29`）；
  中间的青端不采用 —— 与银海的冰蓝 `#73bfe6` 是同色域，用了会撞脸。
- **晓月是八套里唯一"暗顶栏 + 亮卡片"的主题**（银海是"暗页面 + 亮卡"，但顶栏跟着卡片走）：
  顶栏与卡片本来共用 `dash-card-surface` 那一层材质，这里用 `:not(.dash-topbar)`
  把两者拆开 —— 顶栏重算一条更暗的底，卡片换成**纯色 `#F5F5FA`**（用户指定，不要渐变；
  两端给成同一个通道值，`.dash-shell` 拼出来就是平底）。
  ⚠️ 拆的时候**必须**把顶栏排除出浅色岛，否则暗色顶栏会被翻成"深色字 + 暗底"，直接看不见。
  ⚠️ 顶栏那条底要在**顶栏自己身上**重写 `--dash-card-bg`：那条变量是在 `.dash-shell` 上
  算好的，在顶栏里改 `--dash-card-rgb` 追不上它。不透明度仍吃滑块的 `--dash-card-alpha`。
  ⚠️ 它**需要**一整套浅色岛（卡内文字整体翻深色，同银海），因为页面与顶栏都是暗的。
- **暗影**（参考 <https://jp.finalfantasyxiv.com/shadowbringers/>，同一套采样手法）：
  近黑底 + 紫罗兰的三层结构（站点实测 —— 区块底 `#20202e` / 面板 `#282640` / 导航 `#272729`），
  主紫 `#5047b2`（实心按钮的底色）、标题亮紫罗兰 `#968cff`、选中态淡紫 `#a299ff`、
  提示洋红 `#bf3054`。主色种子 `#a79dff` → 实测渲染 `#9188dc`。
- **暗影的卡片照着首页那排 `.new_content__list` 做**（用户指名）。参考卡实测：
  300×437、圆角 16px、底色 `rgba(0,0,0,.5)`、整块可点；
  `a::before` 是 `linear-gradient(to bottom, rgb(80,71,178), rgba(4,0,51,.8))` 且默认 `opacity:0`；
  `:hover` 时 `translateY(-10px)` 且覆盖层 `opacity:1`。
  归纳成"半透明紫黑底 + 悬浮时浮起并铺一层紫罗兰渐变 + 紫罗兰当强调文字"。
  ⚠️ 数值按尺寸折算：参考卡是 300×437 的大卡，圆角收到 14px / 10px、浮起沿用全局既有的 2px，
  渐变的 alpha 提到接近实色（我们的卡小、底下又压着背景图，太透就看不出那层紫）。
  ⚠️ 悬停只给**导航卡**：组件卡里有进度环、地图块这些自己的用色，整块换紫底会让它们失衡。
  ⚠️ 那层紫是靠 `--dash-card-bg-hover` 变量下发的 —— 导航卡的底色写在 `CardFace` 的
  inline style 里，**inline style 的特异性最高，CSS 规则压不过它**（同一个选择器下的
  `transform` 却能生效，很容易误判成规则写错了）。
  ⚠️ 「卡片不要边框」同理走变量：`CardFace` 那行 border 已拆成
  `var(--dash-card-border-width, 1px) solid var(--dash-card-border, …)` ——
  只把颜色设成 `transparent` 时**那 1px 的位置还在**，卡片边缘会留一条发丝线，
  必须把 `--dash-card-border-width` 归零（组件卡则写 `border-width: 0`）。
- 其余两套（苍穹 / 红莲）选用后会沿用基线主题，等各自配色做好。

### 一套主题 = 一个文件夹

主题键用资料片英文名（两套中性底色除外），与 `public/bg/` 里的背景图一一对应：

| 主题 | 键 | 背景图 |
| --- | --- | --- |
| 默认-浅色 | `default-light`（默认） | —— |
| 默认-深色 | `default-dark` | —— |
| 苍穹 | `heavensward` | `3-heavensward` |
| 红莲 | `stormblood` | `4-stormblood` |
| 暗影 | `shadowbringers` | `5-shadowbringers` |
| 晓月 | `endwalker` | `6-endwalker` |
| 金曦 | `dawntrail` | `7-dawntrail` |
| 银海 | `evercold` | `8-evercold` |

```
src/app/themes/<key>/index.ts     该主题的 antd 令牌（叠在基线之上）与元信息
src/app/themes/<key>/theme.css    该主题的 --dash-* 变量（只改 antd 令牌的主题不需要）
```

- 新增主题：把文件夹复制一份，改 `key`/`label`/令牌，再在 `core/theme-preference.ts` 的
  `THEME_KEYS` 与注册表里各加一行 —— 注册表是 `Record<ThemeKey, ThemeSpec>`，
  **漏一套会直接编译报错**，不会出现"选择器里有、注册表里没有"的空档。
- 所有主题都以 `app/theme-config.ts` 的 **基线主题**为底，各主题只声明要覆盖的项；
  因此"还没做配色"的主题（`antd: {}`）与加主题系统之前完全一致，不会把界面改坏。
- 删主题：删文件夹 + 删两处键，**不需要清理任何残留**（见下面的"切主题不用清变量"）。
- **卡片描边由一个变量统一控制**（`--dash-card-border-width`，默认 `1px`）：
  导航卡那条 border 写在 `CardFace` 的 inline style 里、组件卡写在 global.css 的
  `.ant-card.dash-card-surface` 上，两边读的是同一个变量 —— 主题想"不要边框"
  只需把变量归零（金曦 / 晓月 / 银海 / 暗影 四套都归零，默认两套保留）。
  ⚠️ 只把 `--dash-card-border` 设成 `transparent` **不管用**：那 1px 的位置还在，
  卡片边缘会留一条发丝线（inline style 的特异性最高，颜色压得下去、宽度压不下去）。
- ⚠️ 主题键会写进 `localStorage`（`ffxiv-dash:theme:v1`），发布后不要再改名；
  改过名也没关系：校验通不过的旧值会自动回落到默认主题。

### 两套机制各管一半

| 机制 | 管什么 | 位置 |
| --- | --- | --- |
| antd 令牌 | 组件自身的颜色/圆角/字体、弹窗与浮层 | `<key>/index.ts` |
| `--dash-*` 变量 | antd 变量管不到的地方：`html/body` 底色、卡片底色与描边、投影 | `<key>/theme.css` |

`theme.css` 里的变量写在 `[data-dash-theme='<key>']` 作用域下，属性由 `AppProviders`
挂到 `<html>` 上（这样 portal 到 body 的弹窗也能命中）。没被新主题定义的变量会自动回落到
`global.css` 里 `:root` 的默认值 —— **切主题不需要清理旧变量**。

### 两个坑

- ⚠️ 变量替换发生在**声明它的元素**上，别写 `--a: rgb(var(--ant-color-…)/…)` 这种跨作用域链式引用：
  拿不到值的变量会让整条声明直接失效（应该把回退写在**使用处**：`var(--dash-x, var(--ant-color-y))`）。
- ⚠️ antd 的 `--ant-color-primary` **不等于**你传的 `colorPrimary`：它是色板第 6 档（palette[5]），
  会比种子色深一档（银海传 `#73bfe6`，实际渲染 `#65a5c7`）。想完全对色得反推种子，一般没必要。

### 银海：深色页面上的浅色卡

做法都在 `themes/evercold/theme.css`，另有三个必须知道的点：

- **卡片内的 antd 组件要把变量逐个重写**。antd 6 会给每个组件自身的根元素再挂一份
  `css-var-*` 作用域（变量就定义在那个类上），只把变量写在卡片根上，卡片**里面的**
  `<Typography>` / `<Progress>` 会把深色那套盖回去。因此覆盖规则的选择器列表里
  **连 `*` 一起选**，把同一套浅色变量写到卡片内每一个元素上（特异性 `(0,3,0)` 才压得住组件的 `(0,1,0)`）。
  顺带的好处：我们自己的 `.dash-market-*` / `.dash-stats-*`（用 `var(--ant-color-*)`）会自动跟着变。
- ⚠️ **组件级令牌（`--ant-<组件>-*`）不在上面那批里**：它们是构建时按 `colorText` 算好后写死的字面量，
  使用时不再回头读 `--ant-color-*`。深色算法算出来的值落在白卡上就是「白画在白上」——
  实测漏网的是进度环的底槽 `--ant-progress-remaining-color` 与环心数字 `--ant-progress-circle-text-color`，
  必须按名字点掉。将来新增组件若出现同类问题，把该组件根上声明的 `--ant-*` 属性列出来再定点覆盖。
- **参考站的数值按「尺寸 + 密度」两道折算，不能照搬**：参考元素是一张 981×630 的大卡
  （圆角 24 / 发光 32 / 内边距 48），而我们组件卡约 200×150、导航卡约 200×44，且是成排密铺的。
  ① 尺寸：圆角按比例收到 `16px 6px`（组件卡）/ `12px 4px`（导航卡，24px 会超过单行卡的一半高），
  内边距不跟；② 密度：32px 的发光收成「贴边一圈白边 + 很淡的外晕」，
  20 张卡的白光叠在一起会糊成一片雾、卡反而与底色分不开。悬停浮起只有一张卡被指到，可以放开一点。

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
