import './App.css'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { Node, Edge, Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import TableNode, { type TableNodeData } from './components/TableNode'
import type { DiagramListItem, Field } from './types'
import RelationEdge, { type RelationType } from './components/RelationEdge'
import Sidebar from './components/Sidebar'
import EnumModal from './components/EnumModal'
import { useCallback, useMemo, useRef, useEffect, useState, type ComponentProps } from 'react'
import { NodesContext } from './context/NodesContext'
import AuthControl from './components/AuthControl'
import { fetchCurrentUser, type AuthUser } from './services/auth-api'
import {
  createCloudDiagram,
  DiagramApiError,
  deleteCloudDiagram,
  fetchDiagrams,
  hasSkippedLocalImport,
  markLocalDiagramsImported,
  markLocalImportSkipped,
  readImportedLocalDiagramIds,
  readDiagramCache,
  readLocalImportCandidates,
  saveDiagramCache,
  updateCloudDiagram,
  type DiagramData,
  type VersionedDiagram,
} from './services/diagram-api'

type Theme = 'light' | 'dark'
const THEME_STORAGE_KEY = 'erd-to-prisma:theme'
type EnumDefinition = { name: string; values: string[] }
type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser }
  | { status: 'error'; message: string }
type SaveState =
  | { status: 'saved' | 'saving' | 'offline' | 'guest' }
  | { status: 'error'; message: string; retry?: () => void }

function createDiagram(name: string): DiagramData {
  return {
    id: crypto.randomUUID(),
    name,
    updatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    enums: [],
  }
}

