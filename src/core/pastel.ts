/**
 * 图标默认底色：**稳定 Hash + 12 色固定 pastel 调色板**。
 *
 * 链接没有自己的图标时，卡片上显示"一个字符 + 一层底色"。底色不随机生成 ——
 * 直接对 hash 取任意 RGB 会出现过亮、过艳、过脏的颜色，所以这里只用下面这 12 个
 * 人工挑过的低饱和色（Linear / Raycast 那类导航 UI 的观感）。
 *
 * 稳定性：同一个 key 永远落在同一个颜色上 —— 刷新、重开、拖动排序都不会变，
 * 因为 hash 只取决于 key 本身，不掺任何运行期状态（没有 `Math.random()`，也没有序号）。
 */

export type PastelColor = {
  name: string
  /** 底色。 */
  bg: string
  /** 前景色（同一色相的深色版，保证字符在底色上的对比度）。 */
  fg: string
}

/**
 * 12 个定色。顺序就是取值顺序（`hash % 12`），**加色或换序会让所有已有链接换色**。
 */
export const pastelPalette: readonly PastelColor[] = [
  {
    name: 'rose',
    bg: '#FCE8EC',
    fg: '#B83A5E',
  },
  {
    name: 'red',
    bg: '#FDE9E5',
    fg: '#B94736',
  },
  {
    name: 'orange',
    bg: '#FCEEDB',
    fg: '#A85D16',
  },
  {
    name: 'amber',
    bg: '#FBF2D8',
    fg: '#8B6A00',
  },
  {
    name: 'lime',
    bg: '#EEF4D8',
    fg: '#657A1F',
  },
  {
    name: 'green',
    bg: '#E6F2E5',
    fg: '#3D7745',
  },
  {
    name: 'teal',
    bg: '#E0F2EF',
    fg: '#28776E',
  },
  {
    name: 'cyan',
    bg: '#E1F1F6',
    fg: '#347285',
  },
  {
    name: 'blue',
    bg: '#E5EEFA',
    fg: '#426B9C',
  },
  {
    name: 'indigo',
    bg: '#E8E9FA',
    fg: '#5A5FA4',
  },
  {
    name: 'violet',
    bg: '#EEE7F8',
    fg: '#7651A6',
  },
  {
    name: 'pink',
    bg: '#F7E7F1',
    fg: '#9B4F79',
  },
]

/**
 * FNV-1a 32 位 hash。
 *
 * 刻意写成全整数运算（`Math.imul` + `>>> 0`）：`hash * 31 + c` 那类写法在 32 位处
 * 会溢出成浮点数，结果因引擎而异，就做不到"跨浏览器、跨刷新完全一致"。
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

/** 任意字符串 → 调色板里的某个定色；同一个输入永远同一个输出。 */
export function getPastelColor(value: string): PastelColor {
  const hash = hashString(value)
  const index = hash % pastelPalette.length

  return pastelPalette[index] as PastelColor
}

/**
 * 从用户填的网址里取出域名；解析不出来返回 null。
 * 先按原样解析，失败再补 `https://` 重试（用户常常只填 `example.com`）。
 */
function hostOf(url: string): string | null {
  const raw = url.trim()
  if (!raw) {
    return null
  }
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const parsed = new URL(candidate)
      if (parsed.hostname) {
        return parsed.hostname
      }
    } catch {
      // 继续尝试下一种写法
    }
  }
  return null
}

/**
 * 一条链接该用哪个底色。
 *
 * key 取**域名**而不是名称：同一个应用（同一站点）无论叫什么名字、放在哪个分组、
 * 排在第几行，颜色都一致，改名也不换色。域名解析不出来时才退回名称。
 */
export function pastelColorOfLink(url: string, name: string): PastelColor {
  const key = hostOf(url) || name.trim()
  return getPastelColor(key)
}
