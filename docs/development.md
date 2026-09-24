# FFXIV Dash 开发文档

面向贡献者的开发细节文档。项目概览与使用说明见根目录 [`README.md`](../README.md)，主题细节见 [`docs/themes.md`](themes.md)。

## 命令

```bash
pnpm install
pnpm dev        # 开发服务器
pnpm build      # 类型检查 + 生产构建（产物在 dist/）
pnpm lint       # oxlint
pnpm preview    # 预览构建产物
```

## 技术选型

| 关注点 | 选择 | 说明 |
| --- | --- | --- |
| UI | `antd@6` | 要求 React >= 18，原生支持 React 19，不需要 v5-patch |
| 图标 | `@ant-design/icons@6` | 版本必须与 antd 6 匹配 |
| 拖拽 | `@dnd-kit` | 指针 + 键盘双传感器，支持触屏与无障碍排序 |
| 样式 | antd Design Token + 少量全局 CSS | 自定义样式一律引用 antd 的 CSS 变量 |
| 路由 | 暂无 | 单页仪表盘；接路由时改 `src/app/AppShell.tsx` 一处即可 |

## 架构

```
src/
  app/                    应用外壳与全局装配
    AppProviders.tsx        ConfigProvider(中文/主题) → App → ErrorBoundary → BoardPersistence + AutoOpenLinks
    ErrorBoundary.tsx       整站渲染错误边界（组件卡另有单卡边界，见 WidgetRenderer）
    AutoOpenLinks.tsx      「跳转」：每天首次进入页面时自动打开设置里的链接
    theme-config.ts        基线主题 + 把主题规格合成 antd ThemeConfig
    AppShell.tsx           布局外壳；将来接路由的挂载点
    background-layer.ts    生效档案 + 主题预设 → 背景层样式（纯函数）
    themes/                八套主题，一套一个文件夹（<key>/index.ts 令牌 + theme.css 变量）
  core/                   与 React 无关的通用能力
    ids.ts                 唯一 id 生成（含非安全上下文降级）
    guards.ts              通用类型守卫
    asset-url.ts           资源地址解析：public 路径 → 带部署基础路径的链接
    theme-preference.ts    主题键的类型与清单
    group-rules.ts         分组类型能力规则（GROUP_TYPE_META）
    appearance/            外观偏好：色调 + 两个槽位 + 逐主题档案（localStorage）
    clock/                 全局秒级时钟 + 纯格式化函数
    auto-open/             「跳转」：链接文本 + 每日一次门禁
    storage/               BoardDoc 数据模型、schema 校验、localStorage 读写、默认看板
    world.ts / pastel.ts   中国区服务器表 / 图标默认底色
  state/                   仪表盘状态
    board-types.ts         action 与 actions 类型
    board-reducer.ts       纯 reducer，全部不可变更新
    board-store.ts         模块级 store：订阅 + 快照读取 + boardActions（唯一数据源）
    board-storage.ts       读写落盘
    board-persistence.tsx  订阅 store，300ms 防抖写盘
    hooks.ts               useBoardGroupRows / useBoardGroup / useBoardDoc
  features/
    dashboard/            顶栏、编辑弹窗、表单
    search/               搜索弹窗、链接检索、搜索引擎注册表
    settings/             系统设置弹窗（外观 / 主题编辑 / 跳转 / 数据管理）
    groups/               分组面板、拖拽编排、分组表单
    navigation/           导航卡片、卡片栅格、可拖拽卡片
    widgets/              组件框架（注册表 + 渲染器 + builtins/ 内置组件）
  views/
    DashboardPage.tsx     页面组装
  styles/global.css       令牌、基线、背景层、卡片材质、页面布局
```

## 部署基础路径与资源地址

应用部署在子路径下（`vite.config.ts` 的 `base: '/ffxiv-dash/'`）。`base` 只对 Vite 亲手处理的引用生效；**写在 TS 字符串里的路径不会自动带上**，运行时拼 `public/` 下的资源地址一律走 `src/core/asset-url.ts` 的 `assetUrl()`：

