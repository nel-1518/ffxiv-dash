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

可选：复制 `.env.example` 为 `.env` 配置运行时开关（目前只有第三方图标接口一项）。

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
    AppProviders.tsx        ConfigProvider(中文/主题) → App → BoardPersistence + AutoOpenLinks（无看板 Provider）
    AutoOpenLinks.tsx       「跳转」：每天首次进入页面时自动打开设置里的链接（渲染 null 的启动副作用）
    theme-config.ts         基线主题 + 把主题规格合成 antd ThemeConfig
    AppShell.tsx            布局外壳；将来接路由的挂载点（只负责把视图放进 Layout）
    background-layer.ts     外观快照 + 主题预设 → 背景层样式（纯函数，无 React）
    themes/                 八套主题，一套一个文件夹
      types.ts              ThemeSpec（antd 令牌 / 默认背景 / 默认卡片外观）
      index.ts              注册表（Record<ThemeKey, ThemeSpec>，缺一套会编译报错）
      appearance-sync.ts    applyTheme：一次写入主题 + 该主题配套的背景与卡片参数
      <key>/index.ts        该主题的 antd 令牌与元信息
      <key>/theme.css       该主题的 --dash-* 变量（按需）
  core/                   与 React 无关的通用能力
    ids.ts                  全项目唯一 id 生成入口（含非安全上下文降级）
    guards.ts               通用类型守卫（isRecord）
    asset-url.ts            资源地址解析：public 下的路径 → 带部署基础路径的链接
    theme-preference.ts     主题键的类型与清单（八套主题的名字 / 默认主题）
    appearance/
      store.ts              外观偏好：主题 + 背景 + 卡片，三样共用一个 localStorage 键
      image-store.ts        上传的背景图片存 IndexedDB（不进导出）
      hooks.ts              useAppearance() / useTheme()
    clock/
      store.ts              全局秒级时钟（引用计数订阅，无 Provider）
      hooks.ts              useClock() / useNow() / useClockValue() / useClockAt()
      format.ts             时钟相关的纯格式化（formatRelativeTime / formatDateKey）
    auto-open/
      store.ts              「跳转」：链接文本 + 每日一次的门禁（纯逻辑，一个 localStorage 键）
      hooks.ts              useAutoOpenLinks()
    world.ts                中国区服务器表（大区 / 世界）
    favicon.ts              网站图标第三方接口封装
    favicon-cache.ts        图标失败负缓存（避免离线时反复重试）
    storage/
      types.ts              BoardDoc / Group / Item 数据模型
      schema.ts             校验、归一化、版本号把关（对不上直接回退默认数据）
      persistent.ts         localStorage 读写（含回退与归一化回写）
      default-board.ts      初始演示数据
  state/                    仪表盘状态
    board-types.ts          action 与 actions 类型
    board-reducer.ts        纯 reducer，全部不可变更新
    board-store.ts          模块级 store：订阅 + 快照读取 + boardActions（唯一数据源）
    board-storage.ts        读写落盘
    board-persistence.tsx   订阅 store，300ms 防抖写盘（不向子树传任何数据）
    hooks.ts                useBoardGroupRows / useBoardGroup / useBoardDoc
  features/
    dashboard/              顶栏、编辑弹窗、表单
      TopbarClock.tsx         顶栏问候语与两个时间读数（秒级时钟只落在这几个叶子上）
    search/                 搜索弹窗、链接检索、搜索引擎注册表
    settings/               系统设置弹窗（外观 / 跳转 / 数据管理）
      SettingsDialog.tsx      左侧分组 + 面板容器（分区是数据驱动的）
      AppearanceSettingsPanel.tsx 外观外壳：主题 → 背景 → 卡片
      appearance/             外观面板的三个自洽子模块
        ThemePicker.tsx         八选一 + 换主题时同步背景与卡片参数
        BackgroundSection.tsx   背景来源四选一 + 三种编辑器 + 图片显示
        Tunings.tsx             滑块行 + 背景显示 / 卡片底色两组调节
      AutoOpenSettingsPanel.tsx 「跳转」：每行一个链接的文本域 + 行数/状态提示
      DataSettingsPanel.tsx   导入导出
    groups/                 分组面板、拖拽编排、分组表单
      BoardDragOverlay.tsx    拖拽虚影宿主：正在拖的是谁从 dnd-kit 的 context 读，不放进 GroupBoard 的状态
    navigation/             导航卡片、卡片栅格、可拖拽卡片
    widgets/                组件框架（注册表 + 渲染器）
      types.ts              WidgetSpec / WidgetRenderProps / defineWidget
      registry.ts           注册表（不导入任何具体组件，避免循环依赖）
      useFavicon.ts         图标接口 hook
      WidgetRenderer.tsx    统一卡片外壳 + 未注册组件降级
      builtins/             内置组件，每个一个目录（stats / pvp-map / market / house / countdown / tax）
  views/
    DashboardPage.tsx       页面组装
  styles/global.css         仅页面背景、字体栈、少量基线
