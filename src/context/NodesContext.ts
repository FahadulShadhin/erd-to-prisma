import { createContext } from 'react'
import type { Node, Edge } from '@xyflow/react'

export type EnumDef = { name: string; values: string[] }

export type EnumEditorState = {
	open: boolean
	nodeId?: string
	fieldIndex?: number
	prevType?: string
}

export type NodesContextValue =
	| {
			nodes: Node[]
			edges: Edge[]
			enums: EnumDef[]
			addEnum: (e: EnumDef) => void
			removeEnum: (name: string) => void
			enumEditor: EnumEditorState
			openEnumEditor: (nodeId: string, fieldIndex: number, prevType?: string) => void
			closeEnumEditor: () => void
			// dropdown for type select (persisted globally so re-mount won't close it)
			// `openedAt` is a timestamp (ms) set when dropdown was opened so
			// consumers can detect recent opens even across remounts.
			openDropdown?: { nodeId: string; fieldIndex: number; openedAt?: number }
			openFieldDropdown: (nodeId: string, fieldIndex: number) => void
			closeFieldDropdown: () => void
		}
	| null

export const NodesContext = createContext<NodesContextValue>(null)

export default NodesContext
