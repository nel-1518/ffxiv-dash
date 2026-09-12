import { Flex, Slider, Typography } from 'antd'
import { useAppearance } from '../../../core/appearance/hooks.ts'
import { CARD_BLUR_MAX, setAppearance } from '../../../core/appearance/store.ts'

/** 一根「标签 + 滑块 + 读数」。背景与卡片两组调节共用，避免重复排版。 */
function SliderRow({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (next: number) => void
}): React.ReactNode {
  return (
    <Flex align="center" gap={12}>
      <Typography.Text type="secondary" style={{ flex: 'none', width: 56, fontSize: 12 }}>
        {label}
      </Typography.Text>
      <Slider
        style={{ flex: 1, minWidth: 0 }}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        tooltip={{ formatter: (next) => `${next}${suffix}` }}
      />
      <Typography.Text
        type="secondary"
        style={{ flex: 'none', width: 48, fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        {suffix}
      </Typography.Text>
    </Flex>
  )
}

/** 图片专用的两个调节：模糊 / 亮度。颜色模式不出现这些。 */
export function ImageTuning(): React.ReactNode {
  const { blur, brightness } = useAppearance()

  return (
    <Flex vertical gap={14}>
      <SliderRow label="模糊" value={blur} min={0} max={20} suffix="px" onChange={(next) => setAppearance({ blur: next })} />
      <SliderRow
        label="亮度"
        value={brightness}
        min={20}
        max={150}
        suffix="%"
        onChange={(next) => setAppearance({ brightness: next })}
      />
    </Flex>
  )
}

/** 卡片底色的两个参数；与背景来源无关，任何页面状态下都能调。 */
export function CardTuning(): React.ReactNode {
  const { cardAlpha, cardBlur } = useAppearance()

  return (
    <Flex vertical gap={14}>
      <SliderRow
        label="不透明度"
        value={cardAlpha}
        min={0}
        max={100}
        suffix="%"
        onChange={(next) => setAppearance({ cardAlpha: next })}
      />
      <SliderRow
        label="模糊"
        value={cardBlur}
        min={0}
        max={CARD_BLUR_MAX}
        suffix="px"
        onChange={(next) => setAppearance({ cardBlur: next })}
      />
    </Flex>
  )
}
