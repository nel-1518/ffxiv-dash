import { Flex, Slider, Typography } from 'antd'
import { CARD_BLUR_MAX } from '../../../core/appearance/store.ts'
import { useThemeProfile } from './theme-profile.ts'

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
  const { profile, set } = useThemeProfile()

  return (
    <Flex vertical gap={14}>
      <SliderRow
        label="模糊"
        value={profile.blur}
        min={0}
        max={20}
        suffix="px"
        onChange={(next) => set({ blur: next })}
      />
      <SliderRow
        label="亮度"
        value={profile.brightness}
        min={20}
        max={150}
        suffix="%"
        onChange={(next) => set({ brightness: next })}
      />
    </Flex>
  )
}

/** 卡片底色的两个参数；与背景来源无关，任何页面状态下都能调。 */
export function CardTuning(): React.ReactNode {
  const { profile, set } = useThemeProfile()

  return (
    <Flex vertical gap={14}>
      <SliderRow
        label="不透明度"
        value={profile.cardAlpha}
        min={0}
        max={100}
        suffix="%"
        onChange={(next) => set({ cardAlpha: next })}
      />
      <SliderRow
        label="模糊"
        value={profile.cardBlur}
        min={0}
        max={CARD_BLUR_MAX}
        suffix="px"
        onChange={(next) => set({ cardBlur: next })}
      />
    </Flex>
  )
}