function getNodeIdSeed(nodes: Node[]): number {
  return nodes.reduce((highestId, node) => {
    const nodeId = Number(node.id)
    return Number.isSafeInteger(nodeId) ? Math.max(highestId, nodeId) : highestId
  }, 3)
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const [authRetryCount, setAuthRetryCount] = useState(0)
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    } catch (error) {
      console.error('Unable to read the saved theme preference.', error)
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (error) {
      console.error('Unable to save the theme preference.', error)
    }
  }, [theme])

  useEffect(() => {
    let active = true
    void fetchCurrentUser()
      .then((user) => {
        if (active) setAuthState(user ? { status: 'signed-in', user } : { status: 'signed-out' })
      })
      .catch(() => {
        if (active) setAuthState({ status: 'error', message: 'Unable to reach the login service.' })
      })
    return () => {
      active = false
    }
  }, [authRetryCount])

  const onSignedOut = () => setAuthState({ status: 'signed-out' })
  const onAuthRetry = () => {
    setAuthState({ status: 'loading' })
    setAuthRetryCount((count) => count + 1)
  }
  const authControl = (
    <AuthControl
      status={authState.status}
      user={authState.status === 'signed-in' ? authState.user : null}
      error={authState.status === 'error' ? authState.message : undefined}
      onRetry={onAuthRetry}
      onSignedOut={onSignedOut}
    />
  )

  if (authState.status === 'loading' || authState.status === 'error') {
    return (
      <div className="app-container">
        <aside className="sidebar">{authControl}</aside>
        <main className="workspace-state">
          {authState.status === 'loading' ? 'Checking your account…' : 'Account connection failed.'}
        </main>
      </div>
    )
  }

  return (
    <div className="app-container">
      <ReactFlowProvider>
        {authState.status === 'signed-in' ? (
          <AuthenticatedWorkspace
            key={authState.user.id}
            user={authState.user}
            theme={theme}
            onToggleTheme={() => setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light')}
            authControl={authControl}
          />
        ) : (
          <FlowCanvasWrapper
            theme={theme}
            onToggleTheme={() => setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light')}
            user={null}
            authControl={authControl}
          />
        )}
      </ReactFlowProvider>
    </div>
  )
}

type WorkspaceProps = {
  theme: Theme
  onToggleTheme: () => void
  user: AuthUser | null
  authControl: React.ReactNode
}

function AuthenticatedWorkspace({
  user,
  theme,
  onToggleTheme,
  authControl,
}: WorkspaceProps & { user: AuthUser }) {
  const [retryCount, setRetryCount] = useState(0)
  const [loadedWorkspace, setLoadedWorkspace] = useState<{
    diagrams: VersionedDiagram[]
    activeDiagramId: string
    offline: boolean
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importCandidates, setImportCandidates] = useState<DiagramData[]>([])
  const defaultDiagramRef = useRef<DiagramData>(createDiagram('Diagram 1'))

  useEffect(() => {
    let active = true
    setLoadedWorkspace(null)
    setLoadError(null)
    void (async () => {
      try {
        let diagrams = await fetchDiagrams()
        if (diagrams.length === 0) {
          try {
            diagrams = [await createCloudDiagram(defaultDiagramRef.current)]
          } catch (error) {
            if (!(error instanceof DiagramApiError) || error.status !== 409) throw error
            diagrams = await fetchDiagrams()
            if (diagrams.length === 0) throw error
          }
        }
        if (!active) return

        const cached = readDiagramCache(user.id)
        const activeDiagramId = cached?.diagrams.some(({ diagram }) => (
          diagram.id === cached.activeDiagramId && diagrams.some((item) => item.diagram.id === diagram.id)
        )) ? cached.activeDiagramId : diagrams[0].diagram.id
        saveDiagramCache(user.id, { diagrams, activeDiagramId })
        if (!hasSkippedLocalImport(user.id)) {
          const cloudIds = new Set(diagrams.map(({ diagram }) => diagram.id))
          const importedIds = readImportedLocalDiagramIds(user.id)
          setImportCandidates(readLocalImportCandidates().filter(({ id }) => (
            !cloudIds.has(id) && !importedIds.has(id)
          )))
        }
        setLoadedWorkspace({ diagrams, activeDiagramId, offline: false })
      } catch (error) {
        if (!active) return
        const cached = readDiagramCache(user.id)
        if (cached?.diagrams.length) {
          setLoadedWorkspace({
            diagrams: cached.diagrams,
            activeDiagramId: cached.activeDiagramId,
            offline: true,
          })
        } else {
          setLoadError(error instanceof Error ? error.message : 'Unable to load your diagrams.')
        }
      }
    })()
    return () => {
      active = false
    }
  }, [retryCount, user.id])

  if (!loadedWorkspace) {
    return (
      <>
        <Sidebar
          theme={theme}
          onToggleTheme={onToggleTheme}
          diagrams={[]}
          activeDiagramId=""
          onSelectDiagram={() => {}}
          onCreateDiagram={() => {}}
          onRenameDiagram={() => {}}
          onDeleteDiagram={() => {}}
          authControl={authControl}
          saveState={loadError ? { status: 'error', message: loadError } : { status: 'saving' }}
          onRetrySave={() => setRetryCount((count) => count + 1)}
          importCandidates={[]}
          onImportLocalDiagrams={async () => {}}
          onSkipLocalImport={() => {}}
        />
        <main className="workspace-state" role={loadError ? 'alert' : 'status'}>
          {loadError ? (
            <>
              <p>{loadError}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                Retry loading diagrams
              </button>
            </>
          ) : 'Loading your saved diagrams…'}
        </main>
      </>
    )
  }

  return (
    <FlowCanvasWrapper
      key={user.id}
      theme={theme}
      onToggleTheme={onToggleTheme}
      user={user}
      authControl={authControl}
      initialRecords={loadedWorkspace.diagrams}
      initialActiveDiagramId={loadedWorkspace.activeDiagramId}
      initiallyOffline={loadedWorkspace.offline}
      importCandidates={importCandidates}
      onImportCandidatesChange={setImportCandidates}
      onSkipLocalImport={() => {
        markLocalImportSkipped(user.id)
        setImportCandidates([])
      }}
    />
  )
}

function FlowCanvasWrapper({
  theme,
  onToggleTheme,
  user,
  authControl,
  initialRecords,
  initialActiveDiagramId,
  initiallyOffline = false,
  importCandidates: initialImportCandidates = [],
  onImportCandidatesChange,
  onSkipLocalImport,
}: WorkspaceProps & {
  initialRecords?: VersionedDiagram[]
  initialActiveDiagramId?: string
  initiallyOffline?: boolean
  importCandidates?: DiagramData[]
  onImportCandidatesChange?: (diagrams: DiagramData[]) => void
  onSkipLocalImport?: () => void
}) {
  const [initialDiagrams] = useState<DiagramData[]>(() => (
    initialRecords?.map(({ diagram }) => diagram) ?? [createDiagram('Diagram 1')]
  ))
  const initialSelection = initialDiagrams.some(({ id }) => id === initialActiveDiagramId)
    ? initialActiveDiagramId!
    : initialDiagrams[0].id
  const [diagramList, setDiagramList] = useState<DiagramListItem[]>(
    initialDiagrams.map(({ id, name }) => ({ id, name }))
  )
  const [activeDiagramId, setActiveDiagramId] = useState(initialSelection)
  const activeDiagramIdRef = useRef(initialSelection)
  activeDiagramIdRef.current = activeDiagramId
  const initialDiagram = initialDiagrams.find((diagram) => diagram.id === initialSelection)!
  const diagramsRef = useRef(initialDiagrams)
  const versionsRef = useRef(new Map(initialRecords?.map(({ diagram, version }) => [diagram.id, version]) ?? []))
  const confirmedRecordsRef = useRef(new Map(initialRecords?.map((record) => [record.diagram.id, record]) ?? []))

  const [nodes, setNodes, onNodesChange] = useNodesState(initialDiagram.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDiagram.edges)
  const [enums, setEnums] = useState<EnumDefinition[]>(initialDiagram.enums)
  const [enumEditor, setEnumEditor] = useState<{ open: boolean; nodeId?: string; fieldIndex?: number; prevType?: string }>(
    { open: false }
  )
  const [openDropdown, setOpenDropdown] = useState<{ nodeId: string; fieldIndex: number } | undefined>(undefined)
  const { screenToFlowPosition } = useReactFlow()
  const idRef = useRef(getNodeIdSeed(initialDiagram.nodes))
  const skipNextDiagramSave = useRef(true)
  const saveTimersRef = useRef(new Map<string, number>())
  const writeQueuesRef = useRef(new Map<string, Promise<void>>())
  const [saveState, setSaveState] = useState<SaveState>(
    initiallyOffline ? { status: 'offline' } : user ? { status: 'saved' } : { status: 'guest' }
  )
  const [importCandidates, setImportCandidates] = useState(initialImportCandidates)

  const cacheCurrentDiagrams = useCallback((activeId = activeDiagramIdRef.current) => {
    if (!user) return
    saveDiagramCache(user.id, {
      diagrams: [...confirmedRecordsRef.current.values()],
      activeDiagramId: activeId,
    })
  }, [user])

  const syncDiagram = useCallback((id: string): Promise<void> => {
    if (!user) {
      setSaveState({ status: 'error', message: 'Sign in again before saving this diagram.' })
      return Promise.resolve()
    }
    const previousWrite = writeQueuesRef.current.get(id) ?? Promise.resolve()
    const nextWrite = previousWrite.catch(() => {}).then(async () => {
      const diagram = diagramsRef.current.find((item) => item.id === id)
      const version = versionsRef.current.get(id) ?? confirmedRecordsRef.current.get(id)?.version
      if (!diagram) {
        setSaveState({ status: 'error', message: 'Diagram is no longer available to save.' })
        return
      }
      if (version === undefined) {
        setSaveState({ status: 'error', message: 'Diagram version is unavailable. Reload to fetch the latest copy.' })
        return
      }

      setSaveState({ status: 'saving' })
      try {
        const saved = await updateCloudDiagram(diagram, version)
        versionsRef.current.set(id, saved.version)
        confirmedRecordsRef.current.set(id, saved)
        diagramsRef.current = diagramsRef.current.map((item) => (
          item.id === id ? { ...item, updatedAt: saved.diagram.updatedAt } : item
        ))
        cacheCurrentDiagrams()
        setSaveState({ status: 'saved' })
      } catch (error) {
        setSaveState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to save diagram changes.',
          retry: () => { void syncDiagram(id) },
        })
      }
    })
    writeQueuesRef.current.set(id, nextWrite)
    return nextWrite
  }, [cacheCurrentDiagrams, user])

  useEffect(() => {
    let shouldSync = false
    let diagrams = diagramsRef.current
    if (skipNextDiagramSave.current) {
      skipNextDiagramSave.current = false
    } else {
      shouldSync = true
      diagrams = diagrams.map((diagram) => (
        diagram.id === activeDiagramId
          ? { ...diagram, nodes, edges, enums, updatedAt: new Date().toISOString() }
          : diagram
      ))
      diagramsRef.current = diagrams
    }

    if (user && shouldSync) {
      const previousTimer = saveTimersRef.current.get(activeDiagramId)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      const timer = window.setTimeout(() => {
        saveTimersRef.current.delete(activeDiagramId)
        void syncDiagram(activeDiagramId)
      }, 650)
      saveTimersRef.current.set(activeDiagramId, timer)
      setSaveState({ status: 'saving' })
    }
  }, [activeDiagramId, nodes, edges, enums, syncDiagram, user])

  const handleSelectDiagram = (id: string) => {
    const diagram = diagramsRef.current.find((item) => item.id === id)
    if (!diagram || diagram.id === activeDiagramId) return

    skipNextDiagramSave.current = true
    idRef.current = getNodeIdSeed(diagram.nodes)
    setActiveDiagramId(diagram.id)
    setNodes(diagram.nodes)
    setEdges(diagram.edges)
    setEnums(diagram.enums)
    cacheCurrentDiagrams(diagram.id)
  }

  const handleCreateDiagram = async () => {
    let diagram = createDiagram(`Diagram ${diagramsRef.current.length + 1}`)
    if (user) {
      setSaveState({ status: 'saving' })
      try {
        const created = await createCloudDiagram(diagram)
        diagram = created.diagram
        versionsRef.current.set(diagram.id, created.version)
        confirmedRecordsRef.current.set(diagram.id, created)
        setSaveState({ status: 'saved' })
      } catch (error) {
        setSaveState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to create diagram.',
          retry: () => { void handleCreateDiagram() },
        })
        return
      }
    }
    diagramsRef.current = [...diagramsRef.current, diagram]
    setDiagramList((currentDiagrams) => [...currentDiagrams, { id: diagram.id, name: diagram.name }])
    idRef.current = getNodeIdSeed(diagram.nodes)
    skipNextDiagramSave.current = true
    setActiveDiagramId(diagram.id)
    setNodes(diagram.nodes)
    setEdges(diagram.edges)
    setEnums(diagram.enums)
    cacheCurrentDiagrams(diagram.id)
  }

  const handleRenameDiagram = (id: string, name: string) => {
    const normalizedName = name.trim()
    if (!normalizedName) return

    const diagrams = diagramsRef.current.map((diagram) => (
      diagram.id === id
        ? { ...diagram, name: normalizedName, updatedAt: new Date().toISOString() }
        : diagram
    ))
    if (diagrams.every((diagram, index) => diagram === diagramsRef.current[index])) return

    diagramsRef.current = diagrams
    setDiagramList((currentDiagrams) => currentDiagrams.map((diagram) => (
      diagram.id === id ? { ...diagram, name: normalizedName } : diagram
    )))
    if (user) {
      setSaveState({ status: 'saving' })
      const previousTimer = saveTimersRef.current.get(id)
      if (previousTimer !== undefined) {
        window.clearTimeout(previousTimer)
        saveTimersRef.current.delete(id)
      }
      void syncDiagram(id)
    }
  }

  const handleDeleteDiagram = async (id: string) => {
    const diagram = diagramsRef.current.find((item) => item.id === id)
    if (!diagram) return

    if (user) {
      const pendingTimer = saveTimersRef.current.get(id)
      if (pendingTimer !== undefined) {
        window.clearTimeout(pendingTimer)
        saveTimersRef.current.delete(id)
      }
      await writeQueuesRef.current.get(id)
      const version = versionsRef.current.get(id)
      if (version === undefined) {
        setSaveState({
          status: 'error',
          message: 'Diagram version is unavailable. Reload to fetch the latest copy.',
          retry: () => window.location.reload(),
        })
        return
      }
      setSaveState({ status: 'saving' })
      try {
        await deleteCloudDiagram(id, version)
        versionsRef.current.delete(id)
        confirmedRecordsRef.current.delete(id)
      } catch (error) {
        setSaveState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to delete diagram.',
          retry: () => { void handleDeleteDiagram(id) },
        })
        return
      }

    }

    let diagrams = diagramsRef.current.filter((item) => item.id !== id)
    let nextActiveDiagramId = activeDiagramId
    if (id === activeDiagramId) {
      if (diagrams.length === 0) {
        let replacement = createDiagram('Diagram 1')
        if (user) {
          try {
            const created = await createCloudDiagram(replacement)
            replacement = created.diagram
            versionsRef.current.set(replacement.id, created.version)
            confirmedRecordsRef.current.set(replacement.id, created)
          } catch (error) {
            setSaveState({
              status: 'error',
              message: error instanceof Error ? error.message : 'Unable to create a replacement diagram.',
              retry: () => { void handleCreateDiagram() },
            })
            diagramsRef.current = []
            setDiagramList([])
            setNodes([])
            setEdges([])
            setEnums([])
            cacheCurrentDiagrams()
            return
          }
        }
        diagrams = [replacement]
        nextActiveDiagramId = replacement.id
      } else {
        nextActiveDiagramId = diagrams[0].id
      }
    }

    diagramsRef.current = diagrams
    setDiagramList(diagrams.map(({ id: diagramId, name }) => ({ id: diagramId, name })))

    if (id === activeDiagramId) {
      const nextDiagram = diagrams.find((item) => item.id === nextActiveDiagramId)!
      skipNextDiagramSave.current = true
      idRef.current = getNodeIdSeed(nextDiagram.nodes)
      setActiveDiagramId(nextActiveDiagramId)
      setNodes(nextDiagram.nodes)
      setEdges(nextDiagram.edges)
      setEnums(nextDiagram.enums)
    }

    cacheCurrentDiagrams(nextActiveDiagramId)
    if (user) setSaveState({ status: 'saved' })
  }

  const handleImportLocalDiagrams = async (selectedDiagrams: DiagramData[]) => {
    if (!user) return
    setSaveState({ status: 'saving' })
    try {
      for (const candidate of selectedDiagrams) {
        const hasValidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id)
        const idAlreadyUsed = diagramsRef.current.some(({ id }) => id === candidate.id)
        let candidateToImport = { ...candidate, id: hasValidId && !idAlreadyUsed ? candidate.id : crypto.randomUUID() }
        let imported: VersionedDiagram
        try {
          imported = await createCloudDiagram(candidateToImport)
        } catch (error) {
          if (!(error instanceof DiagramApiError) || error.status !== 409) throw error
          candidateToImport = { ...candidateToImport, id: crypto.randomUUID() }
          imported = await createCloudDiagram(candidateToImport)
        }
        versionsRef.current.set(imported.diagram.id, imported.version)
        confirmedRecordsRef.current.set(imported.diagram.id, imported)
        markLocalDiagramsImported(user.id, [candidate.id])
        diagramsRef.current = [...diagramsRef.current, imported.diagram]
        setDiagramList((current) => [...current, {
          id: imported.diagram.id,
          name: imported.diagram.name,
        }])
        setImportCandidates((current) => current.filter((diagram) => diagram !== candidate))
        cacheCurrentDiagrams()
      }
      setSaveState({ status: 'saved' })
      onImportCandidatesChange?.(importCandidates.filter((candidate) => !selectedDiagrams.includes(candidate)))
    } catch (error) {
      setSaveState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to import local diagrams.',
        retry: () => { void handleImportLocalDiagrams(selectedDiagrams) },
      })
      throw error
    }
  }
  
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

  const addEnum = (e: { name: string; values: string[] }) => {
    setEnums((prev) => {
      const others = prev.filter((x) => x.name !== e.name)
      return [...others, e]
    })
  }

  const removeEnum = (name: string) => {
    setEnums((prev) => prev.filter((x) => x.name !== name))
    // revert any fields that used this enum back to String
    setNodes((nds) =>
      nds.map((n) => {
        const d = n.data as unknown as TableNodeData
        if (!d || !d.fields) return n
        const newFields = (d.fields || []).map((f) => (f.type === name ? { ...f, type: 'String' } : f))
        return { ...n, data: { ...d, fields: newFields } }
      })
    )
  }

  const openEnumEditor = (nodeId: string, fieldIndex: number, prevType?: string) => {
    setEnumEditor({ open: true, nodeId, fieldIndex, prevType })
  }

  const closeEnumEditor = () => setEnumEditor({ open: false })

  // schedule the dropdown open on the next tick so the click event
  // finishes propagation before the global open state changes. This
  // avoids a race where the opening click is interpreted as an outside
  // click and immediately closes the dropdown.
  const openFieldDropdown = (nodeId: string, fieldIndex: number) => {
    // include an `openedAt` timestamp so dropdown components can detect
    // a recent open even if they remount during the state change.
    const payload = { nodeId, fieldIndex, openedAt: Date.now() }
    setTimeout(() => setOpenDropdown(payload), 0)
  }
  const closeFieldDropdown = () => setOpenDropdown(undefined)

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...(node.data as unknown as TableNodeData),
        openEnumModal: (index: number, prevType?: string) => openEnumEditor(node.id, index, prevType),
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
        updateField: (index: number, key: keyof Field, value: Field[keyof Field]) => {
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

  // Render EnumModal globally so it is not constrained by React Flow node layering

  const nodeTypes = useMemo(() => ({ tableNode: TableNode }), [])
  const edgeTypes = useMemo(() => ({ relation: RelationEdge }), [])

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
      } catch {
        // ignore invalid payloads
      }
    },
    [screenToFlowPosition, setNodes]
  )

  return (
    <NodesContext.Provider value={{ nodes: nodesWithCallbacks, edges, enums, addEnum, removeEnum, enumEditor, openEnumEditor, closeEnumEditor, openDropdown, openFieldDropdown, closeFieldDropdown }}>
      <AppContent 
        theme={theme}
        onToggleTheme={onToggleTheme}
        authControl={authControl}
        diagrams={diagramList}
        activeDiagramId={activeDiagramId}
        onSelectDiagram={handleSelectDiagram}
        onCreateDiagram={handleCreateDiagram}
        onRenameDiagram={handleRenameDiagram}
        onDeleteDiagram={handleDeleteDiagram}
        importCandidates={importCandidates}
        onImportLocalDiagrams={handleImportLocalDiagrams}
        onSkipLocalImport={() => {
          onSkipLocalImport?.()
          setImportCandidates([])
        }}
        saveState={saveState}
        onRetrySave={() => {
          if (user) void syncDiagram(activeDiagramId)
        }}
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

      <EnumModal
        open={!!enumEditor.open}
        initialName={enumEditor.prevType && enums.find((e) => e.name === enumEditor.prevType) ? enumEditor.prevType : ''}
        initialValues={enumEditor.prevType ? (enums.find((e) => e.name === enumEditor.prevType)?.values ?? []) : []}
        onCancel={() => {
          // simply close editor; we did not mutate node field yet
          closeEnumEditor()
        }}
        onDone={({ name, values }) => {
          // register enum globally and set the node's field type
          addEnum({ name, values })
          if (enumEditor.nodeId !== undefined && typeof enumEditor.fieldIndex === 'number') {
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === enumEditor.nodeId) {
                  const d = n.data as unknown as TableNodeData
                  const newFields = [...(d.fields || [])]
                  newFields[enumEditor.fieldIndex!] = { ...newFields[enumEditor.fieldIndex!], type: name }
                  return { ...n, data: { ...d, fields: newFields } }
                }
                return n
              })
            )
          }
          closeEnumEditor()
        }}
      />
    </NodesContext.Provider>
  )
}

