import { useSyncExternalStore } from 'react'
import type { SearchEngineConfig } from './store.ts'
import { getSearchEngines, subscribeSearchEngines } from './store.ts'

export function useSearchEngines(): readonly SearchEngineConfig[] {
  return useSyncExternalStore(subscribeSearchEngines, getSearchEngines)
}