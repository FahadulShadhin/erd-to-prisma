import React, { useEffect, useState } from 'react'
import plusIcon from '../assets/plus-rounded.svg'
import crossIcon from '../assets/cross-rounded.svg'

interface Props {
  open: boolean
  initialName?: string
  initialValues?: string[]
  onCancel: () => void
  onDone: (payload: { name: string; values: string[] }) => void
}

export default function EnumModal({ open, initialName = '', initialValues = [], onCancel, onDone }: Props) {
  const [name, setName] = useState(initialName)
  const [valueInput, setValueInput] = useState('')
  const [values, setValues] = useState<string[]>(initialValues)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setValues(initialValues)
      setValueInput('')
    }
  }, [open, initialName, initialValues])

  if (!open) return null

  const addValue = () => {
    const v = valueInput.trim()
    if (!v) return
    // sanitize value to be a valid enum identifier (basic)
    const safe = v.replace(/[^A-Za-z0-9_]/g, '_')
    if (!values.includes(safe)) setValues((p) => [...p, safe])
    setValueInput('')
  }

  const removeValue = (v: string) => setValues((p) => p.filter((x) => x !== v))

  const handleDone = () => {
    const enumName = name.trim().replace(/[^A-Za-z0-9_]/g, '_')
    if (!enumName || values.length === 0) return
    onDone({ name: enumName, values })
  }

  return (
    <div className="enum-modal-overlay" role="dialog" aria-modal="true">
      <div className="enum-modal">
        <div className="enum-modal-header">
          <div className="enum-modal-title">Create Enum</div>
        </div>

        <div className="enum-modal-body">
          <label className="enum-label">Enum Name</label>
          <input
            className="enum-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="EnumName"
          />

          <label className="enum-label">Values</label>
          <div className="enum-value-entry">
            <input
              className="enum-input"
              type="text"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder="Value and press +"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addValue()
                }
              }}
            />
            <button className="btn icon-btn" onClick={addValue} title="Add value">
              <img src={plusIcon} alt="Add" />
            </button>
          </div>

          <div className="enum-pills">
            {values.map((v) => (
              <span key={v} className="enum-pill">
                {v}
                <button className="pill-remove" onClick={() => removeValue(v)} aria-label={`Remove ${v}`}>
                  <img src={crossIcon} alt="Remove" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="enum-modal-footer">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={handleDone}>Done</button>
        </div>
      </div>
    </div>
  )
}
