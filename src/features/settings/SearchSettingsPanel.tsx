import { DeleteOutlined, HolderOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { App, Button, Checkbox, Flex, Input, Popconfirm, Typography } from 'antd'
import { useState } from 'react'
import { useSearchEngines } from '../../core/search/hooks.ts'
import { resetSearchEngines, setSearchEngines, type SearchEngineConfig } from '../../core/search/store.ts'

function newEngine(): SearchEngineConfig {
  return {
    key: `engine-${Date.now()}`,
    name: '新搜索引擎',
    urlTemplate: 'https://example.com/search?q=%s',
    enabled: true,
  }
}

export function SearchSettingsPanel(): React.ReactNode {
  const engines = useSearchEngines()
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const { message } = App.useApp()

  const update = (key: string, patch: Partial<SearchEngineConfig>) => {
    setSearchEngines(engines.map((engine) => (engine.key === key ? { ...engine, ...patch } : engine)))
  }

  const add = () => setSearchEngines([...engines, newEngine()])
  const remove = (key: string) => setSearchEngines(engines.filter((engine) => engine.key !== key))
  const reset = () => {
    resetSearchEngines()
    message.success('已恢复默认搜索引擎设置')
  }

  const handleDrop = (targetKey: string) => {
    if (!draggingKey || draggingKey === targetKey) {
      return
    }
    const fromIndex = engines.findIndex((engine) => engine.key === draggingKey)
    const toIndex = engines.findIndex((engine) => engine.key === targetKey)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    const next = [...engines]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setSearchEngines(next)
  }

  const clearDrag = () => {
    setDraggingKey(null)
    setOverKey(null)
  }

  return (
    <Flex vertical gap={18}>
      <section>
        <Typography.Title className="dash-settings-label" level={5}>搜索引擎</Typography.Title>
        <Typography.Text type="secondary" className="dash-settings-hint is-inline">
          勾选后，输入关键词时会在搜索弹窗中显示对应候选项。地址中的 "%s" 会替换为搜索词。
        </Typography.Text>
      </section>

      <Flex vertical>
        {engines.map((engine) => (
          <Flex
            key={engine.key}
            vertical
            gap={8}
            className={`dash-search-engine-row${overKey === engine.key ? ' is-drag-over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setOverKey(engine.key)
            }}
            onDrop={(event) => {
              event.preventDefault()
              handleDrop(engine.key)
              clearDrag()
            }}
          >
            <Flex align="center" gap={8}>
              <Button
                type="text"
                className="dash-search-engine-drag-handle"
                icon={<HolderOutlined />}
                draggable
                aria-label={`拖动${engine.name || '搜索引擎'}`}
                title="拖动排序"
                onDragStart={() => {
                  setDraggingKey(engine.key)
                  setOverKey(engine.key)
                }}
                onDragEnd={clearDrag}
              />
              <Checkbox checked={engine.enabled} onChange={(event) => update(engine.key, { enabled: event.target.checked })}>
              </Checkbox>
              <Input
                value={engine.name}
                className="dash-search-engine-name"
                aria-label="搜索引擎名称"
                placeholder="名称"
                onChange={(event) => update(engine.key, { name: event.target.value })}
              />
              <Input
                value={engine.urlTemplate}
                style={{ flex: 1, minWidth: 0 }}
                aria-label={`${engine.name || '搜索引擎'}地址`}
                placeholder="https://example.com/search?q=%s"
                status={engine.urlTemplate.includes('%s') ? undefined : 'warning'}
                onChange={(event) => update(engine.key, { urlTemplate: event.target.value })}
              />
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                aria-label={`删除${engine.name || '搜索引擎'}`}
                title="删除搜索引擎"
                onClick={() => remove(engine.key)}
              />
            </Flex>
            {!engine.urlTemplate.includes('%s') ? (
              <Typography.Text type="warning" className="dash-settings-hint">
                地址中需要包含 "%s"，否则不会带上搜索内容。
              </Typography.Text>
            ) : null}
          </Flex>
        ))}
      </Flex>

      <Flex gap={8} wrap="wrap">
        <Button icon={<PlusOutlined />} onClick={add}>添加搜索引擎</Button>
        <Popconfirm
          title="恢复默认搜索引擎设置？"
          description="将搜索引擎列表和启用状态恢复到默认配置。"
          okText="恢复"
          cancelText="取消"
          onConfirm={reset}
        >
          <Button icon={<UndoOutlined />}>恢复默认</Button>
        </Popconfirm>
      </Flex>
    </Flex>
  )
}