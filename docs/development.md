# FFXIV Dash 开发文档

项目概览见根目录 [`README.md`](../README.md)，主题细节见 [`themes.md`](themes.md)。

## 命令

```bash
pnpm install
pnpm dev          # 开发服务器
pnpm build        # 类型检查 + 生产构建（部署在 /ffxiv-dash/ 子路径）
pnpm build:root   # 同上，按根路径 / 部署构建
pnpm lint         # oxlint
pnpm preview      # 预览构建产物
```

## 技术选型

| 关注点 | 选择 | 说明 |
| --- | --- | --- |
| UI | `antd@6` | 原生支持 React 19，无需 v5-patch |
| 图标 | `@ant-design/icons@6` | 版本必须与 antd 匹配 |
| 拖拽 | `@dnd-kit` | 指针 + 键盘，支持触屏与无障碍 |
| 样式 | antd Token + 少量全局 CSS | 自定义样式一律引用 antd 的 CSS 变量 |
| 路由 | 暂无 | 单页仪表盘；接路由改 `AppShell.tsx` 一处即可 |

## 架构

```
src/
  app/                    应用外壳与全局装配
    AppProviders.tsx        ConfigProvider(中文/主题) → App → ErrorBoundary → BoardPersistence + AutoOpenLinks
    ErrorBoundary.tsx       整站渲染错误边界（组件卡另有单卡边界，见 WidgetRenderer）
    AutoOpenLinks.tsx       每日自动跳转：每天首次进入自动打开设置里的链接
    theme-config.ts         基线主题 + 稳定 CSS 变量作用域 + 合成 antd ThemeConfig
    AppShell.tsx            布局外壳；将来接路由的挂载点
    background-layer.ts     生效档案 + 主题预设 → 背景层样式（纯函数）
    themes/                 八套主题，一套一个文件夹（<key>/index.ts 令牌 + theme.css 变量）
  core/                    与 React 无关的通用能力
    ids.ts                  唯一 id 生成（含非安全上下文降级）
    guards.ts               通用类型守卫
    asset-url.ts            资源地址解析：public 路径 → 带部署基础路径的链接
    theme-preference.ts     主题键的类型与清单
    group-rules.ts          分组类型规则 GROUP_TYPE_META + 组件实例全局计数
    link-metadata.ts        链接元数据客户端：抓标题 / 描述 / 图标
    world.ts / pastel.ts     中国区服务器表 / 链接图标默认底色
    appearance/             外观偏好：色调 + 槽位 + 逐主题档案（localStorage + IndexedDB 背景图）
    clock/                  全局秒级时钟 + 纯格式化函数
    search/                 搜索引擎配置（localStorage 小 store）
    auto-open/              每日自动跳转：链接文本 + 每日一次门禁
    storage/               BoardDoc 数据模型、schema 校验、localStorage 读写、默认看板
  state/                   仪表盘状态
    board-types.ts          action 与 actions 类型
    board-reducer.ts        纯 reducer，全部不可变更新；实例上限的最后闸门
    board-store.ts          模块级 store：订阅 + 快照 + boardActions（唯一数据源）
    board-storage.ts        读写落盘
    board-persistence.tsx   订阅 store，300ms 防抖写盘
    group-rows.ts           分组 → 行结构（内容不变则引用不变）
    hooks.ts                useBoardGroupRows / useBoardGroup / useBoardDoc
  features/
    dashboard/              顶栏（问候语 + 双时钟）、看板表面、编辑弹窗、卡片表单
    search/                 搜索弹窗、链接索引与检索、搜索引擎行组装
    settings/               设置弹窗（七个分区面板 + theme/ 主题编辑器）
    groups/                 分组面板、分组看板、拖拽虚影、分组表单
    navigation/             导航卡片、卡片栅格、拖拽（拖拽模块都住这里）
    widgets/                组件框架：types + registry + WidgetRenderer + builtins/
  views/
    DashboardPage.tsx       页面组装（刻意不订阅任何看板数据）
  styles/
    global.css              令牌、基线、背景层、卡片材质、页面布局
    axis-font-icons.css     游戏内图标字体（FFXIV Lodestone SSF，见 public/fonts/）
```

