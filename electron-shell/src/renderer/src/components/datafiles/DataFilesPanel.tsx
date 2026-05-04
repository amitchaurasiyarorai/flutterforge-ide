import React, { useState } from 'react'
import { useIntegrationsStore } from '../../store/integrations.store'
import type { DataFile, SchemaField, FieldType, ResponseType } from '../../types/api-integration.types'
import {
  FIELD_TYPES, RESPONSE_TYPE_LABELS, makeFieldId,
} from '../../types/api-integration.types'

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:        { display:'flex', height:'100%', background:'#0d0d1a', overflow:'hidden' },
  sidebar:     { width:220, borderRight:'1px solid #1e2d3d', display:'flex', flexDirection:'column', flexShrink:0 },
  sideHead:    { padding:'12px 14px', borderBottom:'1px solid #1e2d3d', display:'flex', alignItems:'center', justifyContent:'space-between' },
  sideTitle:   { fontSize:11, fontWeight:700, color:'#8892A4', letterSpacing:'0.08em', textTransform:'uppercase' as const },
  addBtn:      { background:'#1E6BFF', border:'none', color:'#fff', width:22, height:22, borderRadius:5, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' },
  schemaItem:  { padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #0d1117', display:'flex', alignItems:'center', justifyContent:'space-between' },
  schemaName:  { fontSize:13, fontWeight:500 },
  badge:       { fontSize:10, padding:'2px 7px', borderRadius:10, border:'1px solid', fontFamily:'monospace' },
  body:        { flex:1, overflowY:'auto' as const, padding:20 },
  empty:       { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, color:'#444' },
  section:     { marginBottom:20, border:'1px solid #1e2d3d', borderRadius:10, overflow:'hidden' },
  secHead:     { padding:'8px 14px', background:'#0a0a14', borderBottom:'1px solid #1e2d3d', display:'flex', alignItems:'center', justifyContent:'space-between' },
  secTitle:    { fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' as const },
  secBody:     { padding:14 },
  row:         { display:'flex', alignItems:'center', gap:10, marginBottom:10 },
  label:       { width:130, fontSize:12, color:'#8892A4', flexShrink:0 },
  input:       { flex:1, padding:'6px 10px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif' },
  select:      { flex:1, padding:'6px 10px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  textarea:    { width:'100%', padding:'8px 10px', background:'#050510', border:'1px solid #1e2d3d', borderRadius:6, fontSize:12, color:'#6dda9d', outline:'none', fontFamily:'monospace', resize:'vertical' as const, lineHeight:1.7 },
  fieldRow:    { display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 1fr 24px', gap:6, alignItems:'center', padding:'6px 8px', background:'#0a0a14', borderRadius:6, marginBottom:5 },
  fieldLabel:  { fontSize:11, color:'#555', fontFamily:'monospace', letterSpacing:'0.05em' },
  smInput:     { padding:'4px 7px', background:'#050510', border:'1px solid #1e2d3d', borderRadius:5, fontSize:11, color:'#d4d4d4', outline:'none', width:'100%', fontFamily:'system-ui,sans-serif' },
  smSelect:    { padding:'4px 7px', background:'#050510', border:'1px solid #1e2d3d', borderRadius:5, fontSize:11, color:'#d4d4d4', outline:'none', width:'100%', cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  delBtn:      { background:'transparent', border:'none', color:'#3a1a1a', cursor:'pointer', fontSize:14, borderRadius:4, padding:'2px 4px', transition:'color 0.15s' },
  smallBtn:    { padding:'4px 10px', background:'#1e1a33', border:'1px solid #3d3060', borderRadius:6, color:'#9d7fe8', fontSize:11, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  typeChip:    { padding:'2px 8px', borderRadius:4, fontSize:10, fontFamily:'monospace', border:'1px solid', flexShrink:0 },
  mockJson:    { background:'#050510', borderRadius:8, padding:14, fontFamily:'monospace', fontSize:12, color:'#6dda9d', lineHeight:1.8, whiteSpace:'pre-wrap' as const, border:'1px solid #1e2d3d', cursor:'text' },
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE TYPE BADGE COLORS
// ─────────────────────────────────────────────────────────────────────────────

function rtColor(rt: ResponseType): string {
  return { FLAT_OBJECT:'#4a9edd', BARE_ARRAY:'#9d7fe8', WRAPPED_ARRAY:'#c9a227',
           NESTED:'#4caf7d', STATUS:'#888', DYNAMIC_KEYS:'#e05252' }[rt] || '#555'
}

function rtShort(rt: ResponseType): string {
  return { FLAT_OBJECT:'OBJ', BARE_ARRAY:'ARR[]', WRAPPED_ARRAY:'WRAP', NESTED:'NEST', STATUS:'STAT', DYNAMIC_KEYS:'DYN' }[rt] || rt
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD ROW
// ─────────────────────────────────────────────────────────────────────────────

function FieldRow({ field, indent = 0, dataFileId }: {
  field: SchemaField; indent?: number; dataFileId: string
}) {
  const { updateField, deleteField, addField } = useIntegrationsStore()
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ marginLeft: indent * 20 }}>
      <div style={s.fieldRow}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {(field.type === 'List' || field.type === 'Object') && (
            <button onClick={() => setExpanded(!expanded)}
              style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:11, padding:'0 2px' }}>
              {expanded ? '▼' : '▶'}
            </button>
          )}
          <input
            style={s.smInput}
            value={field.name}
            onChange={e => updateField(dataFileId, field.id, { name: e.target.value })}
            placeholder="fieldName"
          />
        </div>
        <select style={s.smSelect} value={field.type}
          onChange={e => updateField(dataFileId, field.id, { type: e.target.value as FieldType })}>
          {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={s.smSelect} value={field.required ? 'req' : 'opt'}
          onChange={e => updateField(dataFileId, field.id, { required: e.target.value === 'req' })}>
          <option value="req">required</option>
          <option value="opt">optional</option>
        </select>
        <input
          style={{ ...s.smInput }}
          value={field.mockValue}
          onChange={e => updateField(dataFileId, field.id, { mockValue: e.target.value })}
          placeholder="mock value"
        />
        <input
          style={s.smInput}
          value={field.description || ''}
          onChange={e => updateField(dataFileId, field.id, { description: e.target.value })}
          placeholder="description (optional)"
        />
        <button style={s.delBtn}
          onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3a1a1a')}
          onClick={() => deleteField(dataFileId, field.id)}>✕</button>
      </div>

      {/* Nested fields for Object / List type */}
      {expanded && (field.type === 'Object' || field.type === 'List') && (
        <div style={{ marginLeft: 20 }}>
          {(field.fields || []).map(child => (
            <FieldRow key={child.id} field={child} indent={0} dataFileId={dataFileId} />
          ))}
          <button style={{ ...s.smallBtn, marginLeft: 8, marginBottom: 6 }}
            onClick={() => {
              const child: SchemaField = { id: makeFieldId(), name: 'field', type: 'String', required: false, mockValue: '' }
              updateField(dataFileId, field.id, { fields: [...(field.fields || []), child] })
            }}>+ sub-field</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK JSON GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function generateMockJson(df: DataFile): string {
  function fieldToMock(f: SchemaField): any {
    if (f.mockValue && f.mockValue !== '') {
      if (f.type === 'int' || f.type === 'double') return Number(f.mockValue) || 0
      if (f.type === 'bool') return f.mockValue === 'true'
      return f.mockValue
    }
    const defaults: Record<FieldType, any> = {
      String: 'sample', int: 0, double: 0.0, bool: false,
      DateTime: new Date().toISOString(), List: [], Object: {}, dynamic: null,
    }
    if (f.type === 'Object' && f.fields) {
      return Object.fromEntries(f.fields.map(c => [c.name, fieldToMock(c)]))
    }
    if (f.type === 'List' && f.fields) {
      return [Object.fromEntries(f.fields.map(c => [c.name, fieldToMock(c)]))]
    }
    return defaults[f.type] ?? null
  }

  const obj = Object.fromEntries(df.fields.map(f => [f.name, fieldToMock(f)]))

  switch (df.responseType) {
    case 'FLAT_OBJECT':   return JSON.stringify(obj, null, 2)
    case 'BARE_ARRAY':    return JSON.stringify([obj, { ...obj }], null, 2)
    case 'WRAPPED_ARRAY': return JSON.stringify({
      [df.arrayPath || 'data']: [obj, { ...obj }],
      total: 24, page: 1, pageSize: 10
    }, null, 2)
    case 'NESTED':        return JSON.stringify(obj, null, 2)
    case 'STATUS':        return JSON.stringify({ success: true, message: 'OK', ...obj }, null, 2)
    case 'DYNAMIC_KEYS':  return JSON.stringify({ category1: [obj], category2: [obj] }, null, 2)
    default:              return JSON.stringify(obj, null, 2)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA FILE EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function DataFileEditor({ df }: { df: DataFile }) {
  const { updateDataFile, addField, updateField } = useIntegrationsStore()
  const [mockEditing, setMockEditing] = useState(false)
  const [mockDraft, setMockDraft] = useState('')

  const regenerateMock = () => {
    const mock = generateMockJson(df)
    updateDataFile(df.id, { mockJson: mock })
  }

  return (
    <div style={s.body}>

      {/* Basic info */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#4a9edd' }}>Schema definition</span>
        </div>
        <div style={s.secBody}>
          <div style={s.row}>
            <span style={s.label}>Schema name</span>
            <input style={s.input} value={df.name}
              onChange={e => updateDataFile(df.id, { name: e.target.value })}
              placeholder="e.g. KendraResponse"/>
          </div>
          <div style={s.row}>
            <span style={s.label}>Description</span>
            <input style={s.input} value={df.description}
              onChange={e => updateDataFile(df.id, { description: e.target.value })}
              placeholder="What API does this response come from?"/>
          </div>
          <div style={s.row}>
            <span style={s.label}>Response type</span>
            <select style={s.select} value={df.responseType}
              onChange={e => updateDataFile(df.id, { responseType: e.target.value as ResponseType })}>
              {(Object.keys(RESPONSE_TYPE_LABELS) as ResponseType[]).map(rt => (
                <option key={rt} value={rt}>{RESPONSE_TYPE_LABELS[rt]}</option>
              ))}
            </select>
          </div>
          {(df.responseType === 'WRAPPED_ARRAY' || df.responseType === 'BARE_ARRAY') && (
            <div style={s.row}>
              <span style={s.label}>Array path</span>
              <input style={s.input} value={df.arrayPath || ''}
                onChange={e => updateDataFile(df.id, { arrayPath: e.target.value })}
                placeholder="e.g. 'data' for { data: [...] } — leave blank for bare array"/>
            </div>
          )}
          {df.responseType === 'WRAPPED_ARRAY' && (
            <>
              <div style={s.row}>
                <span style={s.label}>Total field</span>
                <input style={{ ...s.input, flex:'none', width:120 }}
                  value={df.paginationFields?.totalField || 'total'}
                  onChange={e => updateDataFile(df.id, { paginationFields: { ...df.paginationFields, totalField: e.target.value, pageField: df.paginationFields?.pageField || 'page', pageSizeField: df.paginationFields?.pageSizeField || 'pageSize' } })}/>
                <span style={{ ...s.label, width:'auto', paddingLeft:8 }}>Page field</span>
                <input style={{ ...s.input, flex:'none', width:120 }}
                  value={df.paginationFields?.pageField || 'page'}
                  onChange={e => updateDataFile(df.id, { paginationFields: { ...df.paginationFields, pageField: e.target.value, totalField: df.paginationFields?.totalField || 'total', pageSizeField: df.paginationFields?.pageSizeField || 'pageSize' } })}/>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fields */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#9d7fe8' }}>
            Response fields
            <span style={{ fontSize:10, color:'#555', fontWeight:400, marginLeft:8 }}>
              {df.responseType === 'WRAPPED_ARRAY' || df.responseType === 'BARE_ARRAY'
                ? '— fields of each array item'
                : df.responseType === 'STATUS'
                ? '— extra fields alongside success/message'
                : '— top-level response fields'}
            </span>
          </span>
          <button style={s.smallBtn} onClick={() => addField(df.id)}>+ add field</button>
        </div>
        <div style={s.secBody}>
          {/* Column headers */}
          <div style={{ ...s.fieldRow, marginBottom:8, opacity:0.5 }}>
            {['Field name','Type','Required','Mock value','Description',''].map((h,i) => (
              <span key={i} style={s.fieldLabel}>{h}</span>
            ))}
          </div>
          {df.fields.length === 0 && (
            <div style={{ color:'#444', fontSize:12, padding:'12px 0', textAlign:'center' as const }}>
              No fields yet — click + add field to define the response structure
            </div>
          )}
          {df.fields.map(field => (
            <FieldRow key={field.id} field={field} dataFileId={df.id} />
          ))}
        </div>
      </div>

      {/* Error schema */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#e05252' }}>Error schema</span>
          <span style={{ fontSize:10, color:'#555' }}>when this API returns an error — can differ from success</span>
        </div>
        <div style={s.secBody}>
          {(df.errorSchema || []).length === 0 && (
            <div style={{ fontSize:12, color:'#444', marginBottom:8 }}>
              Default: <code style={{ fontFamily:'monospace', color:'#8892A4', fontSize:11 }}>{'{ code: int, message: String }'}</code>
              — add fields below to override
            </div>
          )}
          {(df.errorSchema || []).map(field => (
            <FieldRow key={field.id} field={field} dataFileId={df.id} />
          ))}
          <button style={s.smallBtn}
            onClick={() => {
              const newField: SchemaField = { id: makeFieldId(), name: 'errorField', type: 'String', required: false, mockValue: '' }
              updateDataFile(df.id, { errorSchema: [...(df.errorSchema || []), newField] })
            }}>+ add error field</button>
        </div>
      </div>

      {/* Mock JSON preview */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#4caf7d' }}>Mock JSON</span>
          <div style={{ display:'flex', gap:8 }}>
            <button style={s.smallBtn} onClick={regenerateMock}>↺ regenerate</button>
            <button style={s.smallBtn} onClick={() => {
              setMockDraft(df.mockJson); setMockEditing(!mockEditing)
            }}>{mockEditing ? 'done' : 'edit'}</button>
          </div>
        </div>
        <div style={s.secBody}>
          <div style={{ fontSize:11, color:'#555', marginBottom:8 }}>
            This mock is shown in the Canvas when no real API is connected. Used for UI preview and code generation defaults.
          </div>
          {mockEditing ? (
            <textarea style={s.textarea} rows={12} value={mockDraft}
              onChange={e => setMockDraft(e.target.value)}
              onBlur={() => { updateDataFile(df.id, { mockJson: mockDraft }); setMockEditing(false) }}/>
          ) : (
            <div style={s.mockJson} onClick={() => { setMockDraft(df.mockJson); setMockEditing(true) }}>
              {df.mockJson || '{}'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DataFilesPanel(): JSX.Element {
  const { dataFiles, addDataFile, deleteDataFile } = useIntegrationsStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const selectedDf = dataFiles.find(d => d.id === selected)

  const handleAdd = () => {
    if (!newName.trim()) return
    const id = addDataFile(newName.trim())
    setSelected(id)
    setNewName('')
    setAdding(false)
  }

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sideHead}>
          <span style={s.sideTitle}>Data Files</span>
          <button style={s.addBtn} onClick={() => setAdding(true)} title="New schema">+</button>
        </div>

        {adding && (
          <div style={{ padding:'10px 12px', borderBottom:'1px solid #1e2d3d' }}>
            <input autoFocus style={{ ...s.input, marginBottom:6, width:'100%' }}
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="KendraResponse"/>
            <div style={{ display:'flex', gap:6 }}>
              <button style={{ ...s.smallBtn, color:'#4caf7d', borderColor:'#14532d' }} onClick={handleAdd}>Create</button>
              <button style={s.smallBtn} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto' as const }}>
          {dataFiles.length === 0 && !adding && (
            <div style={{ padding:'20px 14px', textAlign:'center' as const }}>
              <div style={{ fontSize:24, marginBottom:8, opacity:0.3 }}>◈</div>
              <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>No schemas yet</div>
              <div style={{ fontSize:11, color:'#333', lineHeight:1.6, marginBottom:12 }}>
                Data Files define your API response shapes — field names, types, and mock values
              </div>
              <button onClick={() => setAdding(true)} style={{
                padding:'6px 14px', background:'#1e1a33',
                border:'1px solid #3d3060', borderRadius:6,
                color:'#9d7fe8', fontSize:11, cursor:'pointer',
                fontFamily:'system-ui,sans-serif',
              }}>+ New Schema</button>
            </div>
          )}
          {dataFiles.map(df => (
            <div key={df.id}
              style={{ ...s.schemaItem,
                background: selected === df.id ? '#1e1a33' : 'transparent',
                color:      selected === df.id ? '#e0d7ff' : '#8892A4',
              }}
              onClick={() => setSelected(df.id)}>
              <div>
                <div style={s.schemaName}>{df.name}</div>
                <div style={{ fontSize:10, color:'#555', marginTop:1 }}>{df.fields.length} fields</div>
              </div>
              <span style={{ ...s.badge,
                color: rtColor(df.responseType),
                borderColor: rtColor(df.responseType) + '44',
                background: rtColor(df.responseType) + '11',
              }}>{rtShort(df.responseType)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Editor area */}
      {selectedDf ? (
        <DataFileEditor key={selectedDf.id} df={selectedDf} />
      ) : (
        <div style={{ ...s.body, ...s.empty }}>
          <div style={{ fontSize:32, opacity:0.2 }}>◈</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#555', marginBottom:4 }}>Select a schema</div>
          <div style={{ fontSize:12, color:'#333', textAlign:'center', lineHeight:1.6, maxWidth:280 }}>
            Data Files map your API response fields — names, types, and mock values.
            Linked to Interfaces for binding widgets and generating Dart code.
          </div>
        </div>
      )}
    </div>
  )
}
