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
import { useAppearance } from '../../../core/appearance/hooks.ts'
import {
  MAX_UPLOAD_BYTES,
  isColorValue,
  isImageUrl,
  setAppearance,
} from '../../../core/appearance/store.ts'
import type { AppearanceSource } from '../../../core/appearance/store.ts'
import { ImageTuning } from './Tunings.tsx'

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
 *
 * 两者的规则完全一致 —— 打字过程中允许"还不合法"的中间态（比如刚敲下 `#`），
 * 只有合法值才写进 store；失焦时丢掉草稿，回到已生效的值
 * （不合法时正是我们要的"退回"，合法时也只是把首尾空白去掉）。
 *
 * `draft` 只在用户正在改的时候非空（`null` = 跟随已生效的值），所以外部写入
 * （选主题会自动把背景图地址填进来）会自动跟上 —— **不需要 effect 去同步**。
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
        // 存进去的是去掉首尾空白的值：失焦后输入框显示的就是 store 里的那一份
        apply(next.trim())
      }
    },
    commit: () => setDraft(null),
  }
}

/** 纯色背景：取色器给的值一定合法，直接应用；文本框走草稿态。 */
function ColorEditor(): React.ReactNode {
  const { color } = useAppearance()
  const draft = useDraft(color, isColorValue, (next) => setAppearance({ color: next }))

  return (
    <Flex align="center" gap={10}>
      <ColorPicker
        value={color}
        onChange={(next) => draft.change(next.toHexString())}
        disabledAlpha
        showText={false}
      />
      <Input
        value={draft.value}
        onChange={(event) => draft.change(event.target.value)}
        onBlur={draft.commit}
        placeholder="#1f2937"
        // 颜色框留空也是不合法（不像地址那样可以用"清空"表示不设背景）
        status={draft.usable ? undefined : 'error'}
        style={{ flex: 1, minWidth: 0 }}
        maxLength={32}
      />
    </Flex>
  )
}

/**
 * 图片链接。校验规则沿用链接卡片那套（只认协议头，不猜扩展名）+ **根相对路径**
 * （主题自带的背景图是 `/bg/x.webp`，选主题时会自动填到这里）。
 */
function UrlEditor(): React.ReactNode {
  const { url } = useAppearance()
  const draft = useDraft(url, isImageUrl, (next) => setAppearance({ url: next }))

  return (
    <Input
      value={draft.value}
      onChange={(event) => draft.change(event.target.value)}
      onBlur={draft.commit}
      placeholder="https://…/wallpaper.jpg"
      // 留空表示"还没填"，不算写错
      status={draft.value.trim() === '' || draft.usable ? undefined : 'error'}
      maxLength={2048}
    />
  )
}

/**
 * 上传图片。
 *
 * 文件不经过 antd 的上传流程（`beforeUpload` 返回 false），我们自己写进 IndexedDB。
 * 超限的文件在选中那一刻就被拒，不会落盘。
 */
function UploadEditor(): React.ReactNode {
  const { imageName, imageSize } = useAppearance()
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

    void putBackgroundImage(file).then((ok) => {
      if (!ok) {
        message.error('图片没能保存到本机（可能是浏览器禁用了本地存储）')
        return
      }
      setAppearance({ source: 'upload', imageName: file.name, imageSize: file.size })
      message.success('背景图片已更新')
    })

    // 返回 false：阻止 antd 自己发起上传，这次由我们全权处理
    return false
  }

  const handleRemove = () => {
    void clearBackgroundImage().then(() => {
      setAppearance({ source: 'none', imageName: '', imageSize: 0 })
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
        图片不超过 {MAX_UPLOAD_BYTES / MB} MB，保存在本机浏览器里（IndexedDB），
        不会写进导出的看板数据。
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
 * 背景来源四选一 + 对应的编辑器 + 图片专属的显示调节。
 *
 * 两节都放在这里：它们讲的是同一件事（背景），面板只负责把它们排在「主题」与「卡片」之间。
 */
export function BackgroundSection(): React.ReactNode {
  const { source } = useAppearance()
  const Editor = EDITORS[source]

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
              aria-checked={source === option.value}
              className={`dash-settings-option${source === option.value ? ' is-active' : ''}`}
              onClick={() => setAppearance({ source: option.value })}
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

      {source === 'url' || source === 'upload' ? (
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