## 部署基础路径与资源地址

应用部署在子路径（`vite.config.ts` 的 `base: '/ffxiv-dash/'`）。`base` 只对 Vite 处理的引用生效，TS 字符串里的路径不会自动带上——运行时拼 `public/` 资源地址一律走 `src/core/asset-url.ts`：

```ts
assetUrl('/data/item-db.json')   // → /ffxiv-dash/data/item-db.json
assetUrl('https://x/y.png')      // 完整链接 / data: / blob: / //host / 已带 base 的原样返回
```

约定：

- `assetUrl` 幂等，出口处不必判断来源；
- 输入只认完整链接或 `/` 开头的根相对路径，不做容错；
- 资源路径用 `PublicPath`（`` `/${string}` ``）标注，写错编译报错；
- 存进配置的地址写部署无关形式（`/bg/x.jpg`），补 base 只发生在 `assetUrl()` 一处；
- 别处不要手写 `import.meta.env.BASE_URL`。

## 数据流

看板状态住在 `state/board-store.ts` 的模块级 store，全站没有看板 Provider：

```
features/* ─ boardActions.xxx() → boardReducer（纯函数）→ 新 BoardDoc
  ├ store 通知订阅者，组件按 useSyncExternalStore 快照决定是否重渲染
  │   · useBoardGroupRows()   分组增删 / 重排时
  │   · useBoardGroup(id)     该分组变化时
  │   · useBoardDoc()         需要整份文档时才用
  └ BoardPersistence 300ms 防抖写入 localStorage
```

选 store 而非 context 是为了订阅粒度：一次卡片改动只重渲染那张卡，不牵动整页。

⚠️ 改这块前先读 `board-store.ts`、`state/hooks.ts`、`navigation/useStableIdList.ts`、`search/link-index.ts` 的顶部注释——「内容不变就复用旧引用」的缓存是细粒度订阅的前提，写错的表现是功能正常但性能回退。

- 组件写回自己的配置（进度卡 +1、便签行内编辑）不走 hook，直接调 `boardActions.updateItemConfig(item.id, patch)`；
- 没有统一请求层：联网组件各自封装 URL / 缓存 / 失败态。

## 数据模型

```ts
type BoardDoc = { version: number; groups: Group[] }

type Group = {
  id: string; title: string; type: 'widget' | 'link'
  columns: number   // 分组内卡片列数，1-6；缺省按类型取默认值
  items: Item[]
}

type LinkItem = { id; kind: 'link'; name; url; desc?; icon?; abbreviation? }
// abbreviation：纯 ASCII 字母数字、有长度上限，搜索时优先匹配

type WidgetItem = {
  id; kind: 'widget'
  widget: string                  // 注册表里的 WidgetSpec.key
  title: string                   // 统一取组件类型的 defaultTitle
  config: Record<string, unknown> // 由各组件的 normalizeConfig 解释
}
```

- 分组类型规则集中在 `core/group-rules.ts` 的 `GROUP_TYPE_META`：`allowedKinds` / `defaultColumns` / `perRow`（widget 独占一行、link 每行最多 4 个）。列数经 `--dash-grid-columns` 下发给 CSS Grid（`navigation/ItemGrid.tsx`），窄屏自动降列。
- 落盘键 `ffxiv-dash:board:v1`，`SCHEMA_VERSION` 为 4。`loadDoc()` 做 JSON 解析 → 结构校验，失败回退默认数据；版本对不上直接判为无法识别（无逐版迁移，破坏性改动靠重置数据）。
- **读盘失败要说出来**：`loadDoc()` 返回 `{ doc, failure }`（`storage` / `json` / `schema` 三档），回退时不写盘、坏数据留在原地；顶栏据此亮 `Alert`（`BoardLoadAlert.tsx`），按钮直达数据管理，落盘成功一次即清除。数据操作都在数据管理里：导出看板原文（`readStoredBoardText` / `rawBoardFileName`）、导入备份、恢复默认（只换看板，不动跳转 / 搜索引擎 / 外观）。
- 组件配置归一化由 widgets 层运行时注入 core（`registry.ts` 的 `installWidgetConfigNormalizer` → `storage/persistent.ts`），避免 core 反向依赖 feature；未注册类型保留原始配置，界面用降级卡提示。
- **实例上限**：每种类型跨分组全局计数，上限由 spec 的 `maxCount` 声明（缺省 20，设 0 禁止新增）。两道闸门：表单里达上限的选项禁用并标注（正在编辑的实例自己的类型除外），reducer 在新增 / 换类型时拒绝落库。
- 分组类型创建后锁定：`updateGroup` 不接受 `groupType`，换类型就新建分组。