type AppContentProps = {
  theme: Theme
  onToggleTheme: () => void
  authControl: React.ReactNode
  diagrams: DiagramListItem[]
  activeDiagramId: string
  onSelectDiagram: (id: string) => void
  onCreateDiagram: () => void
  onRenameDiagram: (id: string, name: string) => void
  onDeleteDiagram: (id: string) => void
  importCandidates: DiagramData[]
  onImportLocalDiagrams: (diagrams: DiagramData[]) => Promise<void>
  onSkipLocalImport: () => void
  saveState: SaveState
  onRetrySave: () => void
  nodes: Node[]
  edges: Edge[]
} & Pick<ComponentProps<typeof ReactFlow>,
  'onNodesChange' | 'onEdgesChange' | 'onConnect' | 'onReconnect'
  | 'nodeTypes' | 'edgeTypes' | 'onDrop' | 'onDragOver'
>

function AppContent({ 
  theme,
  onToggleTheme,
  authControl,
  diagrams,
  activeDiagramId,
  onSelectDiagram,
  onCreateDiagram,
  onRenameDiagram,
  onDeleteDiagram,
  importCandidates,
  onImportLocalDiagrams,
  onSkipLocalImport,
  saveState,
  onRetrySave,
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
}: AppContentProps) {
  return (
    <>
      <Sidebar
        theme={theme}
        onToggleTheme={onToggleTheme}
        authControl={authControl}
        diagrams={diagrams}
        activeDiagramId={activeDiagramId}
        onSelectDiagram={onSelectDiagram}
        onCreateDiagram={onCreateDiagram}
        onRenameDiagram={onRenameDiagram}
        onDeleteDiagram={onDeleteDiagram}
        importCandidates={importCandidates}
        onImportLocalDiagrams={onImportLocalDiagrams}
        onSkipLocalImport={onSkipLocalImport}
        saveState={saveState}
        onRetrySave={onRetrySave}
      />
      <div className="canvas">
        {nodes.length === 0 && (
          <div className="canvas-empty-state">
            <strong>Drag an Entity here to get started.</strong>
            <span>Add fields and connect entities, then select Prisma to generate your schema.</span>
          </div>
        )}
        <ReactFlow
          colorMode={theme}
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
        </ReactFlow>
      </div>
    </>
  )
}
