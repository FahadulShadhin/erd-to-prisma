import './styles/main.css'
import type { TableNodeData, Field } from './TableNode'
import dragIcon from '../assets/drag.svg';
import buildIcon from '../assets/build.svg';
import type { Node, Edge } from '@xyflow/react'
import { useContext, useState } from 'react'
import { NodesContext } from '../context/NodesContext'
import { generatePrismaSchema } from '../utils/generatePrisma'
import PrismaModal from './PrismaModal'

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

export default function Sidebar() {
  const nodesContext = useContext(NodesContext)
  const [schema, setSchema] = useState<string>('')
  const [open, setOpen] = useState(false)

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
      <div className="dnd-item" draggable onDragStart={onDragStart}>
        <img src={dragIcon} alt="Add table" style={{ width: '16px', height: '16px' }} />
        <span className="dnd-table-header">Entity</span>
      </div>

      <button className="build-button" onClick={handleBuildPrisma}>
        <img src={buildIcon} alt="Build Prisma" style={{ width: '16px', height: '16px' }} />
        <span className="dnd-table-header">Prisma</span>
      </button>
      {/* Enums list removed from sidebar per request */}
      <PrismaModal open={open} schema={schema} onClose={() => setOpen(false)} />
    </div>
  )
}