## 搜索

独立弹窗，不过滤看板。要点：

- 只检索已保存链接（`kind === 'link'`），最多 5 条。命中分档排序：缩写精确 → 缩写前缀 → 缩写包含 → 名称 → 描述 / 网址，同档保持看板顺序（`search/searchLinks.ts`）；
- 链接索引「内容不变则引用不变」（`search/link-index.ts`），搜索侧订阅它而非整份看板，组件卡片的改动不会惊动搜索；
- 搜索引擎是用户配置（键 `ffxiv-dash:search-engines:v1`，默认 8 个：百度、必应、哔哩哔哩、小红书、微博、石之家、FF14 WIKI、物品检索器），设置里增删 / 启停 / 排序 / 恢复默认；模板 `%s` 是关键词占位符（替换时自动 `encodeURIComponent`，模板不要自己编码）；
- 快捷键：`Tab` 开关、`Esc` 关闭、`↑`/`↓` 高亮循环、`Enter` 打开、页面空白处敲字母数字开窗、`Ctrl+V` 粘贴开窗（顺手清掉 FF14 物品名里的私有区字符）；
- 弹窗是内联 `position: fixed` overlay 而非 antd `Modal`：尺寸跟随 `visualViewport`，移动端键盘弹出时卡片被压缩而不是顶出屏幕；
- IME 焦点交接用 `flushSync` + `useLayoutEffect`；编辑弹窗或设置打开时全局快捷键停用（Tab 留给表单）。

## 系统设置

顶栏齿轮打开，分区数据驱动（`SettingsDialog.tsx` 的 `SECTIONS`），扩展只需追加一项。左侧导航底部有 GitHub 仓库入口，刻意留在 tablist 外（避免「能选中却没有内容」的 tab）。

| 分组 | 内容 |
| --- | --- |
| 外观 | 色调（浅 / 深 / 跟随系统）；浅色与深色各绑一套主题 |
| 主题编辑 | 逐主题改背景与卡片外观，每套一个「恢复默认」 |
| 批量添加链接 | 每行一个（一次最多 20 行），选已有分组或新建；逐条抓元数据，已有地址跳过，风险标签汇总提示 |
| 搜索引擎 | 增删 / 启停 / 拖动排序 / 恢复默认 |
| 每日自动跳转 | 每行一个链接，每天首次进入自动打开 |
| 数据管理 | 看板 + 设置的导出 / 导入（外观只收显示参数） |
| 关于 | 数据接口、参考资料、技术栈（`AboutSettingsPanel.tsx`） |

- 「每日自动跳转」一天一次（本地 0 点为界，查询与记账在同一次同步调用，键 `ffxiv-dash:auto-open:v1`）；被浏览器拦截时给常驻通知 + 「全部打开」按钮，且 `window.open` 不能带 `noopener`（否则永远返回 null）。
- LinkMetadata 是第三方公开服务，按 IP 限流（每 10 秒 20 次，超了封 10 秒）：按 URL 去重共用请求、批量调用顺序发送，别加并发池。元数据只取标题 / 描述 / favicon。
- 新建单个链接是两步表单（`EditDialog.tsx`）：先填网址 → 抓元数据回填 → 再展示全部字段；失败可重试或手填。
- 主题档案只存改过的项，其余跟出厂值；切色调 / 换槽位不重置改动。上传的背景图逐主题存 IndexedDB——图片本体不进导出文件、不随备份导入，导入只收四个显示数值（详见 [`themes.md`](themes.md) 的「槽位与逐主题档案」）。
- 备份文件见 `core/storage/backup.ts` 的 `BackupFile`：`board` + `autoOpen`（只带链接原文）+ `searchEngines` + `appearance`（导出全量）。看板段复用 `parseBoardDocValue` 校验（认不出整份拒绝、不动现有数据），三段设置各自归一化、坏了回落默认；导入前二次确认，确认后四段一起覆盖，**不兼容早期「裸 BoardDoc」导出文件**。
- **导入前快照**：覆盖前四段数据存 `ffxiv-dash:import-undo:v1`（`saveImportUndo`），数据管理面板亮「恢复导入前的数据」按钮；恢复是整份搬回（外观整体替换，不走白名单——快照来自本机，引用的就是本机 IndexedDB 里的图）。快照一次性：恢复或再次导入都会重写；被手改坏时读取即清，按钮不亮。

