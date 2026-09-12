/**
 * 艾欧泽亚时间转换工具
 * 参考了 https://github.com/violarulan/EorzeaTimeConvert
 */


/** 艾欧泽亚时间常量（单位：秒） */
const YEAR = 33177600
const MONTH = 2764800
const DAY = 86400
const HOUR = 3600
const MINUTE = 60
const SECOND = 1

/** 艾欧泽亚时间与地球时间的换算比率 */
const EORZEA_TIME_CONSTANT = 3600 / 175

/** 艾欧泽亚时间结构 */
export interface EorzeaTime {
  yearVal: number
  monthVal: number
  dayVal: number
  hourVal: number
  minuteVal: number
  secondVal: number
}

/**
 * 将地球时间转换为艾欧泽亚时间
 * @param time - 地球时间（JavaScript Date 对象）
 * @returns 艾欧泽亚时间结构
 */
export function ConvertToEorzeaTime(time: Date): EorzeaTime {
  const earthTime = Math.floor(time.getTime() / 1000)
  const eorzeaTime = Math.floor(earthTime * EORZEA_TIME_CONSTANT)

  return {
    yearVal: Math.floor(eorzeaTime / YEAR) + 1,
    monthVal: Math.floor((eorzeaTime / MONTH) % 12) + 1,
    dayVal: Math.floor((eorzeaTime / DAY) % 32) + 1,
    hourVal: Math.floor((eorzeaTime / HOUR) % 24),
    minuteVal: Math.floor((eorzeaTime / MINUTE) % 60),
    secondVal: Math.floor((eorzeaTime / SECOND) % 60),
  }
}

/**
 * 将地球时间转换为格式化的艾欧泽亚时间字符串
 * @param time - 地球时间
 * @param format - 格式化模板，例如 "Y-M-D H:m:s"
 * @returns 格式化后的字符串
 */
export function ConvertToEorzeaTimeString(time: Date, format: string): string {
  const earthTime = Math.floor(time.getTime() / 1000)
  const eorzeaTime = Math.floor(earthTime * EORZEA_TIME_CONSTANT)

  const yearVal = String(Math.floor(eorzeaTime / YEAR) + 1)
  const monthVal = formatZero(String(Math.floor((eorzeaTime / MONTH) % 12) + 1))
  const dayVal = formatZero(String(Math.floor((eorzeaTime / DAY) % 32) + 1))
  const hourVal = formatZero(String(Math.floor((eorzeaTime / HOUR) % 24)))
  const minuteVal = formatZero(String(Math.floor((eorzeaTime / MINUTE) % 60)))
  const secondVal = formatZero(String(Math.floor((eorzeaTime / SECOND) % 60)))

  return format
    .replace(/Y/, yearVal)
    .replace(/M/, monthVal)
    .replace(/D/, dayVal)
    .replace(/H/, hourVal)
    .replace(/m/, minuteVal)
    .replace(/s/, secondVal)
}

/** 解析艾欧泽亚时间字符串（内部辅助函数）。 */
function parseEorzeaTimeString(timestring: string, format: string): Date | null {
  void format
  const regex = /(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)/
  const match = timestring.match(regex)
  if (!match) return null

  const [, year, month, day, hour, minute, second] = match.map(Number)
  return new Date(year, month - 1, day, hour, minute, second)
}

/**
 * 将艾欧泽亚时间字符串转换为地球时间
 * @param timestring - 艾欧泽亚时间字符串
 * @param format - 格式化模板
 * @returns 地球时间的 Date 对象
 */
export function ConvertToEarthTime(timestring: string, format: string): Date {
  const date = parseEorzeaTimeString(timestring, format)
  if (!date) {
    throw new Error('无法解析艾欧泽亚时间字符串')
  }

  const years = date.getFullYear()
  const months = date.getMonth() + 1
  const days = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()

  const utc = Math.floor(
    ((years - 1) * YEAR +
      (months - 1) * MONTH +
      (days - 1) * DAY +
      hours * HOUR +
      minutes * MINUTE +
      seconds) /
      EORZEA_TIME_CONSTANT,
  )

  return new Date(utc * 1000)
}

/** 若字符串长度为 1，则在前面补零。 */
export function formatZero(str: string): string {
  return str.length === 1 ? `0${str}` : str
}