```

### 部署基础路径与资源地址

应用部署在子路径下（`vite.config.ts` 的 `base: '/ffxiv-dash/'`）。这个 `base` 只对 **Vite 亲手处理的引用**生效：
`index.html` 里的 `href`、CSS 里的 `url()`、打包产物的地址都会在构建时自动带上它；
**写在 TS 字符串里的路径不会** —— 主题自带的背景图（`/bg/8-evercold.webp`）与物品库（`/data/item-db.json`）
都属于后者，直接当链接用会指向站点根、静默 404。

所以运行时凡是要拼 `public/` 下的资源地址，一律走 `src/core/asset-url.ts` 的 `assetUrl()`：

```ts
assetUrl('/data/item-db.json')    // → /ffxiv-dash/data/item-db.json
assetUrl('/bg/8-evercold.webp')   // → /ffxiv-dash/bg/8-evercold.webp
assetUrl('https://x/y.png')       // → 原样返回（http(s): / data: / blob: / //host 都不动）
assetUrl('/ffxiv-dash/bg/x.webp') // → 原样返回
```

它是个**幂等**函数（`assetUrl(assetUrl(x)) === assetUrl(x)`）：地址可能来自我们自己的常量、
用户填的「图片链接」，或历史 localStorage，其中有些已经带过 base ——
出口处不必判断来源，过一遍就行（幂等就是这个设计的依据，不是打补丁）。

约定：

- 输入只有两种合法形态：**完整链接**（`http(s):` / `data:` / `blob:` / `//host`）或 **`/` 开头的根相对路径**。
  函数不做容错：`bg/x.webp` 这种裸相对路径不是合法输入（我们自己的常量由 `PublicPath` 挡住，
  用户填的地址由 `isImageUrl` 挡住）；
- 我们**自己写**的资源路径统一用 `PublicPath`（`` `/${string}` ``）标注，
  模块级常量与主题预设都这么写 —— 把 `'/data/item-db.json'` 写成 `'data/item-db.json'` 当场编译报错；
- 存进主题与组件配置的地址必须是**部署无关**的写法（`/bg/x.webp`），补 base 只发生在 `assetUrl()` 一处；
- 别处不要手写 `import.meta.env.BASE_URL`。

### 数据流

看板状态住在 `state/board-store.ts` 这个**模块级 store** 里，全站没有看板 Provider：

```
展示层 (features/*)
  └─ boardActions.xxx() 派发 action（模块级常量，事件里直接用，不订阅）
       └─ boardReducer（纯函数）产出新 BoardDoc
            ├─ store 通知订阅者；各组件按 useSyncExternalStore 的粒度快照决定是否重渲染
            │    · useBoardGroupRows()  → 只在分组增删/重排时重渲染（BoardSurface）
            │    · useBoardGroup(id)    → 只在该分组变化时重渲染（分组槽位）
            │    · useBoardDoc()        → 真要整份文档时才用（导出、计数）
            └─ BoardPersistence 以 300ms 防抖写入 localStorage
```

