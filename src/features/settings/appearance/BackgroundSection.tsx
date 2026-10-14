import { useState } from 'react'
import { App, Button, ColorPicker, Flex, Input, Typography, Upload } from 'antd'
import {
  BgColorsOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { clearBackgroundImage, putBackgroundImage } from '../../../core/appearance/image-store.ts'
import {
  MAX_UPLOAD_BYTES,
  isColorValue,
  isImageUrl,
} from '../../../core/appearance/store.ts'
import { useThemeProfile } from './theme-profile.ts'
import { ImageTuning } from './Tunings.tsx'
import type { AppearanceSource } from '../../../core/appearance/store.ts'

const MB = 1024 * 1024

const SOURCE_OPTIONS: readonly { value: AppearanceSource; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: '无', icon: <CloseCircleOutlined /> },
  { value: 'color', label: '纯色', icon: <BgColorsOutlined /> },
  { value: 'url', label: '图片链接', icon: <LinkOutlined /> },
  { value: 'upload', label: '上传图片', icon: <PictureOutlined /> },
]

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '未知大小'
  }
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * 输入框的草稿态：颜色与图片地址两个编辑器共用。
 * 规则一致——打字中允许不合法的中间态（如刚敲下 `#`），只有合法值才写进 store；失焦丢草稿回到已生效值
 * （不合法时即退回，合法时只是去掉首尾空白）。
 * `draft` 仅在用户正在改时非空（`null` = 跟随已生效值），外部写入（换编辑对象、恢复默认）自动跟上，无需 effect 同步。
 */
function useDraft(
  committed: string,
  canUse: (draft: string) => boolean,
  apply: (next: string) => void,
): { value: string; usable: boolean; change: (next: string) => void; commit: () => void } {
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? committed

  return {
    value,
    usable: canUse(value),
    change: (next) => {
      setDraft(next)
      if (canUse(next)) {
        // 存去首尾空白的值：失焦后输入框显示的就是 store 里的那一份
        apply(next.trim())
      }
    },
    commit: () => setDraft(null),
  }
}

/** 纯色背景：取色器给的值一定合法，直接应用；文本框走草稿态。 */
function ColorEditor(): React.ReactNode {
  const { profile, set } = useThemeProfile()
  const draft = useDraft(profile.color, isColorValue, (next) => set({ color: next }))

  return (
    <Flex align="center" gap={10}>
      <ColorPicker
        value={profile.color}
        onChange={(next) => draft.change(next.toHexString())}
        disabledAlpha
        showText={false}
      />
      <Input
        value={draft.value}
        onChange={(event) => draft.change(event.target.value)}
        onBlur={draft.commit}
        placeholder="#1f2937"
        // 颜色留空也不合法（地址可用「清空」表示不设背景，颜色不行）
        status={draft.usable ? undefined : 'error'}
        style={{ flex: 1, minWidth: 0 }}
        maxLength={32}
      />
    </Flex>
  )
}

/**
 * 图片链接。校验沿用链接卡片那套（只认协议头，不猜扩展名）加根相对路径：
 * 主题自带的背景图是 `/bg/x.jpg`，出厂档案会把它填到这里。
 */
function UrlEditor(): React.ReactNode {
  const { profile, set } = useThemeProfile()
  const draft = useDraft(profile.url, isImageUrl, (next) => set({ url: next }))

  return (
    <Input
      value={draft.value}
      onChange={(event) => draft.change(event.target.value)}
      onBlur={draft.commit}
      placeholder="https://…/wallpaper.jpg"
      // 留空表示还没填，不算写错
      status={draft.value.trim() === '' || draft.usable ? undefined : 'error'}
      maxLength={2048}
    />
  )
}

/**
 * 上传图片。文件不走 antd 上传流程（`beforeUpload` 返回 false），由我们写进 IndexedDB；超限文件在选中那一刻即拒、不落盘。
 * ⚠️ 图片本体与文件名 / 大小都是逐主题一份（IndexedDB 键 `background:<主题键>`），彼此完全独立：
 * 读写的一律是当前编辑对象（`useThemeProfile()` 的 `key`）；上传成功只写回这套主题的档案，别的主题不动。
 */
function UploadEditor(): React.ReactNode {
  const { key: themeKey, profile, set } = useThemeProfile()
  const { imageName, imageSize } = profile
  const { message } = App.useApp()

  const handleBeforeUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('只能选择图片文件')
      return false
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      message.error(`图片不能超过 ${MAX_UPLOAD_BYTES / MB} MB，这张有 ${formatBytes(file.size)}`)
      return false
    }

    void putBackgroundImage(themeKey, file).then((ok) => {
      if (!ok) {
        message.error('图片没能保存到本机（可能是浏览器禁用了本地存储）')
        return
      }
      set({ imageName: file.name, imageSize: file.size, source: 'upload' })
      message.success('背景图片已更新')
    })

    // 返回 false：阻止 antd 自己上传，由我们全权处理
    return false
  }

  const handleRemove = () => {
    void clearBackgroundImage(themeKey).then(() => {
      set({ imageName: '', imageSize: 0, source: 'none' })
      message.success('已移除背景图片')
    })
  }

  return (
    <Flex vertical gap={10}>
      <Flex align="center" gap={12} wrap>
        <Upload accept="image/*" maxCount={1} showUploadList={false} beforeUpload={handleBeforeUpload}>
          <Button icon={<UploadOutlined />}>{imageName ? '更换图片' : '选择图片'}</Button>
        </Upload>
        {imageName ? (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 0 }} ellipsis>
              {imageName} · {formatBytes(imageSize)}
            </Typography.Text>
            <Button type="text" size="small" onClick={handleRemove}>
              移除
            </Button>
          </>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            还没有选择图片
          </Typography.Text>
        )}
      </Flex>
      <Typography.Text type="secondary" className="dash-settings-hint is-inline">
        图片不超过 {MAX_UPLOAD_BYTES / MB} MB，保存在本机浏览器里（IndexedDB），每套主题互不影响。
      </Typography.Text>
    </Flex>
  )
}

const EDITORS: Record<AppearanceSource, React.ComponentType | null> = {
  none: null,
  color: ColorEditor,
  url: UrlEditor,
  upload: UploadEditor,
}

/**
 * 背景来源四选一 + 对应编辑器 + 图片专属的显示调节。
 * 改的是当前编辑对象的档案（无 Provider 时 = 当前生效主题）：「主题编辑」把它换成下拉选中的那套，每套主题各有一份背景。
 */
export function BackgroundSection(): React.ReactNode {
  const { profile, set } = useThemeProfile()
  const Editor = EDITORS[profile.source]

  return (
    <>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          背景
        </Typography.Title>

        <div className="dash-settings-options" role="radiogroup" aria-label="背景来源">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={profile.source === option.value}
              className={`dash-settings-option${profile.source === option.value ? ' is-active' : ''}`}
              onClick={() => set({ source: option.value })}
            >
              <span className="dash-settings-option-icon" aria-hidden="true">
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>

        <div className="dash-settings-block">
          {Editor ? <Editor /> : null}
        </div>
      </section>

      {profile.source === 'url' || profile.source === 'upload' ? (
        <section>
          <Typography.Title className="dash-settings-label" level={5}>
            图片显示
          </Typography.Title>
          <ImageTuning />
        </section>
      ) : null}
    </>
  )
}
