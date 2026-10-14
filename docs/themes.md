# 主题

八套主题的结构、约定与取色来源。代码在 `src/app/themes/`。

## 结构

```
src/app/themes/
  index.ts             注册表 Record<ThemeKey, ThemeSpec>（缺一套编译报错）
  types.ts             ThemeSpec / ThemeBackground / ThemeCards
  appearance-sync.ts   出厂档案 factoryProfile / readThemeProfile + initSystemFollow
  hooks.ts             useThemeProfile(key)：出厂档案 + 用户改动
  light-card.css       亮色卡片上的 antd 组件翻色（evercold / endwalker 共用，见文件头注释）
  <key>/index.ts       该主题的 antd 令牌 + 元信息
  <key>/theme.css      该主题的 --dash-* 变量（按需）
```

主题键 = 资料片英文名（默认两套除外），与 `public/bg/<n>-<key>.jpg` 一一对应（默认两套无背景图）。

## 新增 / 删除一套主题

1. 复制一个目录，改 `key` / `label` / 令牌 / `background` / `cards`
2. `core/theme-preference.ts` 的 `ThemeKey` 联合与 `THEME_KEYS` 各加一行
3. `themes/index.ts` 注册表加一行
4. 背景图放 `public/bg/`
5. 卡片是浅色的：`index.ts` 里 `import '../light-card.css'`，并在 `theme.css` 的 `[data-dash-theme='<key>']` 块补 `--dash-lightcard-*` 变量（语义见 `light-card.css`）
6. 定义 `--dash-selection-bg` / `--dash-selection-color`，避免文字选中色随系统明暗变化

删除反向操作即可，不需要清理残留（变量没定义就回落到 `global.css` 的 `:root` 默认值）。

## 槽位与逐主题档案

「有哪些主题」由本模块的注册表决定；「用哪几套」存在 `core/appearance/store.ts` 的 `ffxiv-dash:appearance:v3`：

- `colorMode`：浅色 / 深色 / 跟随系统
- `lightTheme` / `darkTheme`：两个槽位各一个主题键，当前色调决定用哪个槽位
- `profiles`：每套主题一份外观档案（背景 + 卡片），只存用户改过的项，读时由 `appearance-sync.ts` 的 `factoryProfile(key)` 补齐出厂值

规则：

- 生效主题的档案也在 `profiles` 里，没有第二份 live 状态——「改生效主题立刻可见、改别的主题页面不动」是数据模型的自然结果，无需预览开关；
- 主题列表不按浅 / 深过滤（只有 `default-light` 是浅色算法，过滤会让浅色槽位只剩一个选项）；槽位默认值是 `DEFAULT_LIGHT_THEME` / `DEFAULT_DARK_THEME`；
- 存储不做版本兼容：`normalizeAppearance` 只认当前形状，旧键（`appearance:v2`）与旧字段直接丢弃、走默认值。

备份粒度：外观整段进导出文件（`core/storage/backup.ts` 的 `appearance` 段），但导入只收四个数值——模糊 / 亮度 / 卡片不透明度 / 卡片模糊；背景来源（无 / 纯色 / 图片链接 / 上传）与本机图片（含上传图）一律保持现状，别人的备份不会换掉你的图。

## 变量

主题在 `[data-dash-theme='<key>']` 上声明变量，`<html>` 挂这个属性。变量清单见 `global.css` 里 `:root` 上方的注释。两条规则：

- **`--dash-card-bg` 位置敏感**：它在 `.dash-shell` 上用 `--dash-card-rgb` + `--dash-card-alpha` 算好，子元素只继承结果。想给某个元素换底色，必须在那层或更近处重写整条 `--dash-card-bg`，只改 `--dash-card-rgb` 追不上（顶栏就是这么做的）；
- **inline style 只能用变量改**：导航卡的底 / 边 / 圆角写在 `CardFace` 的 inline style 里，CSS 规则压不过。为此留了钩子：`--dash-card-bg-hover`、`--dash-card-border-width`、`--dash-card-title-color`、`--dash-link-name-color`。

## 深色主题 + 浅色卡片

深色主题配浅色卡片（银海、晓月）时，卡内 antd 组件要整体翻成深色文字，否则白字压白卡。两套样式是刻意重复的（底色与层次不同，各自留着好改）；新增浅色卡主题照抄一份、换掉色值即可，不要重新推导。要换的项：

- 文字翻深（`#333` / `#666`）
- 填充与描边换成深色叠加（深色主题里是白色叠加，亮卡上隐形）
- 控件底色 `--ant-color-bg-container` 换浅色（深色主题给的是深色，卡里的按钮 / 输入框会变成深斑）
- 主色 `--ant-color-primary` 手给浅底版（antd 不会帮你压深：浅色算法返回种子色本身，而种子是为深底挑的，压浅卡对比只有约 2.4:1）
- 链接色 `--ant-color-link` 及 hover / active 换浅底版（深色主题的链接色在亮卡上对比不足）
- 组件级 token 按名字逐个点掉：`--ant-progress-*`、`--ant-button-text-*`、error 族——它们是构建时算好写死的字面量，不回头读 `--ant-color-*`。进度环的 `--ant-progress-default-color` 不跟主色，要同步换

⚠️ `--ant-color-success` 不要动：进度环满值 / 异常态的 stroke 是 antd 内联写死的，改令牌只会让环和读数不同色。

选择器两个坑：

- 必须连 `*` 一起选——antd 6 给每个组件根元素再挂一份 CSS 变量作用域，只写在卡片根上会被卡里的组件盖回去；
- 顶栏要排除（`:not(.dash-topbar)`）——它也挂 `dash-card-surface`，但底色不同，卷进来会深字压暗底。

