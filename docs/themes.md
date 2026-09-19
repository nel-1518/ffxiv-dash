# 主题

八套主题的配色、实现约定与踩过的坑。代码在 `src/app/themes/`。

## 结构

```
src/app/themes/
  index.ts             注册表 Record<ThemeKey, ThemeSpec>（少一套会编译报错）
  types.ts             ThemeSpec / ThemeBackground / ThemeCards
  appearance-sync.ts   主题出厂档案 factoryProfile / readThemeProfile + initSystemFollow
  hooks.ts             useThemeProfile(key)：出厂档案 + 用户改动
  <key>/index.ts       该主题的 antd 令牌 + 元信息
  <key>/theme.css      该主题的 `--dash-*` 变量（按需）
```

主题键 = 资料片英文名（默认两套除外），与 `public/bg/<n>-<key>.webp` 一一对应。

## 新增 / 删除一套主题

1. 复制一个目录，改 `key` / `label` / 令牌 / `background` / `cards`
2. `core/theme-preference.ts` 的 `ThemeKey` 联合与 `THEME_KEYS` 各加一行
3. `themes/index.ts` 的注册表加一行
4. 需要背景图就放进 `public/bg/`
5. 卡片是浅色的，从另一套浅色主题的 `theme.css` 照抄

删除时反向操作即可 —— **不需要清理任何残留**（变量没定义就回落到 `global.css` 的 `:root` 默认值）。

## 色调、槽位与逐主题档案

主题「有哪些」写在本模块的清单里，而「用哪几套」存在 `core/appearance/store.ts` 的
`ffxiv-dash:appearance:v3`：

- `colorMode`：浅色 / 深色 / 跟随系统；
- `lightTheme` / `darkTheme`：两个槽位各存一个主题键，选哪个色调就用哪个槽位那套；
- `profiles`：**每套主题一份外观档案**（背景 + 卡片），只存用户改过的那几项，
  读的时候由 `app/themes/appearance-sync.ts` 的 `factoryProfile(key)` 用 `ThemeSpec` 补齐出厂值。

两条容易踩的规则：

- **生效主题的档案也在 `profiles` 里**，没有第二份“live”字段。因此“改生效主题立刻可见 /
  改别的主题页面不动”是数据模型的自然结果，不需要预览开关，也没有“切主题时归档旧档案”那套编排。
- 主题列表**不按浅 / 深过滤**：界面上八套一视同仁地列出来（实测只有 `default-light` 是浅色算法，
  过滤的话浅色槽位就只剩一个选项）。两个槽位的默认值就是 `DEFAULT_LIGHT_THEME` / `DEFAULT_DARK_THEME` 两个常量。
- 存储**不做版本兼容**（用户 2026-09 明确）：`normalizeAppearance` 只校验当前形状，
  旧键（`appearance:v2`）与旧字段直接丢弃、走默认值。

## 变量

主题在 `[data-dash-theme='<key>']` 上声明变量，`<html>` 挂这个属性。变量清单见 `global.css` 里 `:root` 上方那段注释。

两条容易踩的规则：

- **位置敏感的变量**：`--dash-card-bg` 是在 `.dash-shell` 上**算好**的（用 `--dash-card-rgb` + `--dash-card-alpha` 拼成渐变），子元素只是继承结果。想让某个元素换底色，必须在**那一层或更近的元素**上重写整条 `--dash-card-bg` —— 改 `--dash-card-rgb` 追不上。顶栏就是这么做的。
- **inline style 只能用变量改**：导航卡的底 / 边 / 圆角写在 `CardFace` 的 inline style 里，特异性最高，CSS 规则压不过。为此留了钩子：`--dash-card-bg-hover`、`--dash-card-border-width`、`--dash-card-title-color`、`--dash-link-name-color`。

## 深色主题 + 浅色卡片

深色主题 + 浅色卡片（银海、晓月）时，卡内 antd 组件要整体换成深色文字，否则白字压白卡。

