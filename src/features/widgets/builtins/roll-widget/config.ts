/** 掷骰卡的配置类型、默认值与归一化（纯数据，无组件）。 */
export type RollConfig = {
  /** 骰子数量。 */
  count: number
  /** 单颗骰子的面数（XdY 里的 Y）。 */
  faces: number
}

/** 骰子数量的上限：再多一次掷出的列表读不过来，也没人这么掷。 */
export const ROLL_MAX_DICE = 10
/** 面数下限：d1 恒为 1，掷了等于没掷；从 d2 起才算骰子。 */
export const ROLL_MIN_FACES = 2
/** 面数上限：对齐游戏内 /random 的 999。 */
export const ROLL_MAX_FACES = 999

export const ROLL_DEFAULT_CONFIG: RollConfig = {
  count: 1,
  faces: 999,
}

function toInteger(raw: unknown, fallback: number): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback
}

/** 骰面显示名（如 1d100 / 3d6）。 */
export function rollLabel(config: RollConfig): string {
  return `${config.count}d${config.faces}`
}

/** 掷一把：count 颗 faces 面骰，各颗独立随机。 */
export function rollDice(count: number, faces: number): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * faces))
}

/** 总点数：大号读数显示的就是它。 */
export function sumRolls(rolls: number[]): number {
  return rolls.reduce((total, value) => total + value, 0)
}

/** 校验并归一化配置：补默认值、夹取范围，兜底旧数据/脏数据。 */
export function normalizeRollConfig(raw: unknown): RollConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const count = Math.min(ROLL_MAX_DICE, Math.max(1, toInteger(source.count, ROLL_DEFAULT_CONFIG.count)))
  const faces = Math.min(ROLL_MAX_FACES, Math.max(ROLL_MIN_FACES, toInteger(source.faces, ROLL_DEFAULT_CONFIG.faces)))
  return { count, faces }
}
