import { createContext } from 'react'
import type { Node, Edge } from '@xyflow/react'

export type NodesContextValue = { nodes: Node[]; edges: Edge[] } | null

export const NodesContext = createContext<NodesContextValue>(null)

export default NodesContext