```ts
assetUrl('/data/item-db.json')    // → /ffxiv-dash/data/item-db.json
assetUrl('https://x/y.png')       // → 原样返回（http(s): / data: / blob: / //host / 已带 base 的都不动）
```

约定：

- `assetUrl` 是**幂等**函数，出口处不必判断来源，过一遍就行；
- 输入只有两种合法形态：完整链接或 `/` 开头的根相对路径，不做容错；
- 自己写的资源路径统一用 `PublicPath`（`` `/${string}` ``）标注，写错当场编译报错；
- 存进配置的地址必须是部署无关的写法（`/bg/x.webp`），补 base 只发生在 `assetUrl()` 一处；
- 别处不要手写 `import.meta.env.BASE_URL`。

## 数据流

看板状态住在 `state/board-store.ts` 这个**模块级 store**，全站没有看板 Provider：

```
展示层 (features/*)
  └─ boardActions.xxx() 派发 action
       └─ boardReducer（纯函数）产出新 BoardDoc
            ├─ store 通知订阅者；组件按 useSyncExternalStore 的粒度快照决定是否重渲染
            │    · useBoardGroupRows()  → 分组增删/重排时重渲染
            │    · useBoardGroup(id)    → 该分组变化时重渲染
            │    · useBoardDoc()        → 真要整份文档时才用
            └─ BoardPersistence 以 300ms 防抖写入 localStorage
```

选 store 而不是 context 是为了订阅粒度：一次卡片改动只重渲染那张卡，不牵动整页。

⚠️ 改这块前先看 `state/board-store.ts`、`state/hooks.ts` 顶部注释与 `navigation/useStableIdList.ts`：
几处「内容不变就复用旧引用」的缓存是细粒度订阅成立的前提，写错的表现是功能正常但性能回退。

**没有统一的请求层**：需要联网的组件各自封装 URL / 缓存 / 失败态。

## 数据模型

```ts
type BoardDoc = { version: number; groups: Group[] }

type Group = {
  id: string; title: string; type: 'widget' | 'link'
  columns: number   // 分组内卡片列数，1-6；缺省按类型取默认值
  items: Item[]
}

type LinkItem = { id; kind: 'link'; name; url; desc?; icon?; abbreviation? }

type WidgetItem = {
  id; kind: 'widget'
  widget: string                  // 注册表里的 WidgetSpec.key
  title: string
  config: Record<string, unknown> // 由各组件的 normalizeConfig 解释
}
```

- 分组类型规则集中在 `src/core/group-rules.ts` 的 `GROUP_TYPE_META`：每种类型声明 `allowedKinds`、`defaultColumns` 与 `perRow`（widget 独占一行、link 每行最多 4 个）。
- 分组内部排布由 `Group.columns` 决定，用 CSS Grid（`navigation/ItemGrid.tsx`），列数通过 `--dash-grid-columns` 下发，窄屏自动降列。
- 落盘键 `ffxiv-dash:board:v1`；`loadDoc()` 做 JSON 解析 → 结构校验，失败回退默认数据。`SCHEMA_VERSION` 对不上直接判为无法识别（无逐版迁移）。
- 分组类型创建后锁定：`updateGroup` 不接受 `groupType`，换类型就新建分组。

## 搜索

搜索是独立弹窗，不过滤看板。核心约定：

- 只检索已保存链接的 `abbreviation` / `name` / `desc` / `url`，最多 5 条，缩写命中优先；
- 新增搜索引擎只需往 `src/features/search/engines.tsx` 的 `SEARCH_ENGINES` 追加一项（`%%` 占位关键词）；
- 快捷键：`Tab` 开关、`Esc` 关闭、`↑`/`↓` 高亮循环、`Enter` 打开、空白处敲字直接开窗；
- 弹窗是内联 `position: fixed` overlay 而非 antd `Modal`（Modal 会 portal 出 CSS 变量容器）；
- IME 焦点交接用 `flushSync` + `useLayoutEffect`；编辑弹窗打开时全局快捷键 `suspended` 停用；
- overlay 尺寸跟随 `visualViewport`，移动端键盘弹出时卡片被压缩而不是顶出屏幕。

