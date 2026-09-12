import { Flex, Typography } from 'antd'
import { BackgroundSection } from './appearance/BackgroundSection.tsx'
import { CardTuning } from './appearance/Tunings.tsx'
import { ThemePicker } from './appearance/ThemePicker.tsx'

/**
 * 外观设置。
 *
 * 只有三节（主题 → 背景 → 卡片），具体实现分在 `./appearance/` 下：
 * - `ThemePicker`：八选一 + 换主题时同步背景与卡片参数；
 * - `BackgroundSection`：「背景」与「图片显示」两节（同一件事：背景来源与其显示参数）；
 * - `Tunings`：滑块行与两组调节（背景显示、卡片底色）。
 *
 * 改动即时生效（背景层与卡片参数直接吃外观快照），没有"保存"按钮 —— 这类偏好改一眼就知道对不对，
 * 多一步确认反而碍事。
 */
export function AppearanceSettingsPanel(): React.ReactNode {
  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          主题
        </Typography.Title>
        <ThemePicker />
      </section>

      <BackgroundSection />

      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          卡片
        </Typography.Title>
        <CardTuning />
      </section>
    </Flex>
  )
}