**为什么要 store 而不是 context**：context 的订阅粒度是整个 value，`doc` 一换引用，所有消费者都要重渲染，
"点一下进度卡的 +1"会牵动整页（顶栏、搜索框、其他分组）。store + 粒度化快照之后，
一次卡片改动只会重渲染**那张卡片**（连它所在分组的表头都不会重渲染）。

⚠️ 改这块之前先看 `state/board-store.ts` 与 `state/hooks.ts` 顶部的注释，以及
`navigation/useStableIdList.ts`：几处「内容不变就复用旧引用」的缓存是细粒度订阅成立的前提，
写错的表现是**功能正常但性能回退、零报错**。

**没有统一的请求层**：早先「数据来源 = HTTP 接口」那套能力已整体删除（`core/api` 已不存在），
需要联网的组件各自封装 URL / 缓存 / 失败态，做法见下面「组件要访问接口怎么做」。

### 数据模型

```ts
type BoardDoc = { version: number; groups: Group[] }

/**
 * 分组只有两种，区别在"能放什么"和"怎么排布"：
 * - widget ：只能放小组件，每个分组独占一行（perRow 1）
 * - link   ：只放网页导航，同类分组并排，每行最多 4 个（perRow 4）
 */
type Group = {
  id: string; title: string; type: 'widget' | 'link'
  columns: number   // 分组内卡片的列数，1-6；缺省按类型取默认值（小组件 4 / 网页导航 3）
  items: Item[]
}

type LinkItem = { id; kind: 'link'; name; url; desc?; icon? }

type WidgetItem = {
  id; kind: 'widget'
  widget: string                  // 注册表里的 WidgetSpec.key
  title: string
  config: Record<string, unknown> // 由各组件的 normalizeConfig 解释
}
```

分组"放在哪一行"的规则集中在 `src/features/groups/group-types.ts` 的 `GROUP_TYPE_META`：
每种类型声明 `allowedKinds`（能放哪种卡片）、`columnsVisible` / `defaultColumns` 与 `perRow`（同类一行放几个）。
`GroupBoard` 依据 `perRow` 把连续的同类型分组切行——`widget` 的 `perRow` 是 1，所以每个小组件分组独占一行；
`link` 是 4，不足 4 个时按 24 栅格均分。

分组"内部怎么排"由 `Group.columns` 决定（1-6 列）。排布用 CSS Grid
（`src/features/navigation/ItemGrid.tsx` + `.dash-item-grid`）而不是 antd 的 24 栅格，因为 24 除不尽 5；
列数通过自定义属性 `--dash-grid-columns` 下发，窄屏由媒体查询自动降列（中屏最多 3 列、小屏最多 2 列、手机 1 列）。

### 分组的配置入口

分组的全部配置都收在**编辑分组弹窗**里（表头点 ✎ 打开），打开即按当前值填入：

| 场景 | 弹窗内容 |
| --- | --- |
| 新建分组 | 分组名称 + 分组类型 + 每行列数 |
| 编辑分组 | 分组名称 + 每行列数，左下角多一个「删除分组」 |

- **新建的分组排在最顶层**：`addGroup` 直接前插（`[group, ...doc.groups]`），建完就在看板第一个位置，
  不必再一路点「上移项目」。想再挪位置用表头的四个位置按钮。
- **分组表头的操作分成两组**（只在编辑模式出现，中间一条竖线隔开）：
  - 位置组：置顶 / 上移 / 下移 / 置底 —— 只改"这一块放在页面哪个位置"，首尾两个一步到位，中间两个挪一格；
  - 内容组：添加项目（＋）/ 编辑分组（✎）。
  列数控件与删除按钮都不在表头（配置收在编辑弹窗里）。