## 系统设置

顶栏齿轮打开，分区数据驱动（`SettingsDialog.tsx` 的 `SECTIONS`），扩展只需追加一项。

| 分组 | 内容 |
| --- | --- |
| 外观 | 色调（浅色 / 深色 / 跟随系统）；浅色与深色各绑一套主题 |
| 主题编辑 | 逐主题改背景与卡片外观，每套一个「恢复默认」 |
| 跳转 | 每行一个链接，每天首次进入页面时自动打开 |
| 数据管理 | 看板导出 / 导入 JSON |

- 「跳转」一天只跳一次（本地 0 点为界，查询与记账在同一次同步调用）；被浏览器拦截时给常驻通知 + 「全部打开」按钮，且 `window.open` 不能带 `noopener`（否则按规范永远返回 null）。
- 主题档案只存改过的项，其余跟主题出厂值；切色调 / 换槽位不重置改动；上传的背景图片逐主题存 IndexedDB，不进导出。
- 导入导出复用落盘格式（`serializeBoardDoc` / `parseBoardDoc`），导入走 `replaceDoc` 前二次确认。

## 拖拽

- 手柄只在 `DragHandle` 上，卡片内链接照常可点；**分组不参与拖拽**，调序用表头四个位置按钮（置顶 / 上移 / 下移 / 置底）。
- 只能同类型卡片互相吸附（`sameKindCollision` 按 `parseDragData` 的 `type` / `kind` 过滤候选容器）。
- 动画三层：拖拽中由 `DragOverlay` 渲染虚影；dnd-kit `transition` 负责让位；落下后 `dropAnimation` 飞回新卡槽。
- ⚠️ 不要给卡片加落位占位、常驻 `opacity` 过渡——会把 dnd-kit 的隐藏/恢复拉成慢淡入淡出，落位后闪一下。

### 性能约定（必须保持）

dnd-kit context 在拖拽每帧换引用，所有 `useSortable` 消费者每帧被唤醒，要做的是别带重活：

| 约定 | 位置 |
| --- | --- |
| 卡片外观 `memo`，props 全部稳定 | `CardFace` + `SortableCard`（`useMemo`/`useCallback` 固定 props） |
| 拖拽状态不存 `GroupBoard` | `BoardDragOverlay` 自己 `useDndContext().active` |
| 虚影内容 `memo` + 模块级常量 | `BoardDragOverlay` 的 `LIFT_STYLE` 等 |
| 卡片不挂 `opacity` 过渡、不做落位占位 | `useSortableCard` 透传 dnd-kit 的 `transition` |

## 时钟与渲染粒度

全应用只有一个秒级时钟（`core/clock/store.ts`）。消费侧声明**自己多久变一次**，快照相等的 tick React 直接跳过渲染：

| 入口 | 用途 |
| --- | --- |
| `useClockValue(select)` | 一行文本读数（selector 必须返回可按值比较的结果） |
| `useClockAt('second' \| 'minute' \| 'hour' \| 'day')` | 整块共用 `now`（本地字段截断，不是 UTC 整除） |
| `useClock()` / `useNow()` | 秒级兜底 |

- ⚠️ selector 每秒都会被调用，重活（如 `Intl.DateTimeFormat` 构造）提到模块级；
- ⚠️ 向下取整的剩余时长不能用粒度 now 算，要留在叶子组件里用文本快照（见 `pvp-map-widget/fields.tsx`）；
- 组件里不要出现 `new Date()` / `Date.now()`（例外：番茄钟的到点判定是动作不是读数）。

## 如何新增一个组件类型

**新增组件不需要改动任何既有组件，也不需要新增依赖**（例外仅 `dayjs`、`marked`）。

