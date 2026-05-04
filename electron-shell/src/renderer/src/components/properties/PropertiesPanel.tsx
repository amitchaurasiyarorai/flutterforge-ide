import React, { useState, useRef } from 'react'
import { useCanvasStore, selectActiveScreen, selectSelectedWidgets } from '../../store/canvas.store'
import { useIntegrationsStore } from '../../store/integrations.store'
import type { WidgetNode } from '../../types/widget.schema'
import type { ApiBinding } from '../../types/widget.schema'
import type { FormatType } from '../../types/api-integration.types'
import { FORMAT_EXAMPLES } from '../../types/api-integration.types'
import ActionsPanel from './ActionsPanel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveFieldPath(mockJson: string, fieldPath: string): string {
  try {
    const obj = JSON.parse(mockJson)
    const parts = fieldPath.replace(/\[\]/g, '[0]').split('.')
    let cur: any = Array.isArray(obj) ? obj[0] : (obj.data?.[0] ?? obj)
    for (const p of parts) {
      if (cur == null) return ''
      const m = p.match(/^(\w+)\[(\d+)\]$/)
      cur = m ? (cur[m[1]] ?? [])[+m[2]] : cur[p]
    }
    return cur == null ? '' : String(cur)
  } catch { return '' }
}

function applyFormat(raw: string, format: string, arg?: string): string {
  switch (format) {
    case 'currency':   return '\u20b9' + Number(raw).toLocaleString('en-IN', { minimumFractionDigits:2 })
    case 'percentage': return Number(raw).toFixed(1) + '%'
    case 'uppercase':  return raw.toUpperCase()
    case 'lowercase':  return raw.toLowerCase()
    case 'truncate':   { const n = parseInt(arg || '20'); return raw.length > n ? raw.slice(0,n) + '\u2026' : raw }
    case 'date':       try { return new Date(raw).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) } catch { return raw }
    case 'dateTime':   try { return new Date(raw).toLocaleString('en-IN') } catch { return raw }
    default:           return raw
  }
}

function getDefaultTargetProp(widgetType: string): string {
  if (widgetType.includes('Text'))          return 'data'
  if (widgetType.includes('TextField'))     return 'hintText'
  if (widgetType.includes('Image'))         return 'src'
  if (widgetType.includes('ListView'))      return 'items'
  if (widgetType.includes('ElevatedButton') || widgetType.includes('TextButton')) return 'text'
  if (widgetType.includes('CircleAvatar'))  return 'child'
  if (widgetType.includes('ListTile'))      return 'title'
  return 'data'
}

function getAllFieldPaths(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return []
  const paths: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + k : k
    if (Array.isArray(v)) {
      paths.push(path + '[]')
      if (v[0] && typeof v[0] === 'object') getAllFieldPaths(v[0], path + '[]').forEach(p => paths.push(p))
    } else if (v && typeof v === 'object') {
      paths.push(path)
      getAllFieldPaths(v, path).forEach(p => paths.push(p))
    } else {
      paths.push(path)
    }
  }
  return paths
}

// ─── Data Binding Section ─────────────────────────────────────────────────────

