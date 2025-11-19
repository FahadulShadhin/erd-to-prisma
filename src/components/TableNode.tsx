// TableNode.tsx

import { Handle, Position } from "@xyflow/react";
import React, { useState, useContext, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom'
import './styles/main.css';
import trashIcon from '../assets/trash-can.svg';
import minusIcon from '../assets/minus-rounded.svg';
import plusRoundedIcon from '../assets/plus-rounded.svg';
import plusIcon from '../assets/plus.svg';
import crossIcon from '../assets/cross-rounded.svg';
import { NodesContext } from '../context/NodesContext'

export interface Field {
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface TableNodeData {
  name: string;
  expanded: boolean;
  mode?: 'preview' | 'edit';
  fields: Field[];
  openEnumModal?: (index: number, prevType?: string) => void;
  onToggle: () => void;
  updateField: (index: number, key: keyof Field, value: any) => void;
  addRow: () => void;
  deleteRow: (index: number) => void;
  updateTableName: (name: string) => void;
  deleteTable?: () => void;
  toggleMode?: () => void;
}

export default function TableNode({ id, data }: { id: string; data: TableNodeData }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(data.name);


  const handleNameDoubleClick = () => {
    setIsEditingName(true);
    setTempName(data.name);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      data.updateTableName(tempName.trim());
    } else {
      setTempName(data.name);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setTempName(data.name);
    }
  };

  // Make PK exclusive: when a field is set to PK, clear any other PKs
  const handlePkToggle = (index: number, isPk: boolean) => {
    if (isPk) {
      // unset any other PKs
      (data.fields || []).forEach((f, i) => {
        if (i !== index && f.pk) {
          data.updateField(i, 'pk', false)
        }
      })
      data.updateField(index, 'pk', true)
      // enforce PK constraints
      data.updateField(index, 'unique', true)
      data.updateField(index, 'nullable', false)
    } else {
      data.updateField(index, 'pk', false)
      const pkTypes = ['Int_autoinc', 'String_cuid', 'String_uuid']
      const currType = data.fields?.[index]?.type
      if (pkTypes.includes(currType)) {
        data.updateField(index, 'type', 'Int')
      }
    }
  }


  return (
    <div className="table-node">
      {/* Connection Handles - Top */}
      <Handle type="target" position={Position.Top} id="top-left" className="connection-handle" style={{ left: '25%' }} />
      <Handle type="target" position={Position.Top} id="top-center" className="connection-handle" style={{ left: '50%' }} />
      <Handle type="target" position={Position.Top} id="top-right" className="connection-handle" style={{ left: '75%' }} />
      
      <Handle type="source" position={Position.Top} id="top-left-source" className="connection-handle" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Top} id="top-center-source" className="connection-handle" style={{ left: '50%' }} />
      <Handle type="source" position={Position.Top} id="top-right-source" className="connection-handle" style={{ left: '75%' }} />
      
      {/* Connection Handles - Right */}
      <Handle type="target" position={Position.Right} id="right-top" className="connection-handle" style={{ top: '25%' }} />
      <Handle type="target" position={Position.Right} id="right-center" className="connection-handle" style={{ top: '50%' }} />
      <Handle type="target" position={Position.Right} id="right-bottom" className="connection-handle" style={{ top: '75%' }} />
      
      <Handle type="source" position={Position.Right} id="right-top-source" className="connection-handle" style={{ top: '25%' }} />
      <Handle type="source" position={Position.Right} id="right-center-source" className="connection-handle" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Right} id="right-bottom-source" className="connection-handle" style={{ top: '75%' }} />
      
      {/* Connection Handles - Bottom */}
      <Handle type="target" position={Position.Bottom} id="bottom-left" className="connection-handle" style={{ left: '25%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-center" className="connection-handle" style={{ left: '50%' }} />
      <Handle type="target" position={Position.Bottom} id="bottom-right" className="connection-handle" style={{ left: '75%' }} />
      
      <Handle type="source" position={Position.Bottom} id="bottom-left-source" className="connection-handle" style={{ left: '25%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-center-source" className="connection-handle" style={{ left: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-right-source" className="connection-handle" style={{ left: '75%' }} />
      
      {/* Connection Handles - Left */}
      <Handle type="target" position={Position.Left} id="left-top" className="connection-handle" style={{ top: '25%' }} />
      <Handle type="target" position={Position.Left} id="left-center" className="connection-handle" style={{ top: '50%' }} />
      <Handle type="target" position={Position.Left} id="left-bottom" className="connection-handle" style={{ top: '75%' }} />
      
      <Handle type="source" position={Position.Left} id="left-top-source" className="connection-handle" style={{ top: '25%' }} />
      <Handle type="source" position={Position.Left} id="left-center-source" className="connection-handle" style={{ top: '50%' }} />
      <Handle type="source" position={Position.Left} id="left-bottom-source" className="connection-handle" style={{ top: '75%' }} />
      
      {/* Table Header */}
      <div className="table-header">
        <button 
          className="collapse-btn"
          onClick={data.onToggle}
          title={data.expanded ? "Collapse" : "Expand"}
        >
          <img 
            src={data.expanded ? minusIcon : plusRoundedIcon} 
            alt={data.expanded ? "Collapse" : "Expand"} 
            className="collapse-icon" 
          />
        </button>
        
        {isEditingName ? (
          <input
            className="table-name-input"
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
          />
        ) : (
          <div 
            className="table-name"
            onDoubleClick={handleNameDoubleClick}
            title="Double-click to edit"
          >
            {data.name}
          </div>
        )}

        {data.deleteTable && (
          <button 
            className="delete-table-btn"
            onClick={data.deleteTable}
            title="Delete table"
          >
            <img src={crossIcon} alt="Delete table" className="delete-table-icon" />
          </button>
        )}
      </div>

      {/* Table Fields */}
      <div className={`table-body ${!data.expanded ? 'collapsed' : ''}`}>
        {/* Header Row */}
        <div className="field-row header-row">
          <div className="field-cell pk-cell">PK</div>
          <div className="field-cell name-cell">Name</div>
          <div className="field-cell type-cell">Type</div>
          <div className="field-cell nullable-cell">?</div>
          <div className="field-cell unique-cell">Unique</div>
          <div className="field-cell actions-cell"></div>
        </div>

          {/* Field Rows */}
          {data.fields.map((field, index) => (
            <FieldRow
              key={index}
              nodeId={id}
              field={field}
              index={index}
              updateField={data.updateField}
              deleteRow={data.deleteRow}
              onPkToggle={handlePkToggle}
              openEnumModal={data.openEnumModal}
            />
          ))}

          {/* Add Row Button */}
          <div className="add-row-container">
            <button 
              className="add-row-btn"
              onClick={data.addRow}
              title="Add new field"
            >
              <img src={plusIcon} alt="Add field" className="add-row-icon" />
            </button>
          </div>
      </div>
      
    </div>
  );
}

interface FieldRowProps {
  nodeId: string;
  field: Field;
  index: number;
  updateField: (index: number, key: keyof Field, value: any) => void;
  deleteRow: (index: number) => void;
  onPkToggle?: (index: number, isPk: boolean) => void;
  openEnumModal?: (index: number, prevType?: string) => void;
}
function FieldRow({ nodeId, field, index, updateField, deleteRow, onPkToggle, openEnumModal }: FieldRowProps) {
  const ctx = useContext(NodesContext)
  const enums = ctx?.enums ?? []
  const removeEnum = (name?: string) => {
    if (!name) return
    ctx?.removeEnum && ctx.removeEnum(name)
  }

  function TypeDropdown() {
    // local open state removed: we use global open state from context so
    // the dropdown survives React Flow node remounts
    const buttonRef = useRef<HTMLButtonElement | null>(null)
    const portalRef = useRef<HTMLDivElement | null>(null)
    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

    const ignoreDocClickRef = useRef(false)

    useEffect(() => {
      function onDoc(e: MouseEvent) {
        if (ignoreDocClickRef.current) {
          // ignore the first click that opened the dropdown
          ignoreDocClickRef.current = false
          return
        }

        const target = e.target as Node | null
        if (buttonRef.current && buttonRef.current.contains(target)) return
        if (portalRef.current && portalRef.current.contains(target)) return
        // close the globally-controlled dropdown
        ctx?.closeFieldDropdown && ctx.closeFieldDropdown()
      }
      document.addEventListener('click', onDoc)
      return () => document.removeEventListener('click', onDoc)
    }, [])

    // compute coords whenever the global open state for this field changes
    const isOpenGlobally = ctx?.openDropdown?.nodeId === nodeId && ctx?.openDropdown?.fieldIndex === index
    useLayoutEffect(() => {
      if (isOpenGlobally && buttonRef.current) {
        const r = buttonRef.current.getBoundingClientRect()
        setCoords({ top: r.bottom + 6, left: r.left, width: Math.max(180, r.width) })
      }
    }, [isOpenGlobally])

    const primitives = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes']
    const pkOptions = ['Int_autoinc', 'String_cuid', 'String_uuid']

    const dropdown = (
      <div
        ref={portalRef}
        className="type-dropdown"
        style={coords ? { position: 'fixed', top: coords.top, left: coords.left, minWidth: coords.width } : { position: 'fixed' }}
        onClick={(e) => e.stopPropagation()}
      >
        {field.pk && pkOptions.map((p) => (
          <div key={p} className="type-option" onClick={() => { updateField(index, 'type', p); ctx?.closeFieldDropdown && ctx.closeFieldDropdown() }}>
            {p}
          </div>
        ))}
        {primitives.map((p) => (
          <div key={p} className="type-option" onClick={() => { updateField(index, 'type', p); ctx?.closeFieldDropdown && ctx.closeFieldDropdown() }}>
            {p.toLowerCase()}
          </div>
        ))}
        <div className="type-divider">Enums</div>
        <div className="type-option create" onClick={() => { openEnumModal?.(index, field.type); ctx?.closeFieldDropdown && ctx.closeFieldDropdown() }}>+ Create enum...</div>
        {enums.map((e) => (
          <div key={e.name} className="type-option enum-option" onClick={() => { updateField(index, 'type', e.name); ctx?.closeFieldDropdown && ctx.closeFieldDropdown() }}>
            <span className="enum-option-name">{e.name}</span>
            <button className="type-option-delete" onClick={(ev) => { ev.stopPropagation(); removeEnum(e.name) }} title={`Delete ${e.name}`}>
              ×
            </button>
          </div>
        ))}
      </div>
    )
    return (
      <div className="type-select-wrapper" style={{ display: 'inline-block' }}>
        <button
          ref={buttonRef}
          className="type-select-button"
          onClick={() => ctx?.openFieldDropdown && ctx.openFieldDropdown(nodeId, index)}
          onPointerDownCapture={(e: React.PointerEvent) => {
            e.stopPropagation()
            // prevent immediate doc click from closing
            ignoreDocClickRef.current = true
            ctx?.openFieldDropdown && ctx.openFieldDropdown(nodeId, index)
          }}
        >
          {field.type}
        </button>
        {isOpenGlobally && ReactDOM.createPortal(dropdown, document.body)}
      </div>
    )
  }

  return (
    <div className="field-row">
      {/* Primary Key Checkbox */}
      <div className="field-cell pk-cell">
        <input
          type="checkbox"
          checked={field.pk}
          onChange={(e) => {
            const isPk = e.target.checked
            if (onPkToggle) {
              onPkToggle(index, isPk)
            } else {
              updateField(index, 'pk', isPk)
              if (isPk) {
                updateField(index, 'unique', true)
                updateField(index, 'nullable', false)
              } else {
                const pkTypes = ['Int_autoinc', 'String_cuid', 'String_uuid']
                if (pkTypes.includes(field.type)) {
                  updateField(index, 'type', 'Int')
                }
              }
            }
          }}
          title="Primary Key"
        />
      </div>

      {/* Field Name */}
      <div className="field-cell name-cell">
        <input
          type="text"
          value={field.name}
          onChange={(e) => updateField(index, 'name', e.target.value)}
          placeholder="field_name"
          className="field-input"
        />
      </div>

      {/* Field Type */}
      <div className="field-cell type-cell">
        <TypeDropdown />
      </div>

      {/* Nullable Checkbox */}
      <div className="field-cell nullable-cell">
        <input
          type="checkbox"
          checked={field.nullable}
          onChange={(e) => updateField(index, 'nullable', e.target.checked)}
          title="Nullable"
          disabled={field.pk}
        />
      </div>

      {/* Unique Checkbox */}
      <div className="field-cell unique-cell">
        <input
          type="checkbox"
          checked={field.unique}
          onChange={(e) => updateField(index, 'unique', e.target.checked)}
          title="Unique"
          disabled={field.pk}
        />
      </div>

      {/* Delete Button */}
      {!field.pk && (
        <div className="field-cell actions-cell">
          <button
            className="delete-row-btn"
            onClick={() => deleteRow(index)}
            title="Delete field"
          >
            <img src={trashIcon} alt="Delete" className="delete-icon" />
          </button>
        </div>
      )}
    </div>
  );
}