它是**刻意重复**的：两套的卡片底色与层次关系都不同，各自留着更好改；
新增浅色卡主题时照抄一份、换掉色值即可，不要重新推导 —— 漏掉一类就会在卡里留下一块深色补丁：

- 文字翻深（`#333` / `#666`）
- 填充与描边换成"深色叠加"—— 深色主题里它们是白色叠加，亮卡上等于隐形
- **控件底色**（`--ant-color-bg-container`）换成浅色 —— 深色主题给的是深色，卡里的按钮 / 输入框会变成**一块深斑**
- **主色**（`--ant-color-primary`）换成浅底版 —— 深色主题的主色是为暗底提亮的，压在浅卡上只有约 2.4:1
- 组件级 token（`--ant-progress-*`、`--ant-button-text-*`、error 族）要**按名字**点掉 —— 它们是构建时算好后写死的字面量，不回头读 `--ant-color-*`

主色**必须手给浅底版**，antd 不会帮你压深：`getDesignToken` 在浅色算法下返回的就是种子色本身，而主题的种子本来就是为深底挑的。进度环的颜色是 `--ant-progress-default-color`，**不跟**主色，要同步点掉。

⚠️ 但 `--ant-color-success` **不要动**：进度环满值 / 异常态的 `stroke` 是 antd 用**内联样式**写死的，改令牌只会让环和读数不同色。

选择器上有两个坑：

- 必须连 `*` 一起选 —— antd 6 会给**每个组件自身的根元素**再挂一份 `css-var-*` 作用域，只写在卡片根上会被卡里的组件盖回去（0,1,0 vs 我们的 0,3,0）
- 顶栏要排除（`:not(.dash-topbar)`）—— 它也挂 `dash-card-surface`（为了共用毛玻璃），但底色不同，卷进来会变成"深字压暗底"

## 取色方法

六套有色主题的色值都来自官方专题站的**样式表与计算样式**，不是凭印象调的：

1. 打开站点，取 `<link rel=stylesheet>` 的 URL
2. 下载下来再全文搜色值 —— 跨域读不了 `cssRules`，但下载成文件就能 grep
3. 统计频率 + 看用途（grep 上下文）。站点专属的样式表体积通常与其他几份明显不同
4. 站点专属色的标记：类名带站点前缀（`.endwalker-btn`、`.product__stormblood`）、`#<key>_home`、`.l__footer_<key>`

三个坑：

- **先甄别"模板色"**：八套里每一套都出现过这两个干扰色 —— `#73bfe6`（官网模板 / Lodestone 公共站的蓝）与 `#e30613`（SQUARE ENIX 的品牌红，Cookie 横幅也在用）。它们不是任何一套主题的色。
- **参考元素的数值不能照搬**：站点的卡片往往比我们的大一个数量级（暗影的参考卡 300×437，我们的导航卡 ≈200×44）。圆角按高度比例折算，发光 / 光晕还要按**卡片密度**再收一次 —— 我们的卡是成排密铺的，站点是孤零零一张，同样的发光会叠成一片雾。
- **红色 / 深色主题的主色天然对比不足**：站点自己的解法通常是"实心块 + 白字"（红莲 `#990f0f` + `#fff`），而不是"亮色文字压同色底"。这类主题里 `colorPrimary` 只服务实心图形，可点的文字交给 `colorLink`。

## antd 6 的坑

- 每个组件根元素各挂一份 `css-var-*`，重新声明**全部**令牌 —— 在祖先上覆盖 `--ant-color-*` 管不到它内部的组件
- **组件级 token**（`--ant-<组件>-*`）是构建时算好写死的字面量，**不会**回头读 `--ant-color-*`。已命中过：`--ant-progress-*`、`--ant-button-text-*`、`--ant-input-*`、`--ant-color-error*`
- `type="secondary"` 读的是 `--ant-color-text-description`，不是 `secondary`
- `Typography.Title` 读的是 `--ant-color-text-heading`，不是 `text`
- 卡片边框是 `:where(.css-…).ant-card-bordered { border: var(--ant-line-width) … }`，`:where()` 特异性记 0，整条只有 `(0,1,0)`；我们的 `.ant-card.dash-card-surface` 是 `(0,2,0)`
- 内部类名与 5.x 不同：`.ant-select-content`、`.ant-modal-container`
- **`Progress` 满值 / 异常态把颜色内联写在 SVG 的 `stroke` 上**（不是 `var()`），CSS 追不上，要压只能 `!important`；常规态才走 `var(--ant-progress-default-color)`

