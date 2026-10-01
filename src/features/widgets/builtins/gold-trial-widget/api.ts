/**
 * 黄金的试炼接口（纯逻辑，无 React；可以脱离浏览器单独验证）。
 *
 * 接口：`GET https://ffxiv-api.neeeel.com/api/goldTrial` →
 * HTTP 200，`Content-Type: text/plain`，**body 是一串 JSON**（上游盛趣活动接口原样透传），
 * 所以这里必须 `res.text()` + `JSON.parse`，不能 `res.json()`。
 * 响应头 `X-GoldTrial-Cache` 说明这份数据是命中服务端缓存还是刚回源，前端不关心。
 *
 * 数据形状（字段名沿用上游风格，只取卡面要用的部分）：
 * - `currentActive` / `nextActive`：本期 / 下一期的各阶段时间窗口，时间串形如 `2026/9/25 13:00:00`
 * - `vTerri[0]`：本周挑战副本（`territory_detail` 名称、`territory_level` 等级）
 * - `vTerriItem[0]`：登记奖励（`ItemName`，如「金碟币铜卡X2」）
 *
 * 阶段区间与活动规则的对应关系：
 * 挑战期（周五 13:00 ~ 周日 23:59）= `StartTime_Terri ~ EndTime_Terri`；
 * 登记期（截止下周四 13:00）= `~ EndTime_Reward`；结算 / 发奖期 = `~ EndTime_Result`。
 */
import { GOLD_TRIAL_API_URL } from './config.ts'

/** 一个「期」的时间窗口（解析失败 / 缺字段一律 null，不抛错）。 */
export type GoldTrialActivity = {
  /** 期号（`ActiveName`，如 `82`）；取不到为空串。 */
  name: string
  /** 公布时间 `StartTime_Online`。 */
  onlineAt: number | null
  /** 挑战期起点 `StartTime_Terri`。 */
  challengeFrom: number | null
  /** 挑战期终点 `EndTime_Terri`。 */
  challengeTo: number | null
  /** 登记截止 `EndTime_Reward`。 */
  registerTo: number | null
  /** 结算结束 `EndTime_Result`。 */
  settleTo: number | null
}

export type GoldTrialTerritory = {
  /** 副本名 `territory_detail`。 */
  name: string
  /** 副本等级 `territory_level`（原样字符串，卡面拼成 `Lv.70`）。 */
  level: string
}

export type GoldTrialData = {
  current: GoldTrialActivity | null
  next: GoldTrialActivity | null
  /** 本周挑战副本；接口没给名字时为 null。 */
  territory: GoldTrialTerritory | null
  /** 登记奖励名（`vTerriItem[0].ItemName`）；取不到为空串。 */
  rewardName: string
  /** 数据到手时刻（ms）。只用于排查，不参与渲染。 */
  fetchedAt: number
}

/** `YYYY/M/D H:mm:ss`（上游格式，月份与日不补零）。 */
const ACTIVITY_TIME_PATTERN = /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/

/**
 * 解析上游时间串为本地时间戳。
 *
 * 刻意**手写 `new Date(y, m-1, d, ...)`** 而不是 `new Date(str)`：斜杠日期串属于
 * 实现相关的兜底解析，各浏览器行为不完全一致；这里只认上游那一种格式，认不出就返回 null。
 */
export function parseActivityTime(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const match = ACTIVITY_TIME_PATTERN.exec(value.trim())
  if (!match) {
    return null
  }
  const at = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  )
  const ms = at.getTime()
  return Number.isFinite(ms) ? ms : null
}

/** 对象窄化：非对象一律当空对象，后面的取值就永远安全。 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** 字符串窄化并去空白；非字符串当空串。 */
function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 窄化一期；整个对象缺失 / 都是空值时返回 null（卡面据此走占位符）。 */
function parseActivity(value: unknown): GoldTrialActivity | null {
  const source = asRecord(value)
  if (Object.keys(source).length === 0) {
    return null
  }
  return {
    name: asString(source.ActiveName),
    onlineAt: parseActivityTime(source.StartTime_Online),
    challengeFrom: parseActivityTime(source.StartTime_Terri),
    challengeTo: parseActivityTime(source.EndTime_Terri),
    registerTo: parseActivityTime(source.EndTime_Reward),
    settleTo: parseActivityTime(source.EndTime_Result),
  }
}

/** 把接口原文窄化成卡面要用的数据（接口改版 / 字段缺失都不会抛错，只会显示占位符）。 */
export function parseGoldTrialPayload(payload: unknown, fetchedAt: number): GoldTrialData {
  const source = asRecord(payload)
  const territories = Array.isArray(source.vTerri) ? source.vTerri : []
  const territorySource = asRecord(territories[0])
  const territoryName = asString(territorySource.territory_detail)
  const items = Array.isArray(source.vTerriItem) ? source.vTerriItem : []

  return {
    current: parseActivity(source.currentActive),
    next: parseActivity(source.nextActive),
    territory:
      territoryName === ''
        ? null
        : { name: territoryName, level: asString(territorySource.territory_level) },
    rewardName: asString(asRecord(items[0]).ItemName),
    fetchedAt,
  }
}