- **表头放不下时整组按钮换到第二行**：六颗图标按钮约 161px 宽，硬挤的话被牺牲的会是项目名。
  为此 `GroupPanel` 的标题从 antd 默认的 `flex: 1`（基准 0，换行判定只看按钮组）改成 `flex: 1 1 auto`，
  先把「类型 · 项数」交给省略号（`.dash-group-meta`），还不够才换行（`.dash-group-actions` 一带的规则）。
  ⚠️ 也试过用 `container-type: inline-size` + 容器查询把元信息收掉，实测会**把整个看板算塌**：
  `.dash-container` 是 `margin-inline: auto` 的伸缩项、宽度按 fit-content 算，尺寸 containment 一截断内在尺寸，面板就只剩 48px。
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
| 外观 | 主题（八选一，全部做完）；背景（无·跟随主题 / 纯色 / 图片链接 / 上传图片，图片固定铺满裁切、可调模糊·亮度）；卡片（不透明度、毛玻璃模糊） |
| 跳转 | 每行一个链接，每天首次进入页面时自动打开（同一分区里即时保存） |
| 数据管理 | 把看板导出为 JSON；或从 JSON 导入覆盖当前看板 |

以上参数都**立即生效**；主题、外观偏好与跳转设置都不属于看板数据（各自独立 key），因此不进导出。

**「跳转」的两个要点**（纯逻辑在 `core/auto-open/`，启动副作用在 `app/AutoOpenLinks.tsx`）：

- **一天只跳一次**，以本地 0 点为界：`takeTodayLinks()` 查一次就顺手把「今天已跳」写进存储，
  查询与记账在同一次同步调用里完成 —— 否则 dev 的 StrictMode 会把标签页开两遍。
  只在页面启动时判一次、不挂任何定时器，这就是"不需要实时"的落地方式。
- **浏览器会拦下没有用户手势的 `window.open`**（Chrome / Firefox / Safari 默认都拦），
  所以被拦下时给一条常驻通知 + 「全部打开」按钮（点它是一次真实手势，浏览器就放行）——
  否则用户只会看到"设置没生效"。也正因为要判断有没有被拦，`window.open` **不能**带 `noopener`
  （带了按规范永远返回 null），改成开完再把 `opener` 清掉，效果与全站链接的 `rel="noopener noreferrer"` 一致。

**换主题会连外观一起换**（`app/themes/appearance-sync.ts`）——**主题会盖掉你自己调过的值**：

| 项 | 规则 |
| --- | --- |
| 背景 | 主题自带图（银海是 `/bg/8-evercold.webp`）就自动写进「图片链接」并把模糊/亮度改成预设值；主题不带图（只有默认两套）就退回「无」 |
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
必须一并拿到卡片那套浅色令牌，否则会变成**白底白字**
（**晓月与银海是例外**：晓月刻意让顶栏留在暗色、只让卡片变亮；银海的顶栏是
**半透明白玻璃**（`rgba(255,255,255,.25)` + `blur(10px)`），文字改用白系。
两套的做法都是把顶栏用 `:not(.dash-topbar)` 排除——
⚠️ 只把 `--dash-card-bg` 换成半透明白是**不够的**：那层白透出来的是压暗后的背景图，`#333` 压上去只剩 **1.9:1**，整条栏读不了。）
起因是实测数据：Dawntrail 背景图在顶栏那一带平均亮度 0.434、最亮处 0.70（照片的天空），
浅色问候语压在上面只有约 1.2:1 —— 换字体颜色救不回来（照片的暗部又会反过来吃掉深色字）。
有底后那一带实测亮度降到 0.058，问候语 8.3:1、时间读数 6:1（银海那种白玻璃上则是 9.8:1）。

原来的「通用设置」里只有主题一项，主题搬到「外观」后该分区空了，整个分区已删除。

