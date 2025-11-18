// TableNode.tsx

import { Handle, Position } from "@xyflow/react";
import { useState } from 'react';
import './styles/main.css';
import trashIcon from '../assets/trash-can.svg';
import minusIcon from '../assets/minus-rounded.svg';
import plusRoundedIcon from '../assets/plus-rounded.svg';
import plusIcon from '../assets/plus.svg';
import crossIcon from '../assets/cross-rounded.svg';

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
  onToggle: () => void;
  updateField: (index: number, key: keyof Field, value: any) => void;
  addRow: () => void;
  deleteRow: (index: number) => void;
  updateTableName: (name: string) => void;
  deleteTable?: () => void;
  toggleMode?: () => void;
}

export default function TableNode({ data }: { data: TableNodeData }) {
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
          <div className="field-cell unique-cell">U</div>
          <div className="field-cell actions-cell"></div>
        </div>

          {/* Field Rows */}
          {data.fields.map((field, index) => (
            <FieldRow
              key={index}
              field={field}
              index={index}
              updateField={data.updateField}
              deleteRow={data.deleteRow}
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
  field: Field;
  index: number;
  updateField: (index: number, key: keyof Field, value: any) => void;
  deleteRow: (index: number) => void;
}

function FieldRow({ field, index, updateField, deleteRow }: FieldRowProps) {
  return (
    <div className="field-row">
      {/* Primary Key Checkbox */}
      <div className="field-cell pk-cell">
        <input
          type="checkbox"
          checked={field.pk}
          onChange={(e) => {
            const isPk = e.target.checked;
            updateField(index, 'pk', isPk);
            if (isPk) {
              // When PK is checked, set unique to true, nullable to false
              // and force the type to the auto-increment type.
              updateField(index, 'type', 'Int_autoinc');
              updateField(index, 'unique', true);
              updateField(index, 'nullable', false);
            } else {
              // If PK is removed and the field was the auto-inc type, reset to Int
              if (field.type === 'Int_autoinc') {
                updateField(index, 'type', 'Int');
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
        <select
          value={field.type}
          onChange={(e) => updateField(index, 'type', e.target.value)}
          className="field-select"
          disabled={field.pk}
        >
          {/* If this field is PK, show the auto-increment type only (disabled select). */}
          {field.pk ? (
            <option value="Int_autoinc">Int (Auto Inc)</option>
          ) : (
            <>
              <option value="String">String</option>
              <option value="Int">Int</option>
              <option value="Float">Float</option>
              <option value="Boolean">Boolean</option>
              <option value="DateTime">DateTime</option>
              <option value="Json">Json</option>
              <option value="Bytes">Bytes</option>
            </>
          )}
        </select>
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
