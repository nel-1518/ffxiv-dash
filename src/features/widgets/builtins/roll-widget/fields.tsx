import { Form, InputNumber } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { rollDice, rollLabel, sumRolls } from './config.ts'
import type { RollConfig } from './config.ts'
import type { WidgetRenderProps } from '../../types.ts'

export function RollFormFields(): React.ReactNode {
  return (
    <>
      <Form.Item label="骰子数量" name={['config', 'count']} extra="最多 10 颗">
        <InputNumber min={1} max={10} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="骰子面数" name={['config', 'faces']} extra="2 ~ 999">
        <InputNumber min={2} max={999} precision={0} style={{ width: '100%' }} />
      </Form.Item>
    </>
  )
}

/**
 * 掷骰卡。
 *
 * 数量与面数都由用户自定。
 * 点一下即掷，翻滚约 0.7s 后定格并做一次 pop 缩放强化「落定」手感。
 */

/** 一次掷骰的定格结果：总点数给大号读数，各颗点数给结果文案。 */
type RollResult = {
  total: number
  rolls: number[]
}

const ROLLING_MS = 700
const TICK_MS = 60

export function RollRender({ config }: WidgetRenderProps<RollConfig>): React.ReactNode {
  /** 翻滚期间实时跳动的数字；null 表示还没掷过。 */
  const [display, setDisplay] = useState<number | null>(null)
  const [rolling, setRolling] = useState(false)
  const [result, setResult] = useState<RollResult | null>(null)
  /** 落定时 +1，作为大数字的 key 触发重挂载、重放 pop 动画。 */
  const [popKey, setPopKey] = useState(0)
  const timers = useRef<{ interval?: number; timeout?: number }>({})

  // 卸载时兜底清掉翻滚定时器，避免对已卸载组件 setState
  useEffect(
    () => () => {
      window.clearInterval(timers.current.interval)
      window.clearTimeout(timers.current.timeout)
    },
    [],
  )

  // 改了骰面后旧读数已不属于新骰子的值域，清掉重来
  useEffect(() => {
    setDisplay(null)
    setResult(null)
  }, [config.count, config.faces])

  const roll = () => {
    if (rolling) return
    const final = rollDice(config.count, config.faces)
    setRolling(true)
    // 翻滚期就在最终结果的值域里跳：min 是 count（全 1）、max 是 count × faces（全满）
    timers.current.interval = window.setInterval(
      () => setDisplay(config.count + Math.floor(Math.random() * (config.count * config.faces - config.count + 1))),
      TICK_MS,
    )
    timers.current.timeout = window.setTimeout(() => {
      window.clearInterval(timers.current.interval)
      setDisplay(sumRolls(final))
      setResult({ total: sumRolls(final), rolls: final })
      setRolling(false)
      setPopKey((key) => key + 1)
    }, ROLLING_MS)
  }

  const settled = result !== null && !rolling

  return (
    /*
     * **整张卡面就是掷骰按钮**：读数、骰面小字、结果行都包在同一颗 button 里，
     * 不用瞄准 46px 的数字，卡片上任何一点按下去都掷 —— 空白也是有效点击区。
     * 翻滚期间整颗禁用，pop / 抖动都走 transform，不占布局，别的元素不会被顶动。
     */
    <button
      type="button"
      className={`dash-roll dash-card-fill${rolling ? ' is-rolling' : ''}`}
      onClick={roll}
      disabled={rolling}
      title="点击掷骰"
      aria-label={`掷 ${rollLabel(config)}`}
    >
      <span className="dash-roll-face">{rollLabel(config)}</span>

      <span
        key={popKey}
        className={`dash-roll-value${rolling ? ' is-rolling' : settled ? ' is-settled' : ''}`}
      >
        {display ?? '—'}
      </span>

      {/*
        结果行**常驻**：三个阶段只是换内容（提示 → 省略号 → 结果文案），
        高度永远占住一行 —— 它若按条件渲染，首次掷骰会凭空多出一行，把上面的数字顶得跳一下。
        多颗骰的加法串可能很长，超宽走省略号，不让它把卡片撑高。
      */}
      <span
        className={`dash-roll-result${rolling ? ' is-rolling' : settled ? '' : ' is-idle'}`}
        aria-live="polite"
      >
        {rolling
          ? '……'
          : settled
            ? config.count > 1
              ? `${rollLabel(config)}：${result.rolls.join(' + ')} = ${result.total}`
              : `${rollLabel(config)}：掷出了🎲 ${result.total} 点！`
            : '点击开始掷骰'}
      </span>
    </button>
  )
}
