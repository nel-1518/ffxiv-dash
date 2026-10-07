import { Component } from 'react'
import { Button, Result, Typography } from 'antd'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * 渲染错误边界（全站唯一，挂在 AppProviders 最内层）：渲染期异常降级为错误页而非白屏，
 * 看板数据不受影响（落盘在 localStorage，与渲染无关）。
 *
 * 必须是 class 组件：React 只允许 class 通过 `getDerivedStateFromError` / `componentDidCatch`
 * 捕获子树渲染错误。降级 UI 在 ConfigProvider 与 App 之内（主题与文案可用），
 * 但不依赖 `App.useApp()` 的 message —— class 组件用不了 hook，降级页只做静态展示。
 */
export type ErrorBoundaryProps = {
  children: ReactNode
  /**
   * 捕获到错误时的降级 UI；不传则用内置的整站降级页。
   * 拿到 `error`（供展示/上报）与 `reset`（重试按钮调用，清空错误重新渲染子树）。
   */
  renderFallback?: (error: unknown, reset: () => void) => ReactNode
  /**
   * 该值变化时自动清除已捕获的错误（"改完自动重试"）。
   * 传入"出错后可能被修复的那个引用"即可，例如卡片数据对象。
   */
  resetKey?: unknown
}

type ErrorBoundaryState = { error: unknown; prevResetKey: unknown }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: undefined, prevResetKey: undefined }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    /*
     * resetKey 变化时清掉已捕获的错误，让子树重新渲染。
     * 在渲染期对齐 prev 值而非 `componentDidUpdate` 里 `setState`：少跑一帧，
     * 也不触发 react/no-did-update-set-state。
     */
    if (state.prevResetKey !== props.resetKey) {
      return { prevResetKey: props.resetKey, error: undefined }
    }
    return null
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // 只记录不弹提示（降级页本身就是提示）；组件栈用于定位出错分支，将来接上报时这里是挂钩点
    console.error('[ffxiv-dash] 渲染出错', error, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: undefined })
  }

  render(): ReactNode {
    if (this.state.error !== undefined) {
      const render = this.props.renderFallback ?? appCrashFallback
      return render(this.state.error, this.reset)
    }
    return this.props.children
  }
}

/** 整站降级页：重试（原地重新挂载子树）与刷新（新文档重新加载全部脚本）。 */
function appCrashFallback(error: unknown, reset: () => void): ReactNode {
  const message =
    error instanceof Error && error.message ? error.message : String(error ?? '未知错误')
  return (
    <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Result
        status="error"
        title="页面渲染出错"
        subTitle="看板崩溃了。本地保存的数据不会丢失；可以先重试，若反复出现请刷新页面。"
        extra={[
          <Button key="retry" type="primary" onClick={reset}>
            重试
          </Button>,
          <Button key="reload" onClick={() => window.location.reload()}>
            刷新页面
          </Button>,
        ]}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 560 }}>
          <Typography.Text code>错误信息：{message.slice(0, 200)}</Typography.Text>
        </Typography.Paragraph>
      </Result>
    </div>
  )
}