## 卡片底色的合成

`.dash-shell` 上：

```css
--dash-card-bg: linear-gradient(135deg,
  rgb(var(--dash-card-rgb, 255 255 255) / var(--dash-card-alpha, 1)) 0%,
  rgb(var(--dash-card-rgb-2, 255 255 255) / var(--dash-card-alpha, 1)) 100%);
```

- 两端给同一个值 = 纯色
- 想要**三色**渐变（红莲的"两侧暗、中间亮"）表达不了，得重写整条 `--dash-card-bg`
- 投影要写成**零尺寸透明投影**而不是 `none`：它会被拼进 `box-shadow` 列表，出现 `none` 会让整条声明失效
- 靠低 alpha 调出来的颜色是脆的 —— 只在"底下永远是这个色"时成立。默认-深色当年用 `alpha: 8` + 纯白得到 `#1e1e1e`，用户一设背景图就整片透掉了

## 八套速查

苍穹：https://na.finalfantasyxiv.com/heavensward/

红莲：https://na.finalfantasyxiv.com/stormblood/

暗影：https://na.finalfantasyxiv.com/shadowbringers/

晓月：https://na.finalfantasyxiv.com/endwalker/

金曦：https://na.finalfantasyxiv.com/dawntrail/

银海：https://na.finalfantasyxiv.com/evercold/

| 主题 | 键 | 页面底 | 卡片 | 名称 / 标题 | 圆角 |
| --- | --- | --- | --- | --- | --- |
| 默认-浅色 | `default-light` | `#f0f2f5` | 纯白 | 沿用正文 | 6 |
| 默认-深色 | `default-dark` | `#0A0A0A` | `#1e1e1e` | 沿用正文 | 6 |
| 苍穹 | `heavensward` | `#0f1117` | `#1f2633` | `#e5f4ff` | 0 |
| 红莲 | `stormblood` | `#6f1111` | 三色红渐变 | `#e5d473` | 6 / 8 |
| 暗影 | `shadowbringers` | `#0d0b12` | `#1a1926` | `#a99fff`、链接卡 `#ffffff` | 10 / 14 |
| 晓月 | `endwalker` | `#14161c` | `#F5F5FA` | `#4a5580` | 8 / 12 |
| 金曦 | `dawntrail` | `#16140f` | `#262018` | `#e8cc70` | 0 |
| 银海 | `evercold` | `#10161d` | 白玻璃 | `#586b93` | 12/4、16/6 |

数值以各主题文件为准，上表只是速查。

## 验证手法

- 切主题后读计算样式，逐项比对：卡片底 / 名称色 / 圆角 / 描边宽度
- 对比度：**截图 + 采像素** —— 卡片底是半透明叠在背景图上，`getComputedStyle` 给不出合成分
- 悬停效果：`locator.hover()` 在自动化环境里**不触发** `:hover`，要用 `page.mouse.move(cx, cy)`，且先 `window.scrollTo(0, 0)`（页面滚过之后卡片在视口外）
- 组件卡相关规则：看板里可能没有组件卡，临时造一个 `div` 挂 `ant-card ant-card-bordered dash-card-surface` + 从现有组件抄来的 `css-dev-only-do-not-override-*` 与 `css-var-*` 两个类，读完再移除
- 隐藏标签页的假象：CSS 过渡不推进（读到的阴影 / 描边是过渡**起点**的值）、rAF 不触发、动态 `import()` 在 dev 下可能拿到另一个模块实例
