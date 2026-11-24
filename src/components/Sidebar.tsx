import './styles/main.css'
import type { TableNodeData } from './TableNode'
import type { Field } from '../types';
import dragIcon from '../assets/drag.svg';
import buildIcon from '../assets/build.svg';
import trashIcon from '../assets/trash-can.svg';
import type { Node, Edge } from '@xyflow/react'
import { useContext, useState } from 'react'
import { NodesContext } from '../context/NodesContext'
import { generatePrismaSchema } from '../utils/generatePrisma'
import PrismaModal from './PrismaModal'
import type { DiagramListItem } from '../types'
import type { DiagramData } from '../services/diagram-api'
import type { ReactNode } from 'react'

type SaveState =
  | { status: 'saved' | 'saving' | 'offline' | 'guest' }
  | { status: 'error'; message: string; retry?: () => void }

function getInitialTableData(): TableNodeData {
  const fields: Field[] = [
    { name: 'UniqueID', type: 'Int_autoinc', pk: true, fk: false, nullable: false, unique: true },
    { name: 'Row 1', type: 'String', pk: false, fk: false, nullable: true, unique: false },
    { name: 'Row 2', type: 'String', pk: false, fk: false, nullable: true, unique: false },
    { name: 'Row 3', type: 'String', pk: false, fk: false, nullable: true, unique: false },
  ]

  // Placeholder callbacks; real ones are injected after drop by canvas
  return {
    name: 'Table',
    expanded: true,
    mode: 'preview',
    fields,
    onToggle: () => {},
    updateField: () => {},
    addRow: () => {},
    deleteRow: () => {},
    updateTableName: () => {},
    toggleMode: () => {},
  }
}

type SidebarProps = {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  diagrams: DiagramListItem[]
  activeDiagramId: string
  onSelectDiagram: (id: string) => void
  onCreateDiagram: () => void
  onRenameDiagram: (id: string, name: string) => void
  onDeleteDiagram: (id: string) => void
  authControl: ReactNode
  saveState: SaveState
  onRetrySave: () => void
  importCandidates: DiagramData[]
  onImportLocalDiagrams: (diagrams: DiagramData[]) => Promise<void>
  onSkipLocalImport: () => void
}

