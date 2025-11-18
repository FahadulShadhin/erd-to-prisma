import './App.css'
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { Node, Edge, Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TableNode, { type TableNodeData, type Field } from './components/TableNode'
import RelationEdge, { type RelationType } from './components/RelationEdge'
import Sidebar from './components/Sidebar'
import { useCallback, useMemo, useRef, useEffect } from 'react'
import { NodesContext } from './context/NodesContext'

export { NodesContext }

export const useNodesData = () => {
  // Hook is no longer needed, Sidebar will receive context as prop
  throw new Error('useNodesData is deprecated, use nodesContext prop instead')
}

export default function App() {
  return (
    <div className="app-container">
      <ReactFlowProvider>
        <FlowCanvasWrapper />
      </ReactFlowProvider>
    </div>
  )
}

function FlowCanvasWrapper() {
  const persisted = useMemo(() => {
    try {
      const raw = localStorage.getItem('erd-to-prisma:flow')
      return raw ? JSON.parse(raw) : { nodes: [], edges: [] }
    } catch (e) {
      return { nodes: [], edges: [] }
    }
  }, [])

  const initialNodes: Node[] = persisted.nodes || []
  const initialEdges: Edge[] = persisted.edges || []

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const { screenToFlowPosition } = useReactFlow()
  const idRef = useRef(3)
  
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (newConnection.source === newConnection.target) {
        return;
      }
      
      setEdges((eds) => {
        const updatedEdges = eds.filter((e) => e.id !== oldEdge.id);
        const newEdge: Edge = {
          ...oldEdge,
          ...newConnection,
          source: newConnection.source!,
          target: newConnection.target!,
        };
        return [...updatedEdges, newEdge];
      });
    },
    [setEdges]
  )

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source === params.target) {
        return;
      }
      
      const edgeId = `${params.source}-${params.target}`
      const newEdge: Edge = {
        ...params,
        id: edgeId,
        type: 'relation',
        source: params.source!,
        target: params.target!,
        data: { 
          relationType: 'one-to-many' as RelationType,
          onTypeChange: (type: RelationType) => {
            setEdges((eds) =>
              eds.map((edge) =>
                edge.id === edgeId
                  ? { ...edge, data: { ...edge.data, relationType: type } }
                  : edge
              )
            )
          },
        },
      }
      setEdges((eds) => [...eds, newEdge])
    },
    [setEdges]
  )

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...(node.data as unknown as TableNodeData),
        onToggle: () => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? { ...n, data: { ...(n.data as unknown as TableNodeData), expanded: !(n.data as unknown as TableNodeData).expanded } }
                : n
            )
          )
        },
        toggleMode: () => {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                const d = n.data as unknown as TableNodeData
                const next = (d.mode ?? 'preview') === 'preview' ? 'edit' : 'preview'
                return { ...n, data: { ...d, mode: next } }
              }
              return n
            })
          )
        },
        updateField: (index: number, key: keyof Field, value: any) => {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                const tableData = n.data as unknown as TableNodeData
                const newFields = [...tableData.fields]
                newFields[index] = { ...newFields[index], [key]: value }
                return { ...n, data: { ...tableData, fields: newFields } }
              }
              return n
            })
          )
        },
        addRow: () => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    data: {
                      ...(n.data as unknown as TableNodeData),
                      fields: [
                        ...(n.data as unknown as TableNodeData).fields,
                        { name: '', type: 'String', pk: false, fk: false, nullable: false, unique: false },
                      ],
                    },
                  }
                : n
            )
          )
        },
        deleteRow: (index: number) => {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                const tableData = n.data as unknown as TableNodeData
                const newFields = tableData.fields.filter((_: Field, i: number) => i !== index)
                return { ...n, data: { ...tableData, fields: newFields } }
              }
              return n
            })
          )
        },
        updateTableName: (name: string) => {
          setNodes((nds) =>
            nds.map((n) => (n.id === node.id ? { ...n, data: { ...(n.data as unknown as TableNodeData), name } } : n))
          )
        },
        deleteTable: () => {
          setNodes((nds) => nds.filter((n) => n.id !== node.id))
          setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id))
        },
      },
    }))
  }, [nodes, setNodes, setEdges])

  useEffect(() => {
    try {
      localStorage.setItem('erd-to-prisma:flow', JSON.stringify({ nodes, edges }))
    } catch (e) {
      // ignore storage errors (e.g., quota exceeded)
    }
  }, [nodes, edges])

  const nodeTypes = useMemo(() => ({ tableNode: TableNode }), [])
  const edgeTypes = useMemo(() => ({ relation: RelationEdge }), []) as any

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/reactflow')
      if (!raw) return

      try {
        const payload = JSON.parse(raw) as { type: string; data: TableNodeData }
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        idRef.current += 1
        const newNode: Node = {
          id: String(idRef.current),
          type: payload.type,
          position,
          data: payload.data as unknown as Record<string, unknown>,
        }
        setNodes((nds) => nds.concat(newNode))
      } catch (e) {
        // ignore invalid payloads
      }
    },
    [screenToFlowPosition, setNodes]
  )

  return (
    <NodesContext.Provider value={{ nodes: nodesWithCallbacks, edges }}>
      <AppContent 
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
      />
    </NodesContext.Provider>
  )
}

function AppContent({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect, 
  onReconnect, 
  nodeTypes, 
  edgeTypes, 
  onDrop, 
  onDragOver 
}: any) {
  return (
    <>
      <Sidebar />
      <div className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          deleteKeyCode="Delete"
          edgesReconnectable={true}
          reconnectRadius={20}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </>
  )
}
