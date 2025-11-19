import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { NodesContext } from '../context/NodesContext'
import type { Field, UpdateFieldFn } from '../types'
import crossIcon from '../assets/cross-rounded.svg'

interface Props {
  nodeId: string
  index: number
  field: Field
  updateField: UpdateFieldFn
  openEnumModal?: (index: number, prevType?: string) => void
}

export default function TypeDropdown({ nodeId, index, field, updateField, openEnumModal }: Props) {
  const ctx = React.useContext(NodesContext)
  const enums = ctx?.enums ?? []
  const removeEnum = (name?: string) => {
    if (!name) return
    ctx?.removeEnum && ctx.removeEnum(name)
  }

  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const portalRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const ignoreDocClickRef = useRef(false)
  const openIgnoreUntilRef = useRef<number>(0)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      // Ignore the first click that opened the dropdown (it can arrive
      // after mount) by checking either the pointer-capture flag or a
      // short time window after opening.
      if (ignoreDocClickRef.current) {
        ignoreDocClickRef.current = false
        return
      }
      if (openIgnoreUntilRef.current && Date.now() < openIgnoreUntilRef.current) {
        return
      }

      const target = e.target as Node | null
      if (buttonRef.current && buttonRef.current.contains(target)) return
      if (portalRef.current && portalRef.current.contains(target)) return
      ctx?.closeFieldDropdown && ctx.closeFieldDropdown()
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [ctx])

  const isOpenGlobally = ctx?.openDropdown?.nodeId === nodeId && ctx?.openDropdown?.fieldIndex === index
  useLayoutEffect(() => {
    if (isOpenGlobally && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left, width: Math.max(180, r.width) })
    }

    // If the global open state includes an `openedAt` timestamp, use it
    // to establish the ignore window. This survives remounts because the
    // timestamp is stored in context/state, not the local instance.
    const openedAt = ctx?.openDropdown?.openedAt
    if (openedAt) {
      openIgnoreUntilRef.current = openedAt + 250
    }
  }, [isOpenGlobally, ctx?.openDropdown?.openedAt])

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
            <img src={crossIcon} alt={`Delete ${e.name}`} className="type-option-delete-icon" />
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
        onPointerDownCapture={(e: React.PointerEvent) => {
          e.stopPropagation()
          // set a short ignore window immediately to avoid the
          // opening pointer event being perceived as an outside click
          // by the document handler.
          ignoreDocClickRef.current = true
          openIgnoreUntilRef.current = Date.now() + 200
          ctx?.openFieldDropdown && ctx.openFieldDropdown(nodeId, index)
        }}
      >
        {field.type}
      </button>
      {isOpenGlobally && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  )
}