export default function Sidebar({
  theme,
  onToggleTheme,
  diagrams,
  activeDiagramId,
  onSelectDiagram,
  onCreateDiagram,
  onRenameDiagram,
  onDeleteDiagram,
  authControl,
  saveState,
  onRetrySave,
  importCandidates,
  onImportLocalDiagrams,
  onSkipLocalImport,
}: SidebarProps) {
  const nodesContext = useContext(NodesContext)
  const [schema, setSchema] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [editingDiagramId, setEditingDiagramId] = useState<string | null>(null)
  const [diagramNameDraft, setDiagramNameDraft] = useState('')
  const [diagramPendingDelete, setDiagramPendingDelete] = useState<DiagramListItem | null>(null)
  const [selectedImportIndices, setSelectedImportIndices] = useState<Set<number>>(
    () => new Set(importCandidates.map((_, index) => index))
  )
  const [importError, setImportError] = useState<string | null>(null)

  const startRenamingDiagram = (diagram: DiagramListItem) => {
    setEditingDiagramId(diagram.id)
    setDiagramNameDraft(diagram.name)
  }

  const finishRenamingDiagram = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = diagramNameDraft.trim()
    if (!editingDiagramId || !name) return

    onRenameDiagram(editingDiagramId, name)
    setEditingDiagramId(null)
  }

  const handleBuildPrisma = () => {
    if (nodesContext && nodesContext.nodes && nodesContext.edges) {
      const schema = generatePrismaSchema(
        nodesContext.nodes as Node[],
        nodesContext.edges as Edge[],
        nodesContext.enums || []
      )
      setSchema(schema)
      setOpen(true)
    } else {
      console.log('No data available yet')
    }

  }

  const importSelectedDiagrams = async () => {
    const selected = importCandidates.filter((_, index) => selectedImportIndices.has(index))
    if (selected.length === 0) return
    setImportError(null)
    try {
      await onImportLocalDiagrams(selected)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import local diagrams.')
    }
  }

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    const payload = {
      type: 'tableNode',
      data: getInitialTableData(),
    }

    event.dataTransfer.setData('application/reactflow', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="sidebar">
      {authControl}

      <div className="dnd-item" draggable onDragStart={onDragStart}>
        <img src={dragIcon} alt="Add table" style={{ width: '16px', height: '16px' }} />
        <span className="dnd-table-header">Entity</span>
      </div>

      <button className="build-button" onClick={handleBuildPrisma}>
        <img src={buildIcon} alt="Build Prisma" style={{ width: '16px', height: '16px' }} />
        <span className="dnd-table-header">Prisma</span>
      </button>

      <div className="sidebar-diagrams">
        <div className="sidebar-diagrams-header">
          <strong>Diagrams</strong>
          <button className="add-diagram-button" type="button" onClick={onCreateDiagram}>
            <span aria-hidden="true">+</span>
            Add new
          </button>
        </div>
        <p className={`diagram-save-status${saveState.status === 'error' ? ' error' : ''}`} role="status">
          {saveState.status === 'error' ? saveState.message
            : saveState.status === 'guest' ? 'Sign in to save diagrams'
            : saveState.status === 'saved' ? 'All changes saved'
            : saveState.status === 'saving' ? 'Saving changes…'
              : saveState.status === 'offline' ? 'Offline cache in use'
                : 'Saving changes…'}
          {saveState.status === 'error' && (
            <button type="button" onClick={saveState.retry ?? onRetrySave}>Retry save</button>
          )}
        </p>
        <nav className="diagram-list" aria-label="Saved ERD diagrams">
          {diagrams.map((diagram) => (
            <div
              key={diagram.id}
              className={`diagram-list-entry${diagram.id === activeDiagramId ? ' active' : ''}`}
            >
              {editingDiagramId === diagram.id ? (
                <form className="diagram-rename-form" onSubmit={finishRenamingDiagram}>
                  <input
                    autoFocus
                    aria-label="Diagram name"
                    maxLength={100}
                    value={diagramNameDraft}
                    onChange={(event) => setDiagramNameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setEditingDiagramId(null)
                    }}
                  />
                  <button type="submit" disabled={!diagramNameDraft.trim()} aria-label="Save diagram name">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingDiagramId(null)} aria-label="Cancel renaming">
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    className="diagram-list-item"
                    type="button"
                    aria-current={diagram.id === activeDiagramId ? 'page' : undefined}
                    onClick={() => onSelectDiagram(diagram.id)}
                    title={diagram.name}
                  >
                    {diagram.name}
                  </button>
                  <div className="diagram-list-actions">
                    <button
                      className="diagram-action-button"
                      type="button"
                      aria-label={`Rename ${diagram.name}`}
                      title={`Rename ${diagram.name}`}
                      onClick={() => startRenamingDiagram(diagram)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      className="diagram-action-button diagram-delete-button"
                      type="button"
                      aria-label={`Delete ${diagram.name}`}
                      title={`Delete ${diagram.name}`}
                      onClick={() => setDiagramPendingDelete(diagram)}
                    >
                      <img src={trashIcon} alt="" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>
        {importCandidates.length > 0 && (
          <section className="local-import-prompt" aria-label="Import local diagrams">
            <strong>Local diagrams found</strong>
            <p>Import selected diagrams as cloud copies?</p>
            <div className="local-import-list">
              {importCandidates.map((diagram, index) => (
                <label key={`${diagram.id}-${index}`}>
                  <input
                    type="checkbox"
                    checked={selectedImportIndices.has(index)}
                    onChange={(event) => {
                      setSelectedImportIndices((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(index)
                        else next.delete(index)
                        return next
                      })
                    }}
                  />
                  <span>{diagram.name}</span>
                </label>
              ))}
            </div>
            {importError && <p className="account-error" role="alert">{importError}</p>}
            <button type="button" onClick={() => void importSelectedDiagrams()} disabled={selectedImportIndices.size === 0}>
              Import selected
            </button>
            <button type="button" onClick={onSkipLocalImport}>Skip import</button>
          </section>
        )}
      </div>

      <button
        className="theme-toggle"
        type="button"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24"        >
          {theme === 'light' ? (
            <path d="M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42M3 12h2m14 0h2M5.64 18.36l1.42-1.42m9.88-9.88 1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
          ) : (
            <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
          )}
        </svg>
        <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
      </button>
      {/* Enums list removed from sidebar per request */}
      <PrismaModal open={open} schema={schema} onClose={() => setOpen(false)} />
      {diagramPendingDelete && (
        <div
          className="delete-diagram-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-diagram-title"
          aria-describedby="delete-diagram-message"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDiagramPendingDelete(null)
          }}
        >
          <div className="delete-diagram-modal">
            <h2 id="delete-diagram-title">Delete diagram?</h2>
            <p id="delete-diagram-message">
              Are you sure you want to delete <strong>{diagramPendingDelete.name}</strong>? The action cannot be undone.
            </p>
            <div className="delete-diagram-actions">
              <button
                type="button"
                className="btn secondary"
                autoFocus
                onClick={() => setDiagramPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn delete-diagram-confirm"
                onClick={() => {
                  onDeleteDiagram(diagramPendingDelete.id)
                  setDiagramPendingDelete(null)
                }}
              >
                Delete diagram
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