## 拖拽

- 手柄只在 `DragHandle` 上，卡内链接照常可点；分组不参与拖拽，调序用表头四个位置按钮（置顶 / 上移 / 下移 / 置底）；
- 只同类型卡片互相吸附（`sameKindCollision` 按 `parseDragData` 的 `type` / `kind` 过滤候选容器）；
- 动画三层：拖拽中 `DragOverlay` 渲染虚影、dnd-kit `transition` 让位、落下后 `dropAnimation` 飞回新卡槽；
- ⚠️ 不要给卡片加落位占位、常驻 `opacity` 过渡——会把 dnd-kit 的隐藏 / 恢复拉成慢淡入淡出，落位后闪一下。

dnd-kit context 拖拽每帧换引用，所有 `useSortable` 消费者每帧被唤醒，约定别带重活：

| 约定 | 位置 |
| --- | --- |
| 卡片外观 `memo`，props 全部稳定 | `CardFace` + `SortableCard` |
| 拖拽状态不存 `GroupBoard` | `BoardDragOverlay` 自己取 `useDndContext().active` |
| 虚影内容 `memo` + 模块级常量 | `BoardDragOverlay` 的 `LIFT_STYLE` 等 |
| 卡片不挂 `opacity` 过渡、不做落位占位 | `useSortableCard` 透传 dnd-kit 的 `transition` |

## 时钟与渲染粒度

全应用只有一个秒级时钟（`core/clock/store.ts`）。消费侧声明自己多久变一次，快照相等的 tick 直接跳过渲染：

| 入口 | 用途 |
| --- | --- |
| `useClockValue(select)` | 一行文本读数（selector 返回可按值比较的结果：数字 / 字符串 / 布尔） |
| `useClockAt('second' \| 'minute' \| 'hour' \| 'day')` | 整块共用截断到该粒度的 `now`（本地字段截断，不是 UTC 整除） |

- ⚠️ selector 每秒都被调用，重活（如 `Intl.DateTimeFormat` 构造）提到模块级；
- ⚠️ 向下取整的剩余时长不能用粒度 now 算，留在叶子组件用文本快照（见 `pvp-map-widget/fields.tsx`）；
- 组件里不出现 `new Date()` / `Date.now()`（例外：番茄钟到点判定是动作不是读数；艾欧泽亚换算是纯函数）。
- 样板：`TopbarClock.tsx` —— 问候语取小时、本地时间取 `HH:mm` 文本（每分钟一跳）、艾欧泽亚读数取格式化文本（约 2.9 秒一跳），三个读数都在叶子组件上，时钟每秒一跳不牵动整条顶栏。换算在 `EorzeaTimeConvert.ts`（纯函数）。

## 如何新增一个组件类型

不需要改动任何既有组件，也不需要新增依赖（例外仅 `dayjs`、`marked`）。

1. 新建 `src/features/widgets/builtins/<name>-widget/`，三个文件：

   - **`config.ts`** — 纯数据，不导入 React：`Config` 类型、`DEFAULT_CONFIG`、`normalizeConfig(raw)`；
   - **`fields.tsx`** — 只导出组件；`Form.Item` 用 `['config', ...]` 作 name 路径，`Render` 接收 `WidgetRenderProps<Config>`；
   - **`widget.ts`** — `defineWidget<Config>({ key, label, description, defaultTitle, defaultConfig, normalizeConfig, FormFields, Render, maxCount? })`。`key` 写进用户数据，发布后不要改。

2. 在 `builtins/index.ts` 的 `installBuiltinWidgets()` 里追加一行 `registerWidget(...)`。

