/**
 * 把一段文本存成文件下载（纯 DOM，无 React）。
 *
 * 收在 core 是因为有两个不同 feature 的调用方：设置里的数据管理（导出备份）与
 * 看板读盘失败的提示条（导出读不出来的原文）。两边各抄一份迟早会走样 ——
 * 尤其是下面那个"点击后立刻 revoke 会把下载掐断"的坑，只能记在一处。
 */

/** 文件名里的时间戳：本地时间、到分钟，够用来区分多次导出。 */
export function timestampForFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('')
}

/**
 * 把文本存成文件下载。
 *
 * `mime` 由调用方给：备份是 JSON，读盘失败的原文可能连 JSON 都不是（那时给 text/plain，
 * 免得把一个语法错误的内容标成"这是 JSON"）。
 */
export function downloadText(text: string, fileName: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 点击后立刻 revoke 在部分浏览器里会把下载掐断，挪到下一个任务里做
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