1. 新建目录 `src/features/widgets/builtins/<name>-widget/`，放三个文件：

   **`config.ts`** — 纯数据，不导入 React：定义 Config 类型、`DEFAULT_CONFIG`、`normalizeConfig(raw)`。

   **`fields.tsx`** — 只导出组件。`Form.Item` 用 `['config', ...]` 作为 name 路径；`Render` 接收 `WidgetRenderProps<Config>`。

   **`widget.ts`** — `defineWidget<Config>({ key, label, description, defaultTitle, defaultConfig, normalizeConfig, FormFields, Render })`。`key` 会写进用户数据，发布后不要改。

2. 在 `builtins/index.ts` 的 `installBuiltinWidgets()` 里追加一行 `registerWidget(...)`。

完成后自动出现在「组件类型」下拉与配置区。参考例子：

| 需求 | 参考组件 |
| --- | --- |
| 访问 HTTP 接口（URL 去重 / localStorage 缓存 / 失败态） | `market-widget`、`house-widget`、`tax-widget` |
| 每天会清掉的临时状态（独立 localStorage 键，不进导出） | `todo-widget` |
| 渲染 Markdown | `memo-widget`（内容存原文；`marked` 不 sanitize，必须用它的 renderer 覆盖收危险面：HTML 转义、链接一律当外链、不产出 `<img>`） |
| 系统通知 / 状态机计时 | `pomodoro-widget`（计时状态不落盘；`Notification` 权限只在编辑弹窗里申请） |
| 日期选择 | 配置只存 `YYYY-MM-DD`，转换放在 `getValueProps` / `normalize` 两端（`countdown-widget`） |

## 图标底色

导航卡片的图标不发外部请求：`icon` 填图片地址就显示图片，否则显示「一个字符 + 一层底色」（字符取 `icon` 首字，`Intl.Segmenter` 按字素簇切）。

底色由 `src/core/pastel.ts` 决定：FNV-1a 32 位稳定 hash + 12 色人工调过的 pastel 调色板，key 取域名。⚠️ `pastelPalette` 的顺序即取值顺序，加色或换序会让所有已有链接整体换色。

## 主题

八套主题（默认-浅色 / 默认-深色 / 苍穹 / 红莲 / 暗影 / 晓月 / 金曦 / 银海），一套一个文件夹：

```
src/app/themes/<key>/index.ts     该主题的 antd 令牌（叠在基线之上）与元信息
src/app/themes/<key>/theme.css    该主题的 --dash-* 变量（按需）
```

- 新增主题：复制文件夹改 `key` / `label` / 令牌，再在 `core/theme-preference.ts` 的 `THEME_KEYS` 与注册表里各加一行（漏一套会编译报错）；
- 删主题：删文件夹 + 删两处键，不需要清理残留变量；
- antd 令牌管组件与浮层，`--dash-*` 变量管 html/body 底色、卡片底色与投影；
- ⚠️ 主题键会写进 `localStorage`，发布后不要改名；
- ⚠️ 不要写跨作用域的变量链式引用；antd 的 `--ant-color-primary` 是色板第 6 档，会比种子色深一档。

取色来源与全部约定见 **[`docs/themes.md`](themes.md)**。

## 已知事项

- 构建产物主包约 1.27 MB（gzip 约 410 kB），是 antd 全量引入的正常水平；如需优化可做 codeSplitting 或按需引入。
- `scripts/dsh-sandbox-shim.cjs` 仅用于受限沙箱环境（短路 Vite 在 Windows 上的 `net use` 探测，否则 `pnpm build` 以 `spawn EPERM` 失败）：
  ```powershell
  $env:NODE_OPTIONS = "--require C:/path/to/scripts/dsh-sandbox-shim.cjs"
  pnpm build
  ```

## 参考

- [Ant Design 6 文档](https://ant.design/components/overview-cn)（本项目按 v6 写法实现）
- [从 v5 到 v6 迁移说明](https://ant.design/docs/react/migration-v6-cn)
- [dnd-kit 文档](https://docs.dndkit.com/)