**导入导出复用落盘格式**：`core/storage/persistent.ts` 的 `serializeBoardDoc` / `parseBoardDoc`
产出与读取的都是 `{ version, groups }` 这个信封，校验也走与启动时同一套 `sanitizeBoardDoc`。
因此导出的文件既能被别人导入，也能直接当作 `localStorage` 的值用；反过来，
把本地原始值导出来也照样能读。导入经 state 层的 `replaceDoc` action 整体替换，
替换前弹二次确认（列出行数，且是不可撤销的危险操作）。
扩展方式：往 `SettingsDialog.tsx` 的 `SECTIONS` 追一项（标签 / 图标 / 面板各一个字段）即可，
导航与面板由同一份数据驱动，不必再去补分支。

### 拖拽规则

拖拽手柄只绑在 `DragHandle` 上（不是整张卡片），所以卡片内的链接与按钮照常可点。

⚠️ **分组不参与拖拽**：`drag-types.ts` 的 `DragData` 只有卡片一种形状，全站唯一的 `useSortable` 调用点在
`navigation/useSortableCard.ts`，`SortableGroup` 只是个容器。分组调序只有表头那四个按钮
（置顶 / 上移 / 下移 / 置底），落到的都是 `reorderGroups` 这一个 action。

| 拖动对象 | 可落点 | 结果 |
| --- | --- | --- |
| 网页导航卡片 | 同 kind 的卡片 | 同分组内排序；拖到另一分组的同类卡片上则移入那个分组 |
| 组件卡片 | 同 kind 的卡片 | 同上 |

"只能同类型互相吸附"由 `GroupBoard` 里的 `sameKindCollision` 碰撞检测实现：
它在比较前按 `parseDragData` 的 `type` / `kind` 过滤候选容器，因此网页卡片不会被小组件挤位、
小组件分组也不会被网页分组落下（这样做也避免了"行内分组数超上限"的状态）。

**动画**分三层，各管一段，互不覆盖：

| 阶段 | 由谁负责 | 表现 |
| --- | --- | --- |
| 拖拽中 | `DragOverlay` | 跟随指针的实体卡片由 overlay 渲染，原位置只留一个半透明占位（`DRAG_PLACEHOLDER_OPACITY`，只作用在"正在被拖的那张卡"上） |
| 拖拽中 | dnd-kit 的 `transition` + `rectSortingStrategy` | 卡片在自己的分组里换位时，同组其它卡片平滑让位。`ItemGrid` 给每组卡片套了一层 `SortableContext`，dnd-kit 才拿得到 `activeIndex` / `overIndex`（缺了它卡片既不会跟随指针，也不会有让位过渡） |
| 落下后 | dnd-kit 的 `dropAnimation`（含 `defaultDropAnimationSideEffects`） | overlay 飞回新的卡槽；顺序真正变化时其余卡片平滑滑到新位置。落位期间 dnd-kit 会把原卡片**直接隐藏**（写/撤销 inline `opacity: 0`，跨分组时打到重新挂载后的新节点上），落定那一刻再一次性恢复 |

⚠️ **不要给卡片加"落位占位 + 淡入"，也不要给卡片挂常驻的 `opacity` 过渡**（两者都是踩过的坑）：

- 卡片上挂着 `opacity 240ms` 时，dnd-kit 那句"先隐藏、后恢复"会被拉成两段慢淡入淡出 ——
  虚影已经落定，底下的卡片还是几乎透明的，随后猛地亮回来，看上去就是**拖拽完成后闪一下**；
- "落位占位"本身也没用：落位动画期间原卡片已被 dnd-kit 隐藏，占位只在动画结束后才可见（只贡献了那次闪烁）；
- 代价还不止视觉：落位状态要穿过 `GroupBoard` → 槽位 → 网格 → 卡片，`setState` 与 240ms 后的
  "收回占位"各引发一轮整块重渲染（实测掉落瞬间 272ms、+500ms 处 223ms 的长任务），
  顺带把落位动画的起点推迟了 240ms。

### 拖拽性能：四处「必须保持」的眼

dnd-kit 的 context 在**拖拽开始**与**指针每移动一帧**时都会换引用，而 context 的传播不受 `memo` 拦截：
所有 `useSortable` 消费者（每张卡片）每帧都会被叫醒。**这个唤醒躲不掉，要做的是别让它带着重活一起跑。**

