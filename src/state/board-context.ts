import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { BoardDoc } from '../core/storage/types.ts'
import type { BoardAction } from './board-types.ts'

export type BoardContextValue = {
  doc: BoardDoc
  dispatch: Dispatch<BoardAction>
}

/** 只导出 context 常量，保证本文件不导出组件以满足 React Fast Refresh 约束。 */
export const BoardContext = createContext<BoardContextValue | null>(null)