## 取色方法

六套有色主题的色值取自官方专题站的样式表与计算样式，不凭印象调：

1. 打开站点，取 `<link rel=stylesheet>` 的 URL，下载成文件全文搜色值（跨域读不了 `cssRules`，下载就能 grep）
2. 统计频率 + 看用途（grep 上下文）；站点专属样式表体积通常与其他几份明显不同
3. 站点专属色的标记：类名带站点前缀（`.endwalker-btn`、`.product__stormblood`）、`#<key>_home`、`.l__footer_<key>`

三个坑：

- **先甄别模板色**：`#73bfe6`（官网模板 / Lodestone 公共蓝）与 `#e30613`（SQUARE ENIX 品牌红，Cookie 横幅也在用）在每套站点都出现过，不属于任何主题；
- **参考元素的数值不能照搬**：站点卡片比我们的大一个数量级（暗影参考卡 300×437，导航卡 ≈200×44），圆角按高度比例折算，发光 / 光晕按卡片密度再收一次——我们的卡成排密铺，站点孤零零一张，同样的发光会叠成一片雾；
- **红 / 深色主题的主色天然对比不足**：站点的解法是实心块 + 白字（红莲 `#990f0f` + `#fff`），不是亮色文字压同色底。这类主题里 `colorPrimary` 只服务实心图形，可点的文字交给 `colorLink`。

## antd 6 的坑

- 每个组件根元素各挂一份 CSS 变量作用域、重新声明全部令牌——在祖先上覆盖 `--ant-color-*` 管不到它内部的组件
- 组件级 token（`--ant-<组件>-*`）是构建时写死的字面量，不回头读 `--ant-color-*`（命中过：`--ant-progress-*`、`--ant-button-text-*`、`--ant-input-*`、`--ant-color-error*`）
- `type="secondary"` 读 `--ant-color-text-description`；`Typography.Title` 读 `--ant-color-text-heading`
- 卡片边框 `:where(.css-…).ant-card-bordered` 特异性只有 `(0,1,0)`，我们的 `.ant-card.dash-card-surface` 是 `(0,2,0)`
- 内部类名与 5.x 不同：`.ant-select-content`、`.ant-modal-container`
- `Progress` 满值 / 异常态把颜色内联写在 SVG 的 `stroke` 上（不是 `var()`），CSS 追不上，只能 `!important`；常规态才走 `var(--ant-progress-default-color)`

## 卡片底色的合成

`.dash-shell` 上：

```css
--dash-card-bg: linear-gradient(135deg,
  rgb(var(--dash-card-rgb, 255 255 255) / var(--dash-card-alpha, 1)) 0%,
  rgb(var(--dash-card-rgb-2, 255 255 255) / var(--dash-card-alpha, 1)) 100%);
```

- 两端同值 = 纯色
- 三色渐变（红莲的「两侧暗、中间亮」）表达不了，得重写整条 `--dash-card-bg`
- 投影写零尺寸透明投影而不是 `none`——它会被拼进 `box-shadow` 列表，出现 `none` 整条声明失效
- 低 alpha 调色是脆的：只在「底下永远是这个色」时成立，用户一设背景图就整片透掉

## 八套速查

| 主题 | 键 | 取色来源 | 页面底 | 卡片 | 名称 / 标题 | 圆角 |
| --- | --- | --- | --- | --- | --- | --- |
| 默认-浅色 | `default-light` | — | `#f0f2f5` | 纯白 | 沿用正文 | 6 |
| 默认-深色 | `default-dark` | — | `#0A0A0A` | `#1e1e1e` | 沿用正文 | 6 |
| 苍穹 | `heavensward` | [专题站](https://na.finalfantasyxiv.com/heavensward/) | `#0f1117` | `#1f2633` | `#e5f4ff` | 0 |
| 红莲 | `stormblood` | [专题站](https://na.finalfantasyxiv.com/stormblood/) | `#6f1111` | 三色红渐变 | `#e5d473` | 6 / 8 |
| 暗影 | `shadowbringers` | [专题站](https://na.finalfantasyxiv.com/shadowbringers/) | `#0d0b12` | `#1a1926` | `#a99fff`、导航卡 `#ffffff` | 10 / 14 |
| 晓月 | `endwalker` | [专题站](https://na.finalfantasyxiv.com/endwalker/) | `#14161c` | `#F5F5FA` | `#4a5580` | 8 / 12 |
| 金曦 | `dawntrail` | [专题站](https://na.finalfantasyxiv.com/dawntrail/) | `#16140f` | `#262018` | `#e8cc70` | 0 |
| 银海 | `evercold` | [专题站](https://na.finalfantasyxiv.com/evercold/) | `#10161d` | 白玻璃 | `#586b93` | 12/4、16/6 |

数值以各主题文件为准，上表仅速查。

## 验证手法

- 切主题后读计算样式逐项比对：卡片底 / 名称色 / 圆角 / 描边宽度
- 对比度用截图 + 采像素：卡片底是半透明叠在背景图上，`getComputedStyle` 给不出合成分
- 悬停用 `page.mouse.move(cx, cy)`（`locator.hover()` 在自动化环境不触发 `:hover`），先 `window.scrollTo(0, 0)`（页面滚过之后卡片可能在视口外）
- 看板里可能没有组件卡：临时造一个 `div` 挂 `ant-card ant-card-bordered dash-card-surface ffxiv-dash`，读完移除
- 隐藏标签页有假象：CSS 过渡不推进（读到的是过渡起点的值）、rAF 不触发、dev 下动态 `import()` 可能拿到另一个模块实例
