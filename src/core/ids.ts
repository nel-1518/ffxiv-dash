/**
 * 全项目唯一的 id 生成入口。
 *
 * `crypto.randomUUID` 只在安全上下文（https / localhost）可用，
 * 因此这里带一个降级实现，保证在 http 或旧浏览器下依然可用。
 */
export function createId(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID()
  }
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `${time}-${random}`
}
