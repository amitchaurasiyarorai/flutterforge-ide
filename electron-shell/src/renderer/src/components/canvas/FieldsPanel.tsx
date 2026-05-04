import React, { useState } from 'react'
import { useIntegrationsStore } from '../../store/integrations.store'

// ─────────────────────────────────────────────────────────────────────────────
// Draggable field chip
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ interfaceId, fieldPath, label, color }: {
  interfaceId: string; fieldPath: string; label: string; color: string
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      draggable
      onDragStart={e => {
        setDragging(true)
        e.dataTransfer.setData('az/binding', JSON.stringify({ interfaceId, fieldPath }))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDragEnd={() => setDragging(false)}
      title={`Drag onto a widget to bind  •  ${fieldPath}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 7px', borderRadius: 4, marginBottom: 3, marginRight: 3,
        background: color + '14', border: '1px solid ' + color + '44',
        color, fontSize: 10, fontFamily: 'monospace',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none' as const,
        opacity: dragging ? 0.5 : 1,
        transition: 'opacity 0.1s',
      }}>
      <span style={{ fontSize: 8, opacity: 0.6 }}>⠿</span>
      {label}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────

function typeColor(type: string): string {
  return { String:'#4a9edd', int:'#c9a227', double:'#c9a227', bool:'#4caf7d',
           DateTime:'#9d7fe8', List:'#e05252', Object:'#8892A4' }[type] || '#555'
}

function getAllFieldPaths(obj: any, prefix = ''): { path: string; type: string }[] {
  if (!obj || typeof obj !== 'object') return []
  const out: { path: string; type: string }[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + k : k
    if (Array.isArray(v)) {
      out.push({ path: path + '[]', type: 'List' })
      if (v[0] && typeof v[0] === 'object') {
        getAllFieldPaths(v[0], path + '[]').forEach(p => out.push(p))
      }
    } else if (v !== null && typeof v === 'object') {
      out.push({ path, type: 'Object' })
      getAllFieldPaths(v, path).forEach(p => out.push(p))
    } else {
      out.push({ path, type: typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'double') : typeof v === 'boolean' ? 'bool' : 'String' })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function FieldsPanel(): JSX.Element {
  const { interfaces, dataFiles } = useIntegrationsStore()
  const [openIfcs, setOpenIfcs] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setOpenIfcs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (interfaces.length === 0) {
    return (
      <div style={{ padding: '12px 10px', fontSize: 11, color: '#444', textAlign: 'center' as const, lineHeight: 1.7 }}>
        No interfaces yet.<br/>
        <span style={{ fontSize: 10, color: '#333' }}>Define one in the Interfaces tab to see fields here.</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 8px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#555', letterSpacing: '0.08em',
        textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 2 }}>
        API Fields — drag onto widget
      </div>

      {interfaces.map(ifc => {
        const df = dataFiles.find(d => d.id === ifc.responseSchemaId)
        let fields: { path: string; type: string }[] = []
        if (df) {
          try {
            const parsed = JSON.parse(df.mockJson)
            const root = Array.isArray(parsed) ? parsed[0] : (parsed.data?.[0] ?? parsed)
            fields = getAllFieldPaths(root)
          } catch {}
        }

        const isOpen = openIfcs.has(ifc.id)

        return (
          <div key={ifc.id} style={{ marginBottom: 6 }}>
            {/* Interface header */}
            <div onClick={() => toggle(ifc.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                background: '#0a0a14', borderRadius: 6, cursor: 'pointer',
                border: '1px solid #1e2d3d', marginBottom: isOpen ? 5 : 0 }}>
              <span style={{ fontSize: 9, color: '#555' }}>{isOpen ? '▼' : '▶'}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#e0d7ff', fontFamily: 'monospace' }}>
                {ifc.name}
              </span>
              <span style={{ fontSize: 9, color: '#555', marginLeft: 'auto' }}>
                {fields.length} fields
              </span>
            </div>

            {/* Field chips */}
            {isOpen && (
              <div style={{ paddingLeft: 6, paddingBottom: 4 }}>
                {fields.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#444', padding: '4px 2px' }}>
                    No fields — link a Data File in the Interfaces tab
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 2 }}>
                    {fields.map(f => (
                      <Chip
                        key={f.path}
                        interfaceId={ifc.id}
                        fieldPath={f.path}
                        label={f.path.split('.').pop() || f.path}
                        color={typeColor(f.type)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
