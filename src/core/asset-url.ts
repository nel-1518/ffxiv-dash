/**
 * 资源地址解析（纯函数，无 React）。
 *
 * 存在的理由：应用部署在子路径下（`vite.config.ts` 的 `base: '/ffxiv-dash/'`），
 * 而 `base` 只对 **Vite 亲手处理的引用**生效（`index.html` 的 `href`、CSS 里的 `url()`、
 * 打包产物的地址）；**写在 TS 字符串里的路径不会**，直接当链接用会指向站点根、静默 404。
 *
 * **幂等** —— `assetUrl(assetUrl(x)) === assetUrl(x)`。
 * 这一条是整个设计的支点：地址会从三个方向流进来（我们自己写的常量、用户填的「图片链接」、
 * 历史 localStorage），它们可能已经带过 base；于是出口处不必判断来源，无脑过一遍就行。
 * 下面判定"是不是已经带 base"的那段就是为幂等而存在的，不是补丁。
 *
 * 输入形态与结果：
 * - `''`             → `''`（调用方自己决定"没填"怎么处理）
 * - 完整链接         → 原样：`http(s):` / `data:` / `blob:` / `//host/path`
 * - 已带 base 的路径 → 原样：`/ffxiv-dash/bg/x.webp`
 * - 根相对路径       → 补 base：`/bg/x.webp` → `/ffxiv-dash/bg/x.webp`
 *
 * ⚠️ 没有"裸相对路径"（`bg/x.webp`）这一档，也不做容错：它不是合法输入。
 * 这条前置条件由两个入口共同保证 —— 我们自己的路径用 `PublicPath`（`/` 开头，与
 * `core/appearance/store.ts` 的 `isImageUrl` 认的根相对路径是同一套写法），
 * 用户填的「图片链接」要过 `isImageUrl`（只认 `http(s)://` / `data:image/` / `/` 开头，
 * 不合法的值在 `normalizeAppearance` 里就被清成空串）。
 *
 * 存进主题与组件配置里的一律是**部署无关**的路径，补 base 只发生在本模块，
 * 别处不要手写 `import.meta.env.BASE_URL`。
 */

/** 基础路径，恒以 `/` 结尾：根路径部署是 `/`，子目录部署是 `/ffxiv-dash/`。 */
const BASE = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/`

/** 基础路径去掉尾斜杠（根路径部署下是空串，此时"已带 base"那段判定直接跳过）。 */
const BASE_PATH = BASE.slice(0, -1)

/** 带协议头（`https:` / `data:` / `blob:` …）或协议相对（`//host/path`）的地址。 */
const ABSOLUTE_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * 我们自己的 public 资源路径：**必须以 `/` 开头**。
 *
 * 用在模块级常量与主题预设上，把 `'/data/item-db.json'` 写成 `'data/item-db.json'` 会当场报错。
 * 注意 `assetUrl` 的入参仍是 `string`：它同时要接用户填的地址与外链，
 * 那种值没法在类型上收窄，只能靠这个类型把"我们自己的那一半"钉死。
 */
export type PublicPath = `/${string}`

/**
 * 把地址规范成当前部署下可用的形式（幂等，见文件头）。
 * 入参是我们自己的 `PublicPath`、用户填的地址（外链或根相对路径），
 * 或已经带过 base 的历史数据。
 */
export function assetUrl(value: string): string {
  const path = value.trim()

  // 空串原样返回：调用方自己决定要不要用（例如背景图的"没填"状态）
  if (path === '' || ABSOLUTE_PATTERN.test(path)) {
    return path
  }

  // 已带 base → 原样返回（幂等全靠这一段）
  if (BASE_PATH !== '' && (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`))) {
    return path
  }

  // 到这里只剩根相对路径（`/` 开头）这一种形态，切掉那个斜杠再拼（契约与前置条件见文件头）
  return `${BASE}${path.slice(1)}`
}
