/**
 * 资源地址解析（纯函数）。部署在子路径（`base: '/ffxiv-dash/'`）时 `base` 只对 Vite
 * 亲手处理的引用生效，TS 字符串里的路径会指向站点根、静默 404。
 * 设计支点是幂等（`assetUrl(assetUrl(x)) === assetUrl(x)`）：地址从三个方向流进来
 * （自有常量 / 用户填的链接 / 历史 localStorage），可能已带 base，出口统一过一遍即可。
 * 输入：`''`→`''`；完整链接（`http(s):`/`data:`/`blob:`/`//host`）与已带 base 路径→原样；根相对 `/bg/x.jpg`→补 base。
 * ⚠️ 没有「裸相对路径」（`bg/x.jpg`）这一档、不做容错：它不是合法输入。前置条件由两个入口保证——
 * 自有路径用 `PublicPath`（`/` 开头），用户链接过 `isImageUrl`（非法值在 `normalizeAppearance` 里清成空串）。
 * 存进配置的一律是部署无关路径，补 base 只在本模块，别处不要手写 `import.meta.env.BASE_URL`。
 */

/** 基础路径，恒以 `/` 结尾：根路径部署是 `/`，子目录部署是 `/ffxiv-dash/`。 */
const BASE = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/`

/** 基础路径去掉尾斜杠（根路径部署下为空串，此时「已带 base」判定直接跳过）。 */
const BASE_PATH = BASE.slice(0, -1)

/** 带协议头（`https:` / `data:` / `blob:` …）或协议相对（`//host/path`）的地址。 */
const ABSOLUTE_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * 我们自己的 public 资源路径：必须以 `/` 开头，用在模块级常量与主题预设上（写成
 * `'data/item-db.json'` 会当场报错）。`assetUrl` 入参仍是 `string`（要接用户地址与外链），
 * 类型上收不窄，只能靠它钉死「我们自己的那一半」。
 */
export type PublicPath = `/${string}`

/**
 * 把地址规范成当前部署下可用的形式（幂等，见文件头）。入参：自有 `PublicPath`、
 * 用户填的地址（外链或根相对），或已带 base 的历史数据。
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
