import { useState, useSyncExternalStore } from 'react'
import { Alert, Button } from 'antd'
import { readBootFailure, subscribeBoard } from '../../state/board-store.ts'
import type { BoardLoadFailure } from '../../core/storage/persistent.ts'

/** 每档失败原因对应一句人话：用户该知道的不是「出错了」，而是「什么坏了、现在看到的是什么」。 */
const FAILURE_TEXT: Record<BoardLoadFailure, string> = {
  storage:
    '浏览器不允许访问本地存储（隐私模式，或站点权限被禁）：这次载入的是默认看板，改动也无法保存，请先检查浏览器的站点设置。',
  json:
    '本机保存的看板数据不是合法的 JSON（可能被截断或手改过），这次临时载入了默认看板。原始内容还留在本机，可到「设置 → 数据管理」导出看板原始数据、导入自己的备份，或恢复默认数据。',
  schema:
    '本机保存的看板数据结构无法识别（版本不符或字段缺失），这次临时载入了默认看板。原始内容还留在本机，可到「设置 → 数据管理」导出看板原始数据、导入自己的备份，或恢复默认数据。',
}

/**
 * 启动读盘失败时的页面提示条。回退默认数据是「界面永远可用」的兜底，但静默回退会让用户以为看板凭空没了
 * —— 必须把「读不出来」说出来并给下一步：按钮直接进「设置 → 数据管理」（那里的三个动作是真正的处理手段）。
 * ⚠️ 自己订阅失败原因而非由 `DashboardPage` 透传：父层刻意不订阅任何看板数据，多一个订阅换来「卡片改动不惊动整页」。
 */
export function BoardLoadAlert({
  onOpenDataSettings,
}: {
  onOpenDataSettings: () => void
}): React.ReactNode {
  const failure = useSyncExternalStore(subscribeBoard, readBootFailure)
  /** 提示可关：提示过就够了，不该一直占着页面顶部。 */
  const [dismissed, setDismissed] = useState(false)

  if (failure === null || dismissed) {
    return null
  }

  return (
    <div className="dash-alert-bar">
      <Alert
        type="error"
        showIcon
        closable={{ onClose: () => setDismissed(true) }}
        title="看板数据读取失败，已载入默认看板"
        description={FAILURE_TEXT[failure]}
        action={
          failure === 'storage' ? undefined : (
            <Button size="small" onClick={onOpenDataSettings}>
              去数据管理
            </Button>
          )
        }
      />
    </div>
  )
}
