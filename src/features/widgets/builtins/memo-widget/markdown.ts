/**
 * 备忘卡的 markdown 渲染（纯逻辑，不导入 React，可直接用 node 跑）。marked 自 v5 起不做 sanitize，内容会经 `dangerouslySetInnerHTML` 进 DOM、且可能来自导入的看板 JSON，故用三处 renderer 覆盖收掉危险面：
 * - `html()`：原始 HTML 转义输出，`<script>` / `onerror=` 一律变成文本；
 * - `link()`：只放行 http(s) / mailto，其余一律当外链补 `https://`；`javascript:` 等未知协议只留可见文本；
 * - `image()`：完全不渲染图片（用户要求）。其余语法走 marked 默认实现，产出标签均在固定白名单内，无属性注入面。
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
 * 判定协议前必须先做：`java\nscript:alert(1)` 这种写法（浏览器会忽略换行与制表符）单靠前缀比对拦不住。
 * 用循环而非正则，避免为这一行小逻辑引入控制字符正则。
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
 * 把用户手写的链接一律当作外链，返回可以安全放进 `href` 的绝对地址（规则与 `core/auto-open/store.ts` 一致）：
 * - `https:` / `http:` / `mailto:` 原样（编码后）；`//x.com/a`、`x.com`、`www.a.com` 补成 `https://…`；
 * - `#锚点` / `/根相对路径` 不算链接：本看板无站内路由，相对地址只会解到本站 404；`javascript:` / `data:` / `file:` 等不算链接，只留可见文本。
 * ⚠️ 判定协议前必须先剥掉控制字符（见 `stripInvisible`）：`java\nscript:alert(1)` 单靠前缀比对拦不住。返回 null 表示「不是链接」，由调用方只留文本。
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
    // 锚点与根相对路径：无去处，也不该静默变成「本站相对跳转」
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
 * 用 `new Marked()` 建实例而非全局单例：`marked.use()` 改的是全局渲染器，别处再引 marked 会被这里的覆盖规则带偏。
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
       * 卡片里点链接一律新标签：整个仪表盘被导航走的话用户就回不来了。
       * `noopener` 交给 rel（不用 window.open 那套 opener 兜底）。
       */
      return `<a href="${escapeHtml(clean)}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`
    },

    image({ href, text }) {
      /*
       * 刻意不渲染图片：外链图片的尺寸、加载失败、远程请求都不可控，卡片版面会失控。
       * 退化成纯文本——有 alt 用 alt，没写 alt 就亮出地址，不让内容静默消失；
       * `data:` / `javascript:` 这类可疑地址也顺带绕开（它们根本不被解析）。
       */
      const label = text.trim() === '' ? href : text
      return escapeHtml(label)
    },
  },
})

/**
 * markdown 原文 → HTML。
 * 解析失败（内容是用户手写的，理论上不该发生）时退回转义后的纯文本：卡片宁可难看点，不能整块白掉。
 */
export function renderMemoHtml(text: string): string {
  try {
    return memoMarked.parse(text, { async: false })
  } catch (error) {
    console.warn('[ffxiv-dash] markdown 解析失败，按纯文本显示', error)
    return `<pre>${escapeHtml(text)}</pre>`
  }
}