要点：

- `description` 显示在编辑弹窗选定类型后的配置区下方，一两句话向用户解释组件做什么；
- `maxCount` 是全局实例上限（缺省 20，「全局信息卡」这类设 1）；
- 标题不由用户填写，保存时统一取 `defaultTitle`（落盘仍保留 `title`，删除确认、番茄钟通知还在用）；
- `Render` 注册时统一套 `memo`（`registry.ts`），前提是 `WidgetRenderer` 传入的 `config` 引用稳；
- 换类型等价于新增实例，会被实例上限拦下。

完成后自动出现在「组件类型」下拉与配置区。参考例子：

| 需求 | 参考组件 |
| --- | --- |
| 访问 HTTP 接口（URL 去重 / localStorage 缓存 / 失败态） | `market-widget`、`house-widget`、`tax-widget`、`exchange-widget` |
| 接口没有 CORS 头（JSONP script 标签 + 超时） | `news-widget` |
| 纯本地计算、不联网 | `roll-widget`、`aurora-widget`、`pvp-map-widget` |
| 点击卡片写回自己的配置 | `stats-widget`（阶段进度）、`memo-widget`（双击行内编辑） |
| 每天清零的临时状态（独立 localStorage 键，不进导出） | `todo-widget` |
| 渲染 Markdown | `memo-widget`（`marked` 不 sanitize，必须用它的 renderer 收危险面：HTML 转义、链接一律外链、不产出 `<img>`） |
| 系统通知 / 状态机计时 | `pomodoro-widget`（计时状态不落盘；`Notification` 权限只在编辑弹窗里申请） |
| 日期选择 | 只存 `YYYY-MM-DD`，转换放在 `getValueProps` / `normalize` 两端（`countdown-widget`） |

## 链接图标与底色

图标不发外部请求（`navigation/CardFace.tsx`），三种形态：

- 填图片地址（http(s) / `data:image` / 协议相对）→ 显示图片，占满图标区、不铺底色；失败自动退回首字 + 底色（记下失败地址，字段一变重新尝试）；
- 填其他文字 → 该文字首字 + 底色；
- 留空 → 名称首字（大写）+ 底色。

首字用 `Intl.Segmenter` 按字素簇切（emoji 不会被切成半个）。底色由 `core/pastel.ts` 决定：FNV-1a 32 位稳定 hash + 12 色人工调的 pastel 调色板，key 取域名。⚠️ 调色板顺序即取值顺序，加色或换序会让所有已有链接整体换色。

## 主题

八套主题一套一个文件夹（`src/app/themes/<key>/`：`index.ts` 令牌 + `theme.css` 变量）：

- 新增：复制目录改 `key` / `label` / 令牌，再在 `core/theme-preference.ts` 的 `THEME_KEYS` 与 `themes/index.ts` 注册表各加一行（漏一套编译报错）；背景图放 `public/bg/`（`<n>-<key>.jpg`）；
- 删除：删文件夹 + 删两处键，不需要清理残留变量；
- antd 令牌管组件与浮层，`--dash-*` 变量管 html/body 底色、卡片底色与投影；
- ⚠️ 主题键写进 `localStorage`，发布后不要改名；
- ⚠️ 不要写跨作用域的变量链式引用；antd 的 `--ant-color-primary` 是色板第 6 档，比种子色深一档。

取色来源与全部约定见 [`themes.md`](themes.md)。

## 已知事项

- 主包约 1.39 MB（gzip 约 449 kB），含 antd 与全部内置组件；需要更小首屏可做 codeSplitting 或按需引入；
- `ConfigProvider` 用稳定的 CSS 变量 key，单份 antd 前提下关闭 hashed 类名；`ThemeConfig` 按当前主题缓存，切主题才重建；
- 不启用 antd 的 `zeroRuntime`：主题令牌与外观设置需要运行时切换，静态样式覆盖不了。

## 参考

- [Ant Design 6 文档](https://ant.design/components/overview-cn)
- [从 v5 到 v6 迁移说明](https://ant.design/docs/react/migration-v6-cn)
- [dnd-kit 文档](https://docs.dndkit.com/)