| 眼 | 位置 | 为什么 |
| --- | --- | --- |
| 卡片外观必须是 `memo`，且 props 全部稳定 | `CardFace`（`memo`）+ `SortableCard` 用 `useMemo` 固定 `handle`、`useCallback` 固定 `onEdit` / `onRemove` | 这棵子树里有 antd Card/Flex/Typography/Button 与**每张卡三个 Tooltip 的 rc-trigger 机器**（实测单次 commit 出现 72 个 Tooltip、96 个 Trigger、62 个 ResizeObserver）。props 不稳时 `memo` 被打穿，拖起来就卡 |
| 拖拽状态不能存在 `GroupBoard` | `BoardDragOverlay` 自己 `useDndContext().active`（`GroupBoard` 现在**一个 state 都没有**） | 在看板这一层 `setState` 会重建整棵看板元素树（所有 Row/Col/槽位 + `DndContext` 的 children），连锁到每一张卡片。拖拽开始时是卡顿，落位时还会推迟落位动画的起点 |
| 虚影内容保持 `memo` + 模块级常量 | `BoardDragOverlay` 的 `LIFT_STYLE` / `INERT_HANDLE` / `NOOP` | DragOverlay 跟着指针每帧重渲染自己的孩子，不固定住就是"一帧一动" |
| 卡片上不挂 `opacity` 过渡、也不做"落位占位" | `useSortableCard` 的 `transition` 直接透传 dnd-kit 给的值 | 详见上面「动画」一节：常驻透明度过渡会把 dnd-kit 的隐藏/恢复拉成慢淡入淡出 → 落位后闪一下 |

实测（24 张卡、dev 构建、PointerSensor）：

| 指标 | 修复前 | 修复后 |
| --- | --- | --- |
| 拖拽起始主线程阻塞 | 783ms | ~70ms |
| 拖拽中帧间隔 | — | 113 帧全部 17ms，零掉帧 |
| 掉落瞬间长任务 | 272ms + 223ms（+500ms 处） | 58–70ms |
| 落位后原卡片透明度 | 0.45 → 0（慢） → 0 → 1（慢） | 0（飞行中隐藏） → 1（落定瞬间） |

⚠️ 想复现/验证这组数字：用 CDP 的 `Profiler.start` + `performance` 的长任务观察 + rAF 帧间隔，
注意 React fiber 的 `PerformedWork` 标志**对未重渲染的组件也会残留**，别拿它当"本次 commit 渲染了谁"的依据。

落盘结构是 `BoardDoc`（`{ version, groups }`），键名 `ffxiv-dash:board:v1`。
`loadDoc()` 会依次做 JSON 解析 → 结构校验，任何一步失败都回退到默认数据并在控制台告警；
校验过程中若补齐或丢弃了字段，会自动回写一次。
⚠️ 版本号（`SCHEMA_VERSION`，当前 3）对不上时**直接判为无法识别**：没有逐版迁移，
未上线期间发生破坏性改动就重置旧数据。
分组类型与卡片种类都是 `link` / `widget` 两种，非法值在归一化时回落到 `widget` / `link`。

## 时钟与渲染粒度

全应用只有**一个**秒级时钟（`core/clock/store.ts`：引用计数订阅、无 Provider、对齐整秒）。
消费侧不要直接要「此刻」，而是声明**自己多久变一次** —— 粒度选错的表现是「看起来没坏，但整块在每秒重渲染」。

| 入口 | 快照 | 用在哪 |
| --- | --- | --- |
| `useClockValue(select)` | `select(now)` 的返回值（按 `Object.is` 比） | **一行文本**的读数：顶栏问候语（取小时数）、`HH:mm`（每分钟）、艾欧泽亚 `H:m`（约 2.9 秒）、PvP 卡剩余时长 |
| `useClockAt('second' \| 'minute' \| 'hour' \| 'day')` | 截断到该粒度起点的 `Date` | **整块共用 `now`** 的地方：市场卡 / 房屋卡 / PvP 卡（`minute`）、倒数日（`day`） |
| `useClock()` / `useNow()` | 毫秒时间戳 / 此刻的 `Date` | 秒级兜底（目前没有调用点） |