/** 卡面阶段。 */
export type GoldTrialPhase = 'upcoming' | 'challenge' | 'register' | 'settling' | 'finished'

export type GoldTrialPhaseInfo = {
  phase: GoldTrialPhase
  /** 当前阶段的截止时刻（挑战期 = 挑战结束、登记期 = 登记截止、结算期 = 结算结束）；取不到为 null。 */
  until: number | null
}

/** 阶段名（标题行右侧的状态文字）。 */
export const GOLD_TRIAL_PHASE_LABELS: Record<GoldTrialPhase, string> = {
  upcoming: '未开始',
  challenge: '挑战中',
  register: '登记中',
  settling: '结算中',
  finished: '已结束',
}

/**
 * 按本地时钟判定当前阶段。
 *
 * 顺序即优先级：先看挑战期（含未开始），再看登记期（截止下周四 13:00），最后是结算期。
 * 区间字段缺失时不会误判成"进行中"——`upcoming` 与 `finished` 分别兜住两端，
 * 卡面只显示期号与副本名，不会出现倒计时钟往负数走的读数。
 */
export function resolvePhase(activity: GoldTrialActivity | null, now: number): GoldTrialPhaseInfo {
  if (!activity) {
    return { phase: 'upcoming', until: null }
  }
  const { challengeFrom, challengeTo, registerTo, settleTo } = activity

  if (challengeFrom !== null && now < challengeFrom) {
    return { phase: 'upcoming', until: challengeFrom }
  }
  if (challengeTo !== null && now <= challengeTo) {
    return { phase: 'challenge', until: challengeTo }
  }
  if (registerTo !== null && now <= registerTo) {
    return { phase: 'register', until: registerTo }
  }
  if (settleTo !== null && now <= settleTo) {
    return { phase: 'settling', until: settleTo }
  }
  // 结算期也过了：本期结束，卡面靠"下期预告"交代后续
  return { phase: 'finished', until: settleTo }
}

/** `9/25 13:00`：卡面所有时刻都用它；活动都在当下几周内，不显示年份。 */
export function formatDayTime(at: number): string {
  const date = new Date(at)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${String(date.getMonth() + 1)}/${String(date.getDate())} ${hour}:${minute}`
}

/**
 * 剩余时长：`2天3时` / `3时20分` / `45分`。
 *
 * 0 值一律省略，最小单位是分（卡面按分钟粒度刷新，显示秒只会白渲染）；
 * 已过期的时刻夹到 `0分`，不会出现负数读数。
 */
export function formatCountdown(until: number, now: number): string {
  const totalMinutes = Math.max(0, Math.floor((until - now) / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) {
    return `${String(days)}天${String(hours)}时`
  }
  if (hours > 0) {
    return `${String(hours)}时${String(minutes)}分`
  }
  return `${String(minutes)}分`
}

/** 同一 URL 的并发请求合并成一次：StrictMode 双挂载、同页多张同卡都只发一次。 */
const inFlight = new Map<string, Promise<GoldTrialData>>()

/** `res.text()` → `JSON.parse`；非法 JSON 给一句中文错误，方便卡面直接显示。 */
function parseTextPayload(text: string, fetchedAt: number): GoldTrialData {
  try {
    const payload: unknown = JSON.parse(text)
    return parseGoldTrialPayload(payload, fetchedAt)
  } catch {
    throw new Error('响应不是合法 JSON')
  }
}

export function fetchGoldTrial(): Promise<GoldTrialData> {
  const running = inFlight.get(GOLD_TRIAL_API_URL)
  if (running) {
    return running
  }

  const task = fetch(GOLD_TRIAL_API_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`)
      }
      // 上游是 text/plain 的 JSON 原文：不能走 response.json()
      return parseTextPayload(await response.text(), Date.now())
    })
    .catch((error: unknown) => {
      /*
       * 失败细节只进控制台：卡面只在标题行留一个「获取失败」，原因悬停可看。
       * 记在这里而不是调用方 —— 并发调用共用这一个 Promise，一次真实请求只打一条。
       */
      console.error('[ffxiv-dash] 黄金的试炼获取失败', { url: GOLD_TRIAL_API_URL, error })
      throw error
    })
    .finally(() => {
      inFlight.delete(GOLD_TRIAL_API_URL)
    })

  inFlight.set(GOLD_TRIAL_API_URL, task)
  return task
}
