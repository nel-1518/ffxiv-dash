import { Flex, Input, Typography } from 'antd'
import { useAutoOpenLinks } from '../../core/auto-open/hooks.ts'
import { parseLinks, setAutoOpenLinks } from '../../core/auto-open/store.ts'

/**
 * 跳转：每天首次进入页面时自动打开一批链接。
 *
 * 改动即时生效（与「外观」一节同一个做法，没有"保存"按钮）：内容就是几行文本，
 * 多一步确认反而碍事。输入框每次按键都写回 store —— 半截的输入只是"暂时认不出来"，
 * 认不出来的行会在下面的提示里点一下，不影响其它行。
 */
export function AutoOpenSettingsPanel(): React.ReactNode {
  const links = useAutoOpenLinks()
  const { links: parsed, invalid } = parseLinks(links)

  const summary =
    parsed.length === 0
      ? invalid.length === 0
        ? '还没填链接，当前不会自动打开任何页面。'
        : `${invalid.length} 行认不出来，已忽略。`
      : `将自动打开 ${parsed.length} 个链接${
          invalid.length === 0 ? '' : `；另有 ${invalid.length} 行认不出来，已忽略`
        }。`

  return (
    <Flex vertical gap={22}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>
          跳转
        </Typography.Title>
        <Typography.Text type="secondary" className="dash-settings-hint is-inline">
          每行一个链接，每天首次进入页面时会自动打开。
          <br />
          浏览器默认会拦截"页面自己打开的新标签页"：允许本站弹出窗口后才能真正自动跳转，
          否则会弹出一条提示，点那里的按钮也能一次性打开。
        </Typography.Text>

        <div className="dash-settings-block">
          <Input.TextArea
            value={links}
            onChange={(event) => setAutoOpenLinks(event.target.value)}
            placeholder={'https://example.com\nwww.example.com'}
            autoSize={{ minRows: 6, maxRows: 14 }}
            spellCheck={false}
          />
        </div>

        <Typography.Text type="secondary" className="dash-settings-hint">
          {summary}
        </Typography.Text>
      </section>
    </Flex>
  )
}
