/**
 * 全项目唯一的 id 生成入口。
 * ⚠️ `crypto.randomUUID` 只在安全上下文（https / localhost）可用，带降级实现保证 http / 旧浏览器可用。
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