- **快照相等的那些 tick，React 会直接跳过这次渲染**，所以「每秒一跳」不再等于「每秒一渲染」。
  市场卡、房屋卡、倒数日原来各自 `useNow()`，整块（含请求状态 / 读数区）每天要重渲染 86400 次；
  换成粒度时钟后分别是 1440 次与 1 次。
- ⚠️ `useClockValue` 的 selector 必须返回**可按值比较**的结果（数字 / 字符串 / 布尔）：
  返回每次新建的对象会让快照永远「变了」，直接无限重渲染。要 Date 就用 `useClockAt`
  （它把 `new Date` 放在 `useMemo` 里，按那个毫秒数缓存）。
- ⚠️ selector **每秒都会被调用**（时钟通知时做一次快照比对），别在里面做重活：
  例如 `Intl.DateTimeFormat` 贵在**构造**而不是格式化，实例应当提到模块级复用。
- ⚠️ `useClockAt` 走**本地字段**截断（`setSeconds` / `setMinutes` / `setHours`），
  不能写成 `Math.floor(ms / 3600000)` 之类的整除：那是 UTC 整点，东八区看不出来，
  `+5:30` / `+9:30` 这类时区会错开半小时。
- ⚠️ **向下取整的「剩余时长」不能用粒度 now 算**：`formatHoursMinutes` / `formatMinutes` 取的是
  `floor(剩余)`，而同一分钟里真实剩余会跨过一个整分（8:59 → 8:00），拿本分钟起点去算就成了
  **向上取整**（还剩 8 分多会显示成 9 分）—— 正是 `pvp-map-widget/rotation.ts` 里明说不要的报法。
  这类读数要留在**叶子组件**里用文本快照，参考 `pvp-map-widget/fields.tsx` 的 `RemainingTime`。
- 顶栏是这套约定的样板：`features/dashboard/TopbarClock.tsx` 自己**不订阅**时钟，
  三个读数各是一个叶子；`Topbar` 因此不会因为秒针而重渲染（那里挂着一堆 antd 控件）。
- 时间类纯函数（轮换、抽签时期、倒数天数）照旧只接收 `Date`，组件用 `useClockAt('minute')`
  之类拿到 `now` 再传进去 —— 组件里不要出现 `new Date()` / `Date.now()`。

## 如何新增一个组件类型

组件框架的目标是：**新增组件不需要改动任何既有组件，也不需要新增依赖**
（唯一的例外是日期控件要用的 `dayjs`，见本节末尾）。

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

> **需要日期选择器时**：antd 的 `DatePicker` 只吃 `dayjs` 对象，而 `dayjs` 是 antd 的内部依赖，
> 在 pnpm 的严格 `node_modules` 下源码里取不到，因此它被提升成了本项目的直接依赖（见 `package.json`）——
> 这是"新增组件不需要新增依赖"的唯一例外，不要再引入第二个日期库。
> 配置里仍然只存 `YYYY-MM-DD` 字符串，转换放在 `Form.Item` 的 `getValueProps` / `normalize` 两端，
> 参考 `builtins/countdown-widget/fields.tsx`；日期解析、周期推进、闰年夹取这类纯计算
> 单独放一个不导入 React 的模块（`builtins/countdown-widget/countdown.ts`），便于脱离浏览器验证。

### 组件要访问接口怎么做

**没有统一的请求层**（早先"数据来源 = HTTP 接口"那套能力已整体删除，`core/api` 已不存在）。
需要联网的组件自己封装，可参考 `builtins/market-widget/` 的分工：