function DataBindingSection({ widget, screenId }: { widget: WidgetNode; screenId: string }) {
  const { updateWidget } = useCanvasStore()
  const { interfaces, dataFiles } = useIntegrationsStore()
  const [exprMode, setExprMode] = useState(false)
  const [expr, setExpr] = useState('')
  const [showSug, setShowSug] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const exprRef = useRef<HTMLInputElement>(null)

  const binding = widget.apiBinding as ApiBinding | undefined
  const selIfc   = interfaces.find(i => i.id === binding?.interfaceId)
  const selDf    = dataFiles.find(d => d.id === selIfc?.responseSchemaId)

  const allPaths: string[] = selDf ? (() => {
    try {
      const parsed = JSON.parse(selDf.mockJson)
      const root = Array.isArray(parsed) ? parsed[0] : (parsed.data?.[0] ?? parsed)
      return getAllFieldPaths(root)
    } catch { return [] }
  })() : []

  const allChips = interfaces.flatMap(ifc => {
    const df = dataFiles.find(d => d.id === ifc.responseSchemaId)
    if (!df) return []
    try {
      const parsed = JSON.parse(df.mockJson)
      const root = Array.isArray(parsed) ? parsed[0] : (parsed.data?.[0] ?? parsed)
      return getAllFieldPaths(root).map(fp => ({ label: ifc.name + '.' + fp, ifcId: ifc.id, fp }))
    } catch { return [] }
  })

  const mockPreview = binding && selDf
    ? applyFormat(resolveFieldPath(selDf.mockJson, binding.fieldPath), binding.format, binding.formatArg)
    : ''

  const setBinding = (patch: Partial<ApiBinding>) => {
    const next: ApiBinding = {
      interfaceId: '', fieldPath: '', targetProp: getDefaultTargetProp(widget.type),
      format: 'none', ...(binding || {}), ...patch,
    }
    // When interfaceId changes, store the urlPath + method from the interface
    // so Java codegen can generate the correct HTTP call
    if (patch.interfaceId !== undefined) {
      const ifc = interfaces.find(i => i.id === patch.interfaceId)
      if (ifc) {
        ;(next as any).urlPath = ifc.urlPath
        ;(next as any).method  = ifc.method
        ;(next as any).interfaceName = ifc.name
      }
    }
    if (next.interfaceId && next.fieldPath) {
      const df2 = dataFiles.find(d => d.id === interfaces.find(i => i.id === next.interfaceId)?.responseSchemaId)
      if (df2) next.mockPreview = applyFormat(resolveFieldPath(df2.mockJson, next.fieldPath), next.format, next.formatArg)
    }
    updateWidget(screenId, widget.id, { apiBinding: next } as any)
  }

  const clearBinding = () => updateWidget(screenId, widget.id, { apiBinding: undefined } as any)

  const applyExpr = (raw: string) => {
    const m = raw.match(/^\{\{(\w+)\.(.+?)\}\}$/)
    if (m) {
      const ifc = interfaces.find(i => i.name === m[1])
      if (ifc) { setBinding({ interfaceId: ifc.id, fieldPath: m[2] }); setExprMode(false); return }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    try {
      const d = JSON.parse(e.dataTransfer.getData('az/binding'))
      setBinding({ interfaceId: d.interfaceId, fieldPath: d.fieldPath })
    } catch {}
  }

  return (
    <div style={ss.bindSection}>
      <div style={ss.bindHeader}>
        <span style={ss.secTitle}>Data binding</span>
        <div style={{ display:'flex', gap:4 }}>
          <button title="Dropdown" onClick={() => setExprMode(false)}
            style={{ ...ss.modeBtn, background: !exprMode ? '#1e3a5f':'transparent', color: !exprMode ? '#4a9edd':'#444' }}>
            &#8942;
          </button>
          <button title="Expression {{...}}" onClick={() => { setExprMode(true); setTimeout(() => exprRef.current?.focus(), 50) }}
            style={{ ...ss.modeBtn, background: exprMode ? '#1a2e1a':'transparent', color: exprMode ? '#4caf7d':'#444' }}>
            {'{}'}
          </button>
          {binding && <button onClick={clearBinding} style={{ ...ss.modeBtn, color:'#e05252' }}>x</button>}
        </div>
      </div>

      {/* Drop zone */}
      <div onDragOver={e => { e.preventDefault(); setDragOver(true) }}
           onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
           style={{ ...ss.dropZone, borderColor: dragOver ? '#1E6BFF' : binding ? '#1e3a5f' : '#1e2d3d',
             background: dragOver ? 'rgba(30,107,255,0.08)' : binding ? 'rgba(30,107,255,0.04)' : 'transparent' }}>
        {binding ? (
          <div style={{ fontSize:11 }}>
            <div style={{ color:'#4a9edd', fontFamily:'monospace', marginBottom:3 }}>
              {selIfc?.name}.{binding.fieldPath}
            </div>
            {mockPreview && <div style={{ color:'#4caf7d', fontSize:10 }}>Preview: {mockPreview}</div>}
          </div>
        ) : (
          <div style={{ color:'#444', fontSize:10, textAlign:'center' as const }}>
            Drop a field here or use fields below
          </div>
        )}
      </div>

      {/* Expression input */}
      {exprMode && (
        <div style={{ position:'relative' as const, marginBottom:8 }}>
          <input ref={exprRef} style={ss.exprInput} value={expr}
            onChange={e => { setExpr(e.target.value); setShowSug(true) }}
            onKeyDown={e => e.key === 'Enter' && (applyExpr(expr), setShowSug(false))}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="{{interfaceName.fieldPath}}" spellCheck={false}/>
          {showSug && expr.length > 1 && (
            <div style={ss.suggestions}>
              {allChips.filter(c => c.label.toLowerCase().includes(expr.replace(/[{}]/g,'').toLowerCase())).slice(0,8).map(c => (
                <div key={c.label} style={ss.suggestion}
                  onMouseDown={() => { setExpr('{{' + c.label + '}}'); applyExpr('{{' + c.label + '}}'); setShowSug(false) }}>
                  <span style={{ color:'#4a9edd', fontFamily:'monospace', fontSize:10 }}>{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dropdown binding */}
      {!exprMode && (
        <>
          <div style={ss.bindRow}>
            <span style={ss.bindLabel}>Interface</span>
            <select style={ss.bindSel} value={binding?.interfaceId || ''}
              onChange={e => setBinding({ interfaceId: e.target.value, fieldPath: '' })}>
              <option value="">none</option>
              {interfaces.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          {binding?.interfaceId && (
            <div style={ss.bindRow}>
              <span style={ss.bindLabel}>Field</span>
              <select style={ss.bindSel} value={binding.fieldPath || ''}
                onChange={e => setBinding({ fieldPath: e.target.value })}>
                <option value="">pick field</option>
                {allPaths.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
          {binding?.interfaceId && binding?.fieldPath && (
            <>
              <div style={ss.bindRow}>
                <span style={ss.bindLabel}>Format</span>
                <select style={ss.bindSel} value={binding.format || 'none'}
                  onChange={e => setBinding({ format: e.target.value as FormatType })}>
                  {(Object.keys(FORMAT_EXAMPLES) as FormatType[]).map(f => (
                    <option key={f} value={f}>{f}{f !== 'none' ? ' \u2192 ' + FORMAT_EXAMPLES[f] : ''}</option>
                  ))}
                </select>
              </div>
              {(binding.format === 'truncate' || binding.format === 'custom') && (
                <div style={ss.bindRow}>
                  <span style={ss.bindLabel}>{binding.format === 'truncate' ? 'Length' : 'Expr'}</span>
                  <input style={ss.bindSel} value={binding.formatArg || ''}
                    onChange={e => setBinding({ formatArg: e.target.value })}
                    placeholder={binding.format === 'truncate' ? '20' : 'val * 100'}/>
                </div>
              )}
              <div style={ss.bindRow}>
                <span style={ss.bindLabel}>Target prop</span>
                <input style={ss.bindSel} value={binding.targetProp || getDefaultTargetProp(widget.type)}
                  onChange={e => setBinding({ targetProp: e.target.value })}/>
              </div>
              <div style={ss.bindRow}>
                <span style={ss.bindLabel}>Show when</span>
                <input style={{ ...ss.bindSel, fontFamily:'monospace', fontSize:9 }}
                  value={binding.visibilityExpr || ''}
                  onChange={e => setBinding({ visibilityExpr: e.target.value })}
                  placeholder="e.g. status == 'ACTIVE'"/>
              </div>
              {widget.type.includes('ListView') && (
                <div style={ss.bindRow}>
                  <span style={ss.bindLabel}>List bind</span>
                  <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                    <input type="checkbox" checked={!!binding.isListBinding}
                      onChange={e => setBinding({ isListBinding: e.target.checked })}/>
                    <span style={{ fontSize:10, color:'#8892A4' }}>bind array</span>
                  </label>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── Field Chip (draggable, used in Fields panel) ─────────────────────────────

export function FieldChip({ interfaceId, fieldPath, label }: { interfaceId:string; fieldPath:string; label:string }) {
  return (
    <div draggable onDragStart={e => { e.dataTransfer.setData('az/binding', JSON.stringify({ interfaceId, fieldPath })); e.dataTransfer.effectAllowed = 'copy' }}
      style={{ padding:'3px 8px', background:'rgba(30,107,255,0.12)', border:'1px solid rgba(30,107,255,0.3)',
        borderRadius:4, fontSize:10, color:'#4a9edd', cursor:'grab', fontFamily:'monospace',
        userSelect:'none' as const, marginBottom:3, display:'inline-block', marginRight:4 }}>
      {label}
    </div>
  )
}

// ── Breadcrumb helper ────────────────────────────────────────────────────────

function buildAncestry(
  widgetId: string,
  widgets:  Record<string, import('../../types/widget.schema').WidgetNode>
): import('../../types/widget.schema').WidgetNode[] {
  const parentOf: Record<string, string> = {}
  for (const [id, w] of Object.entries(widgets)) {
    for (const childId of (w.children || [])) {
      parentOf[childId] = id
    }
  }
  const chain: import('../../types/widget.schema').WidgetNode[] = []
  let cur: string | undefined = widgetId
  while (cur && widgets[cur]) {
    chain.unshift(widgets[cur])
    cur = parentOf[cur]
    if (chain.length > 12) break
  }
  return chain
}

export default function PropertiesPanel(): JSX.Element {
  const selectedWidgets = useCanvasStore(selectSelectedWidgets)
  const { updateWidget, activeScreenId, selectWidget } = useCanvasStore()
  const activeScreen = useCanvasStore(selectActiveScreen)
  const widget = selectedWidgets.length === 1 ? selectedWidgets[0] : null
  const [rightTab, setRightTab] = React.useState<'props' | 'binding' | 'actions'>('props')

  if (!widget || !activeScreenId) return (
    <div style={s.empty}>
      <div style={{ fontSize:32, marginBottom:10, opacity:0.3 }}>◈</div>
      <div style={{ color:'#555', fontSize:12, fontWeight:600, marginBottom:6 }}>
        No widget selected
      </div>
      <div style={{ color:'#333', fontSize:11, textAlign:'center' as const,
        lineHeight:1.6, maxWidth:160 }}>
        Click any widget on the canvas to inspect and edit its properties
      </div>
    </div>
  )

  // B4: Build breadcrumb ancestry
  const ancestry = activeScreen
    ? buildAncestry(widget.id, activeScreen.widgets)
    : [widget]

  return (
    <div style={s.panel}>
      {/* B4: Breadcrumb */}
      <div style={{
        display:'flex', alignItems:'center', flexWrap:'wrap' as const,
        padding:'4px 10px 3px', gap:2, borderBottom:'1px solid #1e1e2e',
        flexShrink:0, minHeight:24,
      }}>
        {ancestry.map((anc, i) => {
          const isLast = i === ancestry.length - 1
          const label  = anc.type.split('.').pop() || anc.type
          return (
            <React.Fragment key={anc.id}>
              <span
                onClick={() => !isLast && selectWidget(activeScreenId, anc.id)}
                title={anc.type}
                style={{
                  fontSize:10, fontFamily:'monospace',
                  color:      isLast ? '#e0d7ff' : '#555',
                  cursor:     isLast ? 'default' : 'pointer',
                  background: isLast ? '#1e1a33' : 'transparent',
                  padding:    isLast ? '1px 5px' : '1px 2px',
                  borderRadius: isLast ? 3 : 0,
                  whiteSpace:'nowrap' as const,
                }}>
                {label}
              </span>
              {!isLast && <span style={{ fontSize:9, color:'#2a2a3a' }}>›</span>}
            </React.Fragment>
          )
        })}
      </div>

      {/* Widget type header */}
      <div style={s.header}>
        <div style={{ fontSize:11, fontWeight:700, color:'#e0d7ff' }}>{widget.type.split('.').pop()}</div>
        <div style={{ fontSize:9, color:'#444', marginTop:1, fontFamily:'monospace',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
          {widget.id}
        </div>
      </div>

      {/* B3: Props / Binding / Actions tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
        {([
          ['props',   'Props',   '#9d7fe8'],
          ['binding', 'Binding', '#4a9edd'],
          ['actions', 'Actions', '#4caf7d'],
        ] as const).map(([id, label, color]) => (
          <button key={id} onClick={() => setRightTab(id)} style={{
            flex:1, padding:'5px 0', fontSize:10, fontWeight:700,
            cursor:'pointer', border:'none', fontFamily:'system-ui,sans-serif',
            background:   rightTab === id ? '#0d0d1e' : 'transparent',
            color:        rightTab === id ? color : '#444',
            borderBottom: rightTab === id ? `2px solid ${color}` : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto' as const }}>
        {rightTab === 'props' && (
          <>
            <div style={s.propsSection}>
              <div style={s.sectionTitle}>Properties</div>
              {getEditableProps(widget).map(prop => (
                <PropField key={prop.key} propKey={prop.key} propType={prop.type} value={widget.props[prop.key]}
                  onChange={val => updateWidget(activeScreenId, widget.id, { props: { ...widget.props, [prop.key]: val } })}/>
              ))}
            </div>
            {(widget.props.padding !== undefined || widget.type.includes('Container') || widget.type.includes('SizedBox')) && (
              <div style={s.propsSection}>
                <div style={s.sectionTitle}>Layout</div>
                <LayoutEditor widget={widget} screenId={activeScreenId}/>
              </div>
            )}
            {widget.children && widget.children.length > 0 && (
              <div style={{ padding:'4px 12px 6px' }}>
                <span style={{ fontSize:10, color:'#444' }}>
                  {widget.children.length} child{widget.children.length > 1 ? 'ren' : ''}
                </span>
              </div>
            )}
          </>
        )}
        {rightTab === 'binding' && (
          <DataBindingSection widget={widget} screenId={activeScreenId}/>
        )}
        {rightTab === 'actions' && (
          <ActionsPanel widget={widget} screenId={activeScreenId} />
        )}
      </div>
    </div>
  )
}

function PropField({ propKey, propType, value, onChange }: { propKey:string; propType:'text'|'number'|'boolean'|'color'|'select'; value:unknown; onChange:(v:unknown)=>void }) {
  const label = propKey.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())
  return (
    <div style={s.propRow}>
      <div style={s.propLabel}>{label}</div>
      {propType === 'boolean' ? (
        <label style={s.toggle}><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} style={{cursor:'pointer'}}/><span style={{fontSize:11,color:value?'#4caf7d':'#555'}}>{value?'true':'false'}</span></label>
      ) : propType === 'color' ? (
        <div style={s.colorRow}><input type="color" value={typeof value==='object'&&value!==null?(value as any).hex||'#6200EA':'#6200EA'} onChange={e=>onChange({hex:e.target.value})} style={s.colorInput}/><span style={{fontSize:10,color:'#666',fontFamily:'monospace'}}>{typeof value==='object'&&value!==null?(value as any).hex||'':''}</span></div>
      ) : propType === 'number' ? (
        <input type="number" value={typeof value==='number'?value:0} onChange={e=>onChange(parseFloat(e.target.value)||0)} style={s.numInput}/>
      ) : (
        <input type="text" value={value!==null&&value!==undefined?String(value):''} onChange={e=>onChange(e.target.value)} style={s.textInput}/>
      )}
    </div>
  )
}

// ─── LayoutEditor ─────────────────────────────────────────────────────────────

function LayoutEditor({ widget, screenId }: { widget:WidgetNode; screenId:string }) {
  const { updateWidget } = useCanvasStore()
  const padding = (widget.props.padding as any) || {}
  return (
    <div style={{ padding:'4px 0' }}>
      <div style={{ fontSize:10, color:'#555', marginBottom:6 }}>Padding</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
        {['top','right','bottom','left'].map(side => (
          <div key={side} style={s.propRow}><div style={s.propLabel}>{side}</div>
            <input type="number" value={padding[side]??padding.all??0}
              onChange={e=>updateWidget(screenId,widget.id,{props:{...widget.props,padding:{...padding,[side]:parseFloat(e.target.value)||0}}})} style={s.numInput}/>
          </div>
        ))}
      </div>
      {(widget.type.includes('SizedBox')||widget.type.includes('Container'))&&(
        <><div style={{fontSize:10,color:'#555',marginBottom:6,marginTop:8}}>Size</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          {['width','height'].map(dim=>(
            <div key={dim} style={s.propRow}><div style={s.propLabel}>{dim}</div>
              <input type="number" value={typeof widget.props[dim]==='number'?widget.props[dim] as number:0}
                onChange={e=>updateWidget(screenId,widget.id,{props:{...widget.props,[dim]:parseFloat(e.target.value)||0}})} style={s.numInput}/>
            </div>
          ))}
        </div></>
      )}
    </div>
  )
}

// ─── Prop definitions ─────────────────────────────────────────────────────────

type PropDef = { key:string; type:'text'|'number'|'boolean'|'color'|'select' }
function getEditableProps(widget:WidgetNode): PropDef[] {
  const t = widget.type
  if (t.includes('Text'))            return [{ key:'data',type:'text'},{key:'fontSize',type:'number'},{key:'fontWeight',type:'text'},{key:'color',type:'color'}]
  if (t.includes('AppBar'))          return [{ key:'title',type:'text'},{key:'centerTitle',type:'boolean'}]
  if (t.includes('ElevatedButton')||t.includes('TextButton')||t.includes('OutlinedButton')) return [{key:'text',type:'text'},{key:'onPressed',type:'text'}]
  if (t.includes('TextField'))       return [{key:'labelText',type:'text'},{key:'hintText',type:'text'},{key:'obscureText',type:'boolean'},{key:'maxLines',type:'number'}]
  if (t.includes('Image'))           return [{key:'src',type:'text'},{key:'fit',type:'text'}]
  if (t.includes('Icon'))            return [{key:'icon',type:'text'},{key:'size',type:'number'},{key:'color',type:'color'}]
  if (t.includes('Container'))       return [{key:'color',type:'color'},{key:'borderRadius',type:'number'}]
  if (t.includes('Row')||t.includes('Column')) return [{key:'mainAxisAlignment',type:'text'},{key:'crossAxisAlignment',type:'text'}]
  if (t.includes('CircleAvatar'))    return [{key:'radius',type:'number'},{key:'backgroundColor',type:'color'}]
  if (t.includes('ListTile'))        return [{key:'title',type:'text'},{key:'subtitle',type:'text'}]
  if (t.includes('SizedBox'))        return [{key:'width',type:'number'},{key:'height',type:'number'}]
  return Object.keys(widget.props).slice(0,6).map(k=>({key:k,type:typeof widget.props[k]==='boolean'?'boolean':typeof widget.props[k]==='number'?'number':'text'})) as PropDef[]
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string,React.CSSProperties> = {
  panel:{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden' },
  empty:{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#444',textAlign:'center' },
  header:{ padding:'10px 12px',borderBottom:'1px solid #1e1e2e' },
  typeTag:{ margin:'6px 12px',padding:'3px 8px',background:'#0f0f1e',borderRadius:4,fontSize:9,color:'#555',fontFamily:'monospace',border:'1px solid #1e1e2e' },
  propsSection:{ padding:'8px 12px',borderBottom:'1px solid #1e1e2e' },
  sectionTitle:{ fontSize:9,fontWeight:700,color:'#555',letterSpacing:'0.08em',textTransform:'uppercase' as const,marginBottom:8 },
  propRow:{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,gap:8 },
  propLabel:{ fontSize:10,color:'#666',flexShrink:0,width:80,textOverflow:'ellipsis',overflow:'hidden',whiteSpace:'nowrap' as const },
  textInput:{ flex:1,padding:'3px 6px',background:'#0a0a14',border:'1px solid #2a2a3a',borderRadius:4,fontSize:11,color:'#d4d4d4',outline:'none',fontFamily:'monospace',minWidth:0 },
  numInput:{ width:60,padding:'3px 6px',background:'#0a0a14',border:'1px solid #2a2a3a',borderRadius:4,fontSize:11,color:'#d4d4d4',outline:'none',textAlign:'right' as const },
  toggle:{ display:'flex',alignItems:'center',gap:6,cursor:'pointer' },
  colorRow:{ display:'flex',alignItems:'center',gap:6 },
  colorInput:{ width:28,height:20,border:'none',borderRadius:4,cursor:'pointer',padding:0 },
  childrenBadge:{ margin:'8px 12px',padding:'4px 10px',background:'#0f0f1e',borderRadius:6,fontSize:10,color:'#555',textAlign:'center' as const },
}
const ss: Record<string,React.CSSProperties> = {
  bindSection:{ padding:'10px 12px',borderTop:'1px solid #1e1e2e' },
  bindHeader:{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 },
  secTitle:{ fontSize:9,fontWeight:700,color:'#1E6BFF',letterSpacing:'0.08em',textTransform:'uppercase' as const },
  modeBtn:{ padding:'2px 7px',border:'1px solid #1e2d3d',borderRadius:4,fontSize:11,cursor:'pointer',fontFamily:'monospace' },
  dropZone:{ minHeight:40,border:'1px dashed',borderRadius:7,padding:'8px 10px',marginBottom:8,transition:'all 0.15s' },
  exprInput:{ width:'100%',padding:'5px 8px',background:'#050510',border:'1px solid rgba(30,107,255,0.4)',borderRadius:6,fontSize:11,color:'#4caf7d',outline:'none',fontFamily:'monospace',boxSizing:'border-box' as const },
  suggestions:{ position:'absolute' as const,top:'100%',left:0,right:0,background:'#0d1117',border:'1px solid #1e2d3d',borderRadius:6,zIndex:100,maxHeight:160,overflowY:'auto' as const },
  suggestion:{ padding:'5px 10px',cursor:'pointer',borderBottom:'1px solid #0d1117' },
  bindRow:{ display:'flex',alignItems:'center',gap:6,marginBottom:5 },
  bindLabel:{ fontSize:10,color:'#555',width:62,flexShrink:0 },
  bindSel:{ flex:1,padding:'3px 6px',background:'#0a0a14',border:'1px solid #1e2d3d',borderRadius:4,fontSize:10,color:'#d4d4d4',outline:'none',minWidth:0,fontFamily:'system-ui,sans-serif' },
}
