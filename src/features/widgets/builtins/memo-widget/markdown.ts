/**
 * 备忘卡的 markdown 渲染（纯逻辑，不导入 React，可以直接用 node 跑）。
 *
 * 用 marked（https://github.com/markedjs/marked）做 GFM 渲染，但**不是开箱即用**：
 * 它从 v5 起就明确不再做 sanitize（README 里也写了"请自行接 DOMPurify"），
 * 而我们的内容会经 `dangerouslySetInnerHTML` 进 DOM，还可能是导入来的看板 JSON 里带的 ——
 * 所以这里用三处 renderer 覆盖把危险面收掉，而不是再引一个 sanitize 依赖：
 *
 * - `html()`：原始 HTML **转义输出**（按字面显示），`<script>` / `onerror=` 一律变成文本；
 * - `link()`：只放行 http(s) / mailto，其余（含没写协议头的 `x.com`）**一律当外链补 `https://`**，
 *   `javascript:` 这类未知协议只留可见文本；
 * - `image()`：**完全不渲染图片**（用户要求），退化成纯文本。
 *
 * 剩下的语法（标题 / 列表 / 表格 / 代码块 / 引用 / 强调 / 删除线 / 任务列表）都走 marked 默认实现，
 * 它们产出的标签都是固定白名单里的，没有属性注入面。
 */
import { Marked } from 'marked'

const ESCAPE_PATTERN = /[&<>"']/g
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** 文本 / 属性值转义（marked 内部的同名工具没有从包根导出）。 */
export function escapeHtml(text: string): string {
  return text.replace(ESCAPE_PATTERN, (char) => ESCAPE_MAP[char] ?? char)
}

/**
 * 去掉所有 ASCII 控制字符与空格。
 *
 * 判定协议之前必须先做这一步：`java\nscript:alert(1)` 这种写法（浏览器会忽略换行与制表符）
 * 单靠字符串前缀比对是拦不住的。用循环而不是正则，避免为一行小逻辑引入控制字符正则。
 */
function stripInvisible(text: string): string {
  let result = ''
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) > 0x20) {
      result += char
    }
  }
  return result
}

/**
 * 把用户手写的链接**一律当作外链**，并返回可以安全放进 `href` 的绝对地址。
 *
 * 规则（与本仓「跳转」设置里 `core/auto-open/store.ts` 解析用户输入的老规矩一致）：
 *
 * | 写法 | 结果 |
 * | --- | --- |
 * | `https://x.com` / `http://x.com` / `mailto:a@b.c` | 原样（编码后） |
 * | `//x.com/a` | 补成 `https://x.com/a` |
 * | `x.com` / `x.com/a?b=1` / `www.a.com` | **补成 `https://…`** |
 * | `#锚点` / `/根相对路径` | 不算链接（只留可见文本） |
 * | `javascript:` / `data:` / `file:` 等 | 不算链接（只留可见文本） |
 *
 * 为什么"没写协议头就补 https"而不是按相对路径解析：本看板没有站内路由，
 * 相对地址解析出来只可能是本站的 404（`[123](x.com)` 会打开 `/ffxiv-dash/x.com`）——
 * 而用户写 `x.com` 时想的从来都是那个网站。根相对与锚点同理没有去处，故直接不当链接。
 *
 * ⚠️ 判定协议之前必须先剥掉控制字符：`java\nscript:alert(1)` 这种写法（浏览器会忽略换行与制表符）
 * 单靠前缀比对是拦不住的。返回 null 表示"不是链接"，由调用方只留文本。
 */
function absoluteHref(href: string): string | null {
  const stripped = stripInvisible(href)
  if (stripped === '') {
    return null
  }

  let absolute: string
  if (/^https?:/i.test(stripped) || /^mailto:/i.test(stripped)) {
    absolute = stripped
  } else if (stripped.startsWith('//')) {
    absolute = `https:${stripped}`
  } else if (stripped.startsWith('#') || stripped.startsWith('/')) {
    // 锚点与根相对路径：没有去处，也不该静默变成"本站相对跳转"
    return null
  } else {
    // 第一个路径分隔符之前出现 ':' 就是别的协议（javascript: / data: / file: …）——不放行
    const head = stripped.split(/[/?#]/, 1)[0] ?? ''
    if (head.includes(':')) {
      return null
    }
    absolute = `https://${stripped}`
  }

  try {
    return encodeURI(absolute).replace(/%25([0-9A-Fa-f]{2})/g, '%$1')
  } catch {
    return null
  }
}

/*
 * 用 `new Marked()` 建**实例**，而不是全局单例：`marked.use()` 改的是全局那台渲染器，
 * 将来别处再引 marked 时会被这里的覆盖规则带偏。
 */
const memoMarked = new Marked({ gfm: true, breaks: true, async: false })

memoMarked.use({
  renderer: {
    /** 原始 HTML 一律按字面显示：既不执行、也不参与排版。 */
    html({ text }) {
      return escapeHtml(text)
    },

    link({ href, title, text, tokens, autolink }) {
      // 自动链接（裸 URL）的字符引用未被解析，按字面转义；其余照默认实现解析内联 token
      const label = autolink ? escapeHtml(text) : this.parser.parseInline(tokens)
      const clean = absoluteHref(href)
      if (clean === null) {
        return label
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      /*
       * 卡片里点链接一律新标签：整个仪表盘是被导航走的话，用户就再也回不来了。
       * `noopener` 交给 rel（不用 window.open 那套 opener 兜底）。
       */
      return `<a href="${escapeHtml(clean)}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`
    },

    image({ href, text }) {
      /*
       * **刻意不渲染图片**：外链图片会把卡片变成一块不可控的版面，
       * 尺寸、加载失败、远程请求都不受控。这里退化成纯文本 —— 有 alt 用 alt，
       * 没写 alt 就把地址亮出来，总之不让内容静默消失。
       * 顺带把 `data:` / `javascript:` 这类可疑地址也一并绕开了（它们根本不被解析）。
       */
      const label = text.trim() === '' ? href : text
      return escapeHtml(label)
    },
  },
})

/**
 * markdown 原文 → HTML。
 *
 * 解析失败（理论上不该发生，但内容是用户手写的）时退回转义后的纯文本：
 * 卡片宁可显示得难看一点，也不能整块白掉。
 */
export function renderMemoHtml(text: string): string {
  try {
    return memoMarked.parse(text, { async: false })
  } catch (error) {
    console.warn('[ffxiv-dash] markdown 解析失败，按纯文本显示', error)
    return `<pre>${escapeHtml(text)}</pre>`
  }
}