- `universalis.ts` 只管 URL / 请求 / 解析（模块级**按 URL 在飞去重**，避免重复请求）；
- `cache.ts` 管 localStorage 缓存（带 TTL、写入时顺手清过期）；
- 组件在 `Render` 里自己渲染加载与失败态（市场卡把状态挤在标题行右侧，不占版面）。

`builtins/house-widget/`（售楼中心）是同一套分工的第二个例子，另有两处可参考：

- `sale.ts` 把响应**折叠成计数**（卡片只要数字，就不把几百条明细写进缓存）；
- `phase.ts` 把「当前处于什么时期」交给**时钟 + 固定周期**算（同类已知起点取模见 `pvp-map-widget/rotation.ts`）。

`builtins/tax-widget/`（市场税率）是第三个例子：接口只回一层「城市 → 百分比」对象，
`rates.ts` 的 `parseTaxRates` / `isDiscounted` 都是纯函数，卡面「哪个城市在减税」就是它们算出来的。

与时间无关的相对时间文案（`N 分前`）在 `core/clock/format.ts`，两个卡片共用；
卡片该按什么粒度订阅时钟（别让整块跟着秒针渲染）见下面「时钟与渲染粒度」一节。

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

每套的取色来源、色板与数值取舍，以及主题系统的全部约定（变量、antd 的坑、
新增/删除主题的步骤、八套速查表），都在 **[`docs/themes.md`](docs/themes.md)**。速览：

- **默认-浅色（默认主题）**：就是基线本身（`ThemeSpec.antd` 为空），不维护任何色值。
- **默认-深色**：antd 深色算法的原生观感；卡片是**不透明**的纯色深灰。
- **银海**：深色页面 + **浅色玻璃卡**；顶栏是半透明白玻璃 + 白字。
- **金曦**：暖黑底 + 亮金（参考官方专题站 dawntrail）。
- **晓月**：暗页面 + 暗顶栏 + **亮卡片**（纯色 `#F5F5FA`）。
- **暗影**：近黑底 + 紫罗兰；卡片照首页 `.new_content__list` 做（悬浮铺一层紫渐变）。
- **红莲**：深红打底 + 金（老版官网）；卡片是「两侧暗、中间亮」的三色水平渐变。
- **苍穹**：近黑底 + 冰蓝（老版官网）；背景带一层四周暗角。

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

- 新增主题：复制文件夹改 `key`/`label`/令牌，再在 `core/theme-preference.ts` 的
  `THEME_KEYS` 与注册表里各加一行 —— 注册表是 `Record<ThemeKey, ThemeSpec>`，漏一套会编译报错。
- 删主题：删文件夹 + 删两处键，**不需要清理任何残留**（变量没定义就回落到 `:root` 默认值）。
- 卡片是浅色的主题（银海、晓月）：卡内要整体翻成深色文字；
  顶栏与卡片不同色的主题还得用 `:not(.dash-topbar)` 把两者拆开。见 `docs/themes.md`。
- ⚠️ 主题键会写进 `localStorage`（`ffxiv-dash:appearance:v2` 的 `theme` 字段），
  发布后不要再改名；改过名也没关系：校验通不过的旧值会自动回落到默认主题。

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

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_FAVICON_ENABLED` | `true` | 是否请求第三方图标接口 |

早先的 `VITE_API_BASE_URL` / `VITE_API_TIMEOUT_MS` / `VITE_API_RETRIES` 已随请求层一起删除
（源码里不再有 `import.meta.env.VITE_API_*`），`.env.example` 里还留着，见「已知事项」。

## 已知事项

- **构建产物体积**：antd + dnd-kit 后主包约 1.17 MB（gzip 约 378 kB）。
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

## 参考

- [Ant Design 6 文档](https://ant.design/components/overview-cn)
- [从 v5 到 v6 迁移说明](https://ant.design/docs/react/migration-v6-cn)（本项目已按 v6 写法实现，
  未使用 `bodyStyle` / `bordered` / `maskClosable` / `Space.direction` 等已废弃 API）
- [dnd-kit 文档](https://docs.dndkit.com/)
