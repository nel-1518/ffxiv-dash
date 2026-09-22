import { isRecord } from '../guards.ts'

const STORAGE_KEY = 'ffxiv-dash:search-engines:v1'

export type SearchEngineConfig = {
  key: string
  name: string
  urlTemplate: string
  enabled: boolean
}

export const DEFAULT_SEARCH_ENGINES: readonly SearchEngineConfig[] = [
  {
    key: 'baidu',
    name: '百度',
    urlTemplate: 'https://www.baidu.com/s?ie=utf-8&wd=%s',
    enabled: true,
  },
  {
    key: 'bing',
    name: '必应',
    urlTemplate: 'https://www.bing.com/search?q=%s',
    enabled: false,
  },
  {
    key: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com/search?q=%s',
    enabled: false,
  },
  {
    key: 'risingstones',
    name: '石之家',
    urlTemplate: 'https://ff14risingstones.web.sdo.com/pc/index.html#/search?keywords=%s',
    enabled: true,
  },
  {
    key: 'wiki',
    name: 'FF14 WIKI',
    urlTemplate: 'https://ff14.huijiwiki.com/index.php?tittle=特殊:搜索&profile=default&search=%s',
    enabled: true,
  },
  {
    key: 'wiki-item',
    name: '物品检索器',
    urlTemplate: 'https://ff14.huijiwiki.com/wiki/ItemSearch?name=%s',
    enabled: false,
  },
]

let state: SearchEngineConfig[] = [...DEFAULT_SEARCH_ENGINES]
let loaded = false
const listeners = new Set<() => void>()

function normalize(raw: unknown): SearchEngineConfig[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_SEARCH_ENGINES]
  }

  const engines = raw.flatMap((item, index) => {
    if (!isRecord(item)) {
      return []
    }
    const name = typeof item.name === 'string' ? item.name : ''
    const urlTemplate = typeof item.urlTemplate === 'string' ? item.urlTemplate.trim() : ''
    if (name.trim() === '' || urlTemplate === '') {
      return []
    }
    return [{
      key: typeof item.key === 'string' && item.key !== '' ? item.key : `engine-${index + 1}`,
      name,
      urlTemplate,
      enabled: item.enabled !== false,
    }]
  })

  return engines
}

function load(): SearchEngineConfig[] {
  if (loaded) {
    return state
  }
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    state = normalize(raw === null ? null : JSON.parse(raw))
  } catch (error) {
    console.warn('[ffxiv-dash] 无法读取搜索引擎设置，使用默认值', error)
    state = [...DEFAULT_SEARCH_ENGINES]
  }
  return state
}

export function getSearchEngines(): readonly SearchEngineConfig[] {
  return load()
}

export function subscribeSearchEngines(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function save(next: SearchEngineConfig[]): void {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    console.warn('[ffxiv-dash] 无法保存搜索引擎设置', error)
  }
  for (const listener of listeners) {
    listener()
  }
}

export function setSearchEngines(engines: SearchEngineConfig[]): void {
  const next = engines.map((engine) => ({
    ...engine,
    name: engine.name,
    urlTemplate: engine.urlTemplate.trim(),
  }))
  save(next)
}