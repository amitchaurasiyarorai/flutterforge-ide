import React, { useRef, useState, useCallback } from 'react'
import { useCanvasStore, selectActiveScreen } from '../../store/canvas.store'
import type { WidgetNode } from '../../types/widget.schema'
import type { PaletteItem } from './WidgetPalette'
import type { NativePlugin } from './NativePluginPalette'

interface Props {
  draggedItem: PaletteItem | null
  onDragEnd: () => void
  draggedPlugin?: NativePlugin | null
  onPluginDrop?: (plugin: NativePlugin) => void
  onSaveAsComponent?: (widgetIds: string[], screenId: string) => void
}

// ── Device presets ────────────────────────────────────────────────────────────
const DEVICES = [
  { id: 'iphone15',  label: 'iPhone 15',  w: 390, h: 844, radius: 44, notch: 'island' },
  { id: 'iphoneSE',  label: 'iPhone SE',  w: 375, h: 667, radius: 20, notch: 'none'   },
  { id: 'android',   label: 'Android',    w: 360, h: 800, radius: 28, notch: 'notch'  },
  { id: 'pixel',     label: 'Pixel 8',    w: 393, h: 851, radius: 40, notch: 'hole'   },
  { id: 'tablet',    label: 'Tablet',     w: 768, h: 1024, radius: 12, notch: 'none'  },
  { id: 'web',       label: 'Web',        w: 1280, h: 800, radius: 4,  notch: 'none'  },
] as const
type DeviceId = typeof DEVICES[number]['id']

export default function Canvas({ draggedItem, onDragEnd, draggedPlugin, onPluginDrop, onSaveAsComponent }: Props): JSX.Element {
  const activeScreen = useCanvasStore(selectActiveScreen)
  const { addWidget, selectWidget, clearSelection, selection, activeScreenId, zoom, setZoom, gridEnabled } = useCanvasStore()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dropTarget,   setDropTarget]   = useState<string | null>(null)
  const [ctxMenu,      setCtxMenu]      = useState<{ x: number; y: number; widgetId: string } | null>(null)
  const [deviceId,     setDeviceId]     = useState<DeviceId>('iphone15')
  const hasDrag = !!draggedItem || !!draggedPlugin

  const device = DEVICES.find(d => d.id === deviceId) || DEVICES[0]

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  const handleDrop = useCallback((e: React.DragEvent, parentId?: string) => {
    e.preventDefault(); e.stopPropagation(); setDropTarget(null)
    if (draggedPlugin && onPluginDrop) { onPluginDrop(draggedPlugin); return }
    if (!draggedItem || !activeScreenId) return
    const id = addWidget(activeScreenId, { type: draggedItem.type, props: { ...draggedItem.defaultProps }, children: draggedItem.canHaveChildren ? [] : undefined }, parentId)
    selectWidget(activeScreenId, id)
    onDragEnd()
  }, [draggedItem, draggedPlugin, onPluginDrop, activeScreenId, addWidget, selectWidget, onDragEnd])

  const handleDragOver = useCallback((e: React.DragEvent, widgetId?: string) => {
    e.preventDefault()
    if (hasDrag) setDropTarget(widgetId ?? 'canvas')
  }, [hasDrag])

  const handleDragLeave = useCallback(() => setDropTarget(null), [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(Math.min(2, Math.max(0.25, zoom + (e.deltaY > 0 ? -0.1 : 0.1)))) }
  }, [zoom, setZoom])

  if (!activeScreen) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#444', gap:12 }}>
      <div style={{ fontSize:40 }}>◈</div>
      <div style={{ fontSize:15, color:'#555', fontWeight:600 }}>No screen selected</div>
      <div style={{ fontSize:12, color:'#333' }}>Create a screen or open a project</div>
    </div>
  )

  const rootWidget  = activeScreen.rootWidgetId ? (activeScreen.widgets || {})[activeScreen.rootWidgetId] : null
  const screenBg    = ((activeScreen.widgets || {})[activeScreen.rootWidgetId ?? '']?.props as any)?.backgroundColor?.hex || '#FFFFFF'
  const isDropOnCanvas = dropTarget === 'canvas' && hasDrag

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#0d0d1a', overflow:'hidden' }}
      onWheel={handleWheel} onClick={closeCtxMenu}>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div style={{ position:'fixed' as const, top: ctxMenu.y, left: ctxMenu.x, zIndex:3000,
          background:'#0d0d1a', border:'1px solid #2a2a3a', borderRadius:10,
          boxShadow:'0 8px 32px rgba(0,0,0,0.8)', minWidth:200, overflow:'hidden' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ padding:'6px 0' }}>
            <button onClick={() => {
              if (!activeScreenId) return
              const ids = selection.widgetIds.includes(ctxMenu.widgetId) ? selection.widgetIds : [ctxMenu.widgetId]
              onSaveAsComponent?.(ids, activeScreenId); closeCtxMenu()
            }} style={ctxItem}>
              <span style={{ fontSize:14 }}>◈</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#9d7fe8' }}>Save as Component</div>
                <div style={{ fontSize:10, color:'#555', marginTop:1 }}>
                  {selection.widgetIds.length > 1 ? `Save ${selection.widgetIds.length} selected widgets` : 'Save to IDE library'}
                </div>
              </div>
            </button>
            <div style={{ height:1, background:'#1e1e2e', margin:'4px 0' }} />
            <button onClick={() => {
              if (!activeScreenId || !activeScreen) return
              const srcW = activeScreen.widgets[ctxMenu.widgetId]
              if (!srcW) return
              const cloned = JSON.parse(JSON.stringify(srcW))
              const newId  = addWidget(activeScreenId, { type: cloned.type, props: cloned.props, children: cloned.children ? [] : undefined })
              selectWidget(activeScreenId, newId); closeCtxMenu()
            }} style={ctxItem}>
              <span style={{ fontSize:14 }}>⊕</span>
              <div><div style={{ fontSize:12, color:'#ccc' }}>Duplicate</div></div>
            </button>
            <div style={{ height:1, background:'#1e1e2e', margin:'4px 0' }} />
            <button onClick={() => {
              if (!activeScreenId) return
              const ids = selection.widgetIds.includes(ctxMenu.widgetId) ? selection.widgetIds : [ctxMenu.widgetId]
              ids.forEach(id => useCanvasStore.getState().deleteWidget(activeScreenId, id)); closeCtxMenu()
            }} style={{ ...ctxItem, color:'#e05252' }}>
              <span style={{ fontSize:14 }}>✕</span>
              <div><div style={{ fontSize:12, color:'#e05252' }}>
                {selection.widgetIds.length > 1 ? `Delete ${selection.widgetIds.length} widgets` : 'Delete widget'}
              </div></div>
            </button>
          </div>
        </div>
      )}

      {/* ── Canvas header bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px',
        background:'#0a0a14', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>

        {/* Screen name + route */}
        <span style={{ fontSize:12, color:'#888' }}>{activeScreen.name}</span>
        <span style={{ fontSize:11, color:'#444' }}>{activeScreen.route}</span>

        {/* Device selector */}
        <div style={{ display:'flex', gap:3, marginLeft:8 }}>
          {DEVICES.map(d => (
            <button key={d.id} onClick={() => setDeviceId(d.id)}
              title={`${d.label} · ${d.w}×${d.h}`}
              style={{
                padding:'2px 7px', borderRadius:4, fontSize:10, cursor:'pointer',
                border:`1px solid ${deviceId === d.id ? '#4a9edd' : '#1e2d3d'}`,
                background: deviceId === d.id ? '#0a1a2a' : 'transparent',
                color: deviceId === d.id ? '#4a9edd' : '#444',
                fontFamily:'system-ui,sans-serif',
              }}>
              {d.label}
            </button>
          ))}
        </div>

        {draggedPlugin && <span style={{ fontSize:11, color:'#4caf7d', marginLeft:8 }}>Drop {draggedPlugin.name} →</span>}

        <div style={{ flex:1 }} />

        {/* Zoom controls */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={() => setZoom(Math.max(0.25, zoom-0.1))}
            style={zoomBtn}>−</button>
          <span style={{ fontSize:11, color:'#666', minWidth:40, textAlign:'center' as const }}>
            {Math.round(zoom*100)}%
          </span>
          <button onClick={() => setZoom(Math.min(2, zoom+0.1))}
            style={zoomBtn}>+</button>
          <button onClick={() => setZoom(1)} style={zoomBtn} title="Reset zoom">⊙</button>
        </div>
        <span style={{ fontSize:11, color:'#444', marginLeft:4 }}>
          {Object.keys(activeScreen.widgets || {}).length} widgets
        </span>
      </div>

      {/* ── Canvas viewport ── */}
      <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center',
        overflowY:'auto' as const, overflowX:'auto' as const, padding:'32px 32px 48px',
        background:'#0d0d1a' }}>
        <div style={{ transform:`scale(${zoom})`, transformOrigin:'top center', flexShrink:0 }}>

          {/* ── Device frame ── */}
          <div style={{
            width: device.w,
            borderRadius: device.radius,
            overflow: 'hidden',
            // Double ring bezel effect
            boxShadow: `
              0 0 0 2px #1a1a2a,
              0 0 0 10px #0d0d18,
              0 0 0 12px #1a1a2a,
              0 36px 90px rgba(0,0,0,0.95),
              0 8px 24px rgba(0,0,0,0.6)
            `,
            display: 'flex', flexDirection: 'column' as const,
            flexShrink: 0,
            background: '#080810',
            outline: isDropOnCanvas ? '2px dashed #4caf7d' : 'none',
            outlineOffset: 6,
          }}
            onDrop={e => { if (!rootWidget) handleDrop(e) }}
            onDragOver={e => { if (!rootWidget) handleDragOver(e) }}
            onDragLeave={handleDragLeave}
          >

            {/* ── Status bar ── */}
            <div style={{
              height: device.notch === 'island' ? 54 : device.notch === 'notch' ? 44 : 28,
              background: screenBg,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              padding: '0 24px 6px', flexShrink: 0, position: 'relative' as const,
            }}>
              {/* Dynamic Island */}
              {device.notch === 'island' && (
                <div style={{
                  position: 'absolute' as const, top: 10, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 120, height: 34, borderRadius: 20,
                  background: '#000', zIndex: 10,
                }}/>
              )}
              {/* Notch */}
              {device.notch === 'notch' && (
                <div style={{
                  position: 'absolute' as const, top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 140, height: 28, borderRadius: '0 0 18px 18px',
                  background: '#000', zIndex: 10,
                }}/>
              )}
              {/* Punch hole */}
              {device.notch === 'hole' && (
                <div style={{
                  position: 'absolute' as const, top: 10, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#000', zIndex: 10,
                }}/>
              )}
              <span style={{ fontSize:11, fontWeight:700, color: isLight(screenBg) ? '#000' : '#fff', zIndex:1 }}>9:41</span>
              <div style={{ display:'flex', gap:4, fontSize:10, color: isLight(screenBg) ? '#000' : '#fff', zIndex:1 }}>
                <span>▲▲▲</span><span>●</span><span>■■</span>
              </div>
            </div>

            {/* ── Screen area (drop target) ── */}
            <div
              ref={canvasRef}
              style={{
                backgroundColor: screenBg,
                minHeight: device.h - (device.notch === 'island' ? 54 : device.notch === 'notch' ? 44 : 28) - 30,
                overflowY: 'auto' as const,
                display: 'flex', flexDirection: 'column' as const,
                position: 'relative' as const,
                // Drop zone highlight
                outline: isDropOnCanvas ? '3px dashed #4caf7d88' : 'none',
                outlineOffset: -3,
              }}
              onDrop={e => handleDrop(e)}
              onDragOver={e => handleDragOver(e)}
              onDragLeave={handleDragLeave}
              onClick={() => clearSelection()}
            >
              {gridEnabled && (
                <div style={{
                  position:'absolute', inset:0,
                  backgroundImage:'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
                  backgroundSize:'8px 8px', pointerEvents:'none', zIndex:0,
                }}/>
              )}

              {rootWidget ? (
                <WidgetRenderer
                  widget={rootWidget} screen={activeScreen}
                  selectedIds={selection.widgetIds} dropTarget={dropTarget}
                  screenId={activeScreenId!} onDrop={handleDrop}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                  hasDraggedItem={hasDrag}
                  onContextMenu={(e, id) => setCtxMenu({ x: e.clientX, y: e.clientY, widgetId: id })}
                />
              ) : (
                <div onDrop={e => handleDrop(e)} onDragOver={e => handleDragOver(e)}
                  style={{
                    flex:1, display:'flex', flexDirection:'column' as const,
                    alignItems:'center', justifyContent:'center', gap:12,
                    border:`2px dashed ${isDropOnCanvas ? '#4caf7d' : '#1E3A5F'}`,
                    borderRadius:8, margin:16, padding:32, minHeight:200,
                    background: isDropOnCanvas ? 'rgba(76,175,61,0.04)' : 'transparent',
                    transition:'all 0.15s',
                  }}>
                  <div style={{ fontSize:28, opacity:0.3 }}>⬡</div>
                  <div style={{ fontSize:12, color:'#2A3A5A', textAlign:'center' as const }}>
                    Drag a widget from the palette
                  </div>
                </div>
              )}
            </div>

            {/* ── Home indicator ── */}
            <div style={{
              height: 30, display:'flex', alignItems:'center', justifyContent:'center',
              background: screenBg, flexShrink: 0,
            }}>
              <div style={{ width:134, height:5, borderRadius:3, background:'rgba(0,0,0,0.2)' }}/>
            </div>
          </div>

          {/* ── Dimensions label below frame ── */}
          <div style={{
            textAlign:'center' as const, marginTop:12, fontSize:11,
            color:'#444', fontFamily:'monospace', letterSpacing:'0.04em',
          }}>
            {device.w} × {device.h} · {device.label}
          </div>
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div style={{ padding:'3px 12px', fontSize:9, color:'#333',
        textAlign:'center' as const, background:'#0a0a14', flexShrink:0 }}>
        Ctrl+Scroll to zoom · Drag from palette · Right-click widget for options
      </div>
    </div>
  )
}

// ── Utility: is a hex color light? ───────────────────────────────────────────
function isLight(hex: string): boolean {
  try {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    return (0.299*r + 0.587*g + 0.114*b) > 160
  } catch { return false }
}


const zoomBtn: React.CSSProperties = {
  width:22, height:22, background:'#1a1a2e', border:'1px solid #2a2a3a',
  borderRadius:4, color:'#888', cursor:'pointer', fontSize:14,
  display:'flex', alignItems:'center', justifyContent:'center',
  fontFamily:'system-ui,sans-serif',
}

const ctxItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', padding: '8px 14px', background: 'none',
  border: 'none', cursor: 'pointer', textAlign: 'left' as const,
  fontFamily: 'system-ui, sans-serif', color: '#ccc',
  transition: 'background 0.1s',
}

const CONTAINERS = ['Scaffold','Container','Row','Column','Stack','Center','Padding','Expanded','Flexible','Card','ListView','GridView','SingleChildScrollView','SafeArea','SizedBox']

function isContainer(t: string) { return CONTAINERS.some(c => t.includes(c)) }

interface RP {
  widget: WidgetNode; screen: ReturnType<typeof selectActiveScreen>
  selectedIds: string[]; dropTarget: string|null; screenId: string
  onDrop:(e:React.DragEvent,parentId?:string)=>void
  onDragOver:(e:React.DragEvent,widgetId?:string)=>void
  onDragLeave:()=>void; hasDraggedItem:boolean; depth?:number
  onContextMenu:(e:React.MouseEvent,widgetId:string)=>void
}

function WidgetRenderer({ widget, screen, selectedIds, dropTarget, screenId, onDrop, onDragOver, onDragLeave, hasDraggedItem, onContextMenu, depth=0 }: RP): JSX.Element {
  const { selectWidget, deleteWidget } = useCanvasStore()
  const isSelected = selectedIds.includes(widget.id)
  const isDropTarget = dropTarget === widget.id && hasDraggedItem
  const canChildren = isContainer(widget.type)
  const children = widget.children || []

  if (widget.type.includes('BottomNavigationBar')) {
    const p = widget.props as any
    const bg = p.backgroundColor?.hex || '#0F1E35'
    const sel = p.selectedItemColor?.hex || '#1E6BFF'
    const unsel = p.unselectedItemColor?.hex || '#8892A4'
    const items = p.items || [{label:'Home'},{label:'Transfer'},{label:'Cards'},{label:'Loans'},{label:'Profile'}]
    return (
      <div
        onClick={e=>{e.stopPropagation();selectWidget(screenId,widget.id)}}
        onContextMenu={e=>{e.preventDefault();e.stopPropagation();selectWidget(screenId,widget.id);onContextMenu(e,widget.id)}}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-around', padding:'8px 0 4px', background:bg, borderTop:`1px solid ${unsel}33`, flexShrink:0, outline:isSelected?'2px solid #7c5cbf':undefined }}>
        {items.map((item: any, i: number) => (
          <div key={i} style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:3, padding:'0 8px' }}>
            <span style={{ fontSize:18, color:i===0?sel:unsel }}>◈</span>
            <span style={{ fontSize:10, color:i===0?sel:unsel, fontWeight:i===0?600:400 }}>{item.label||''}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      onClick={e=>{e.stopPropagation();selectWidget(screenId,widget.id,e.metaKey||e.ctrlKey)}}
      onContextMenu={e=>{e.preventDefault();e.stopPropagation();selectWidget(screenId,widget.id);onContextMenu(e,widget.id)}}
      onDrop={canChildren?e=>onDrop(e,widget.id):undefined}
      onDragOver={canChildren?e=>onDragOver(e,widget.id):undefined}
      onDragLeave={canChildren?onDragLeave:undefined}
      style={{ ...getContainerStyle(widget), outline:isSelected?'2px solid #7c5cbf':isDropTarget?'2px dashed #4caf7d':undefined, outlineOffset:'1px', position:'relative', cursor:'pointer' }}
    >
      {isSelected && (
        <div style={{ position:'absolute', top:0, left:0, right:0, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#7c5cbf', padding:'2px 7px', zIndex:100, borderRadius:'4px 4px 0 0' }}>
          <span style={{ fontSize:9, color:'#fff', fontWeight:700 }}>{widget.name||widget.type.split('.').pop()}</span>
          <button onClick={e=>{e.stopPropagation();deleteWidget(screenId,widget.id)}} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:12, padding:'0 2px', lineHeight:1 }}>✕</button>
        </div>
      )}
      <WidgetVisual widget={widget} />
      {canChildren && (
        <>
          {children.map(childId => {
            const child = screen?.widgets?.[childId]
            if (!child) return null
            return <WidgetRenderer key={childId} widget={child} screen={screen} selectedIds={selectedIds} dropTarget={dropTarget} screenId={screenId} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} hasDraggedItem={hasDraggedItem} onContextMenu={onContextMenu} depth={depth+1} />
          })}
          {hasDraggedItem && <div onDrop={e=>onDrop(e,widget.id)} onDragOver={e=>onDragOver(e,widget.id)} style={{ border:`2px dashed ${isDropTarget?'#4caf7d':'#1E3A5F'}`, borderRadius:6, padding:'3px', margin:'2px', display:'flex', alignItems:'center', justifyContent:'center', color:isDropTarget?'#4caf7d':'#2A3A5A', fontSize:11, background:isDropTarget?'rgba(76,175,61,0.05)':'transparent' }}>+</div>}
          {!children.length && !hasDraggedItem && <div style={{ minHeight:4 }}/>}
        </>
      )}
    </div>
  )
}

function WidgetVisual({ widget }: { widget: WidgetNode }): JSX.Element | null {
  const type = widget.type
  const p    = widget.props as Record<string,any>
  const dec  = p.decoration || {}
  const st   = p.style || {}
  const color      = st.color?.hex || p.color?.hex || p.foregroundColor?.hex
  const fontSize   = st.fontSize   || p.fontSize   || 14
  const fontWeight = st.fontWeight || p.fontWeight  || 'normal'
  const mockVal    = (widget as any).apiBinding?.mockPreview

  // ── AppBar ──────────────────────────────────────────────
  if (type.includes('AppBar')) {
    const bg = p.backgroundColor?.hex || '#060E1A'
    const fg = p.foregroundColor?.hex || '#FFFFFF'
    return (
      <div style={{ background:bg, color:fg, height:56, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0, width:'100%' }}>
        {p.leading && <span style={{ fontSize:20, opacity:0.8 }}>←</span>}
        <span style={{ fontSize:17, fontWeight:600, flex:1, textAlign:p.centerTitle?'center':'left' as const, color:fg }}>
          {String(p.title || 'AppBar')}
        </span>
        {(p.actions||[]).length > 0 && <span style={{ fontSize:16, opacity:0.7, color:fg }}>⋮</span>}
      </div>
    )
  }

  // ── Text ────────────────────────────────────────────────
  if (type.includes('Text') && !type.includes('TextField') && !type.includes('TextButton')) {
    const displayVal = mockVal || String(p.data || '')
    const align = (st.textAlign || p.textAlign || 'left') as any
    const ls    = st.letterSpacing || p.letterSpacing
    return (
      <span style={{ fontSize, fontWeight, color: color || '#FFFFFF', letterSpacing:ls,
        textAlign: align, display:'block', lineHeight: st.height || 1.5,
        whiteSpace:'pre-wrap' as const }}>
        {displayVal}
      </span>
    )
  }

  // ── ElevatedButton ──────────────────────────────────────
  if (type.includes('ElevatedButton')) {
    const bg = p.style?.backgroundColor?.hex || p.backgroundColor?.hex || '#1E6BFF'
    const fg = p.style?.foregroundColor?.hex || p.foregroundColor?.hex || '#FFFFFF'
    return (
      <div style={{ background:bg, color:fg, padding:'0 24px', borderRadius:12,
        fontSize:15, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center',
        width:'100%', height:52, boxShadow:`0 4px 12px ${bg}55` }}>
        {String(p.text || p.label || 'Button')}
      </div>
    )
  }

  // ── OutlinedButton ──────────────────────────────────────
  if (type.includes('OutlinedButton')) {
    const fg = p.style?.foregroundColor?.hex || p.foregroundColor?.hex || '#1E6BFF'
    return (
      <div style={{ border:`1.5px solid ${fg}`, color:fg, padding:'0 24px', borderRadius:12,
        fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center',
        width:'100%', height:48, background:'transparent' }}>
        {String(p.text || p.label || 'Button')}
      </div>
    )
  }

  // ── TextButton ──────────────────────────────────────────
  if (type.includes('TextButton'))
    return <div style={{ color:p.style?.foregroundColor?.hex||p.foregroundColor?.hex||'#1E6BFF', padding:'8px 4px', fontSize:14, fontWeight:600, display:'inline-flex', alignItems:'center' }}>{String(p.text||'Button')}</div>

  // ── TextField ───────────────────────────────────────────
  if (type.includes('TextField')) {
    const fbg     = p.fillColor?.hex   || '#0A1628'
    const fborder = '#1E3A5F'
    const flabel  = '#8899AA'
    return (
      <div style={{ border:`1.5px solid ${fborder}`, borderRadius:10, padding:'10px 14px', background:fbg, width:'100%' }}>
        {p.labelText && <div style={{ fontSize:11, color:flabel, fontWeight:500, marginBottom:4 }}>{String(p.labelText)}</div>}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {p.prefixIcon && <span style={{ color:flabel, fontSize:14 }}>◈</span>}
          <span style={{ fontSize:13, color:'#FFFFFF', opacity:0.4 }}>
            {p.obscureText ? '••••••••' : String(p.hintText || 'Enter text...')}
          </span>
        </div>
      </div>
    )
  }

  // ── ListTile ────────────────────────────────────────────
  if (type.includes('ListTile')) {
    const titleVal    = mockVal || String(p.title || 'Title')
    const subtitleVal = String(p.subtitle || '')
    return (
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, width:'100%' }}>
        {p.leading && (
          <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
            background:'rgba(30,107,255,0.15)', display:'flex', alignItems:'center',
            justifyContent:'center', color:'#1E6BFF', fontSize:18 }}>◈</div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, color:'#FFFFFF', fontWeight:500,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{titleVal}</div>
          {subtitleVal && <div style={{ fontSize:12, color:'#8899AA', marginTop:2,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{subtitleVal}</div>}
        </div>
        {p.trailing && <span style={{ fontSize:14, color:'#8899AA', flexShrink:0 }}>›</span>}
      </div>
    )
  }

  // ── CircleAvatar ────────────────────────────────────────
  if (type.includes('CircleAvatar')) {
    const r  = p.radius || 24
    const bg = p.backgroundColor?.hex || '#1E6BFF'
    const displayVal = mockVal || String(p.child || p.initials || '?')
    return (
      <div style={{ width:r*2, height:r*2, borderRadius:'50%', flexShrink:0, background:bg,
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#FFFFFF', fontSize:r*0.55, fontWeight:700 }}>
        {displayVal}
      </div>
    )
  }

  // ── Icon / IconButton ────────────────────────────────────
  if (type.includes('Icon') || type.includes('IconButton')) {
    const ic    = String(p.icon || '')
    const sz    = p.size || 24
    const icClr = p.color?.hex || '#8892A4'
    // Map common icon names to emoji/unicode for canvas preview
    const iconMap: Record<string,string> = {
      'Icons.notifications_outlined':'🔔','Icons.notifications':'🔔',
      'Icons.home':'🏠','Icons.home_outlined':'🏠',
      'Icons.send':'↗','Icons.send_outlined':'↗',
      'Icons.credit_card':'💳','Icons.credit_card_outlined':'💳',
      'Icons.person_outline':'👤','Icons.person':'👤','Icons.person_outlined':'👤',
      'Icons.account_balance':'🏦','Icons.account_balance_wallet':'💰',
      'Icons.receipt_long':'🧾','Icons.receipt':'🧾',
      'Icons.fingerprint':'👆','Icons.lock_outline':'🔒','Icons.lock_reset':'🔓','Icons.lock':'🔒',
      'Icons.phone':'📱','Icons.phone_android':'📱','Icons.phone_iphone':'📱',
      'Icons.email':'✉','Icons.email_outlined':'✉',
      'Icons.location_on_outlined':'📍','Icons.location_on':'📍',
      'Icons.verified_user':'✅','Icons.shield_outlined':'🛡',
      'Icons.settings_outlined':'⚙','Icons.settings':'⚙',
      'Icons.help_outline':'❓','Icons.info_outline':'ℹ',
      'Icons.restaurant':'🍽','Icons.savings':'💰',
      'Icons.shopping_bag':'🛍','Icons.flight':'✈',
      'Icons.bolt':'⚡','Icons.flash_on':'⚡',
      'Icons.schedule':'⏰','Icons.speed':'🚀',
      'Icons.currency_rupee':'₹','Icons.notes':'📝',
      'Icons.tune':'🎛','Icons.block':'🚫',
      'Icons.report_problem_outlined':'⚠',
      'Icons.chevron_right':'›','Icons.arrow_forward_ios':'›',
      'Icons.more_vert':'⋮','Icons.add':'＋',
      'Icons.auto_awesome':'✨','Icons.star':'⭐','Icons.star_outline':'☆',
      'Icons.dashboard':'⬡','Icons.dashboard_outlined':'⬡',
      'Icons.login':'→','Icons.logout':'←',
      'Icons.explore':'🧭','Icons.explore_outlined':'🧭',
      'Icons.palette':'🎨','Icons.palette_outlined':'🎨',
      'Icons.sync_alt':'⇄','Icons.sync':'⇄',
      'Icons.account_tree_outlined':'🌿','Icons.account_tree':'🌿',
      'Icons.touch_app':'👆','Icons.gesture':'👆',
      'Icons.text_fields':'T','Icons.title':'T',
      'Icons.edit':'✏','Icons.edit_outlined':'✏',
      'Icons.search':'🔍','Icons.search_outlined':'🔍',
      'Icons.close':'✕','Icons.cancel':'✕',
      'Icons.check':'✓','Icons.check_circle':'✅',
      'Icons.arrow_back':'←','Icons.arrow_back_ios':'←',
      'Icons.arrow_forward':'→',
      'Icons.visibility':'👁','Icons.visibility_off':'🙈',
      'Icons.favorite':'❤','Icons.favorite_border':'🤍',
      'Icons.share':'⤴','Icons.download':'⬇','Icons.upload':'⬆',
      'Icons.calendar_today':'📅','Icons.date_range':'📅',
      'Icons.map':'🗺','Icons.place':'📍',
      'Icons.camera':'📷','Icons.photo':'🖼','Icons.image':'🖼',
      'Icons.video_call':'📹','Icons.mic':'🎙',
      'Icons.attach_file':'📎','Icons.link':'🔗',
      'Icons.filter_list':'⚟','Icons.sort':'⇅',
      'Icons.refresh':'↻','Icons.undo':'↩','Icons.redo':'↪',
      'Icons.copy':'⎘','Icons.paste':'📋','Icons.cut':'✂',
      'Icons.warning':'⚠','Icons.error':'⛔','Icons.info':'ℹ',
    }
    const display = iconMap[ic] || ic.replace('Icons.','').replace(/_/g,' ').slice(0,2) || '◈'
    return (
      <div style={{ color:icClr, fontSize:sz, display:'flex', alignItems:'center',
        justifyContent:'center', minWidth:sz, minHeight:sz, lineHeight:1 }}>
        {display}
      </div>
    )
  }

  // ── Divider ─────────────────────────────────────────────
  if (type.includes('Divider'))
    return <hr style={{ border:'none', borderTop:`${p.thickness||1}px solid ${p.color?.hex||'#1E2D3D'}`, margin:'4px 0', width:'100%' }}/>

  // ── Image ───────────────────────────────────────────────
  if (type.includes('Image'))
    return <div style={{ background:'#0D1B2A', borderRadius:8, display:'flex', flexDirection:'column' as const,
      alignItems:'center', justifyContent:'center', minHeight:p.height||120,
      width:p.width||'100%', color:'#4A6A8A', gap:6, border:'1px dashed #1E3A5F' }}>
      <span style={{ fontSize:28 }}>🖼</span>
      <span style={{ fontSize:11, color:'#4A6A8A' }}>{p.src ? String(p.src).slice(0,20)+'…' : 'Image'}</span>
    </div>

  // ── Checkbox ─────────────────────────────────────────────
  if (type.includes('Checkbox')) {
    const cc = p.activeColor?.hex || '#1E6BFF'
    return <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0' }}>
      <div style={{ width:22, height:22, border:`2px solid ${cc}`, borderRadius:4,
        background:p.value?cc:'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14 }}>
        {p.value ? '✓' : ''}
      </div>
      {p.label && <span style={{ fontSize:14, color:'#FFFFFF' }}>{String(p.label)}</span>}
    </div>
  }

  // ── Switch ───────────────────────────────────────────────
  if (type.includes('Switch')) {
    const sc = p.activeColor?.hex || '#1E6BFF'
    return <div style={{ width:50, height:28, borderRadius:14, background:p.value?sc:'#2A3A5A',
      display:'flex', alignItems:'center', padding:'0 3px', justifyContent:p.value?'flex-end':'flex-start' }}>
      <div style={{ width:22, height:22, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.4)' }}/>
    </div>
  }

  // ── BottomNavigationBar — handled in WidgetRenderer ──────
  if (type.includes('BottomNavigationBar')) return null

  // ── Native plugins ───────────────────────────────────────
  if (type.includes('native.')) {
    const map: Record<string,[string,string]> = {
      'native.Camera':['📷','Camera'],'native.AudioPlayer':['🔊','Audio'],
      'native.VideoPlayer':['▶','Video'],'native.FilePicker':['📁','Files'],
      'native.QrScanner':['▦','QR'],'native.BiometricAuth':['👆','Biometric'],
      'native.PushNotifications':['🔔','Push'],'native.Location':['📍','GPS'],
      'native.Bluetooth':['⬡','BT'],'native.Share':['↗','Share'],
    }
    const [icon,name] = map[type] || ['◈', type.split('.').pop()||'']
    return <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
      background:'#0D1B2A', borderRadius:10, border:'1px solid #1E3A5F' }}>
      <span style={{ fontSize:20 }}>{icon}</span>
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#FFFFFF' }}>{name}</div>
        <div style={{ fontSize:10, color:'#8899AA' }}>Native Plugin</div>
      </div>
    </div>
  }

  // ── New Sprint 2 widgets ──────────────────────────────────

  if (type.includes('Badge')) {
    const bg = p.backgroundColor?.hex || '#E05252'
    return <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
      minWidth:20, height:20, borderRadius:10, background:bg, color:'#fff',
      fontSize:10, fontWeight:700, padding:'0 5px' }}>{String(p.label||'1')}</div>
  }

  if (type.includes('Chip') && !type.includes('FilterChip')) {
    const sel = p.selected
    return <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px',
      borderRadius:20, background: sel ? '#1E6BFF22' : '#1a1a2e',
      border:`1px solid ${sel ? '#1E6BFF' : '#2a2a3a'}`, fontSize:12, color:'#d4d4d4' }}>
      {String(p.label||'Chip')}
    </div>
  }

  if (type.includes('LinearProgressIndicator')) {
    const pct = typeof p.value === 'number' ? p.value*100 : 60
    const clr = p.color?.hex || '#1E6BFF'
    return <div style={{ width:'100%', height:4, borderRadius:2, background:p.backgroundColor?.hex||'#1E2D3D' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:clr, borderRadius:2 }}/>
    </div>
  }

  if (type.includes('CircularProgressIndicator')) {
    const clr = p.color?.hex || '#1E6BFF'
    return <div style={{ width:36, height:36, borderRadius:'50%',
      border:`${p.strokeWidth||3}px solid #1E2D3D`, borderTopColor:clr, display:'inline-block' }}/>
  }

  if (type.includes('SearchBar')) {
    return <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
      background:'#1a1a2e', borderRadius:28, border:'1px solid #2a2a3a', width:'100%' }}>
      <span style={{ fontSize:16 }}>🔍</span>
      <span style={{ fontSize:13, color:'#555' }}>{String(p.hintText||'Search...')}</span>
    </div>
  }

  if (type.includes('FilledButton')) {
    const bg = p.backgroundColor?.hex || '#1E6BFF'
    return <div style={{ background:bg, color:'#fff', padding:'0 24px', borderRadius:50,
      fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', height:44 }}>
      {String(p.text||'Button')}
    </div>
  }

  if (type.includes('Radio') && !type.includes('RadioGroup')) {
    const active = p.value === p.groupValue
    const ac = p.activeColor?.hex || '#1E6BFF'
    return <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${active?ac:'#555'}`,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {active && <div style={{ width:10, height:10, borderRadius:'50%', background:ac }}/>}
      </div>
      {p.label && <span style={{ fontSize:14, color:'#d4d4d4' }}>{String(p.label)}</span>}
    </div>
  }

  if (type.includes('ToggleButtons')) {
    const labels   = p.labels   || ['A','B','C']
    const selected = p.selected || labels.map((_:any,i:number) => i===0)
    const ac = p.selectedColor?.hex || '#1E6BFF'
    return <div style={{ display:'flex', border:'1px solid #2a2a3a', borderRadius:8, overflow:'hidden' }}>
      {labels.map((lbl:string, i:number) => (
        <div key={i} style={{ padding:'8px 14px', fontSize:12, fontWeight:500,
          background: selected[i] ? ac+'22' : 'transparent', color: selected[i] ? ac : '#666',
          borderRight: i < labels.length-1 ? '1px solid #2a2a3a' : 'none' }}>
          {lbl}
        </div>
      ))}
    </div>
  }

  if (type.includes('RangeSlider')) {
    const min=p.min??0, max=p.max??100, start=p.start??20, end=p.end??80
    const clr = p.activeColor?.hex || '#1E6BFF'
    const pL = ((start-min)/(max-min))*100, pR = ((end-min)/(max-min))*100
    return <div style={{ padding:'8px 4px', width:'100%' }}>
      <div style={{ position:'relative', height:4, background:'#1E2D3D', borderRadius:2 }}>
        <div style={{ position:'absolute', left:`${pL}%`, right:`${100-pR}%`, height:'100%', background:clr, borderRadius:2 }}/>
        {[pL,pR].map((pct,i) => <div key={i} style={{ position:'absolute', left:`${pct}%`, top:'50%',
          transform:'translate(-50%,-50%)', width:14, height:14, borderRadius:'50%', background:clr, border:'2px solid #fff' }}/>)}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:'#8892A4' }}>
        <span>{start}</span><span>{end}</span>
      </div>
    </div>
  }

  if (type.includes('DatePicker') || type.includes('TimePicker')) {
    const isDate = type.includes('DatePicker')
    return <div style={{ border:'1.5px solid #1E3A5F', borderRadius:10, padding:'10px 14px',
      background:'#0A1628', width:'100%', display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:18 }}>{isDate?'📅':'🕐'}</span>
      <div>
        <div style={{ fontSize:11, color:'#8892A4', marginBottom:2 }}>{String(p.labelText||(isDate?'Select date':'Select time'))}</div>
        <div style={{ fontSize:13, color:'#555' }}>{isDate?'DD/MM/YYYY':'HH:MM'}</div>
      </div>
    </div>
  }

  if (type.includes('TextFormField')) {
    return <div style={{ border:'1.5px solid #1E3A5F', borderRadius:8, padding:'10px 14px',
      background:'#0A1628', width:'100%' }}>
      <div style={{ fontSize:11, color:'#1E6BFF', fontWeight:500, marginBottom:4 }}>{String(p.labelText||'Field')}</div>
      <div style={{ fontSize:13, color:'#555' }}>{String(p.hintText||'Enter value...')}</div>
    </div>
  }

  if (type.includes('ExpansionTile')) {
    return <div style={{ border:'1px solid #1E2D3D', borderRadius:8, overflow:'hidden', width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 16px', background:'#0D1B2A' }}>
        <span style={{ fontSize:14, color:'#FFFFFF', fontWeight:500 }}>{String(p.title||'Expansion')}</span>
        <span style={{ color:'#555' }}>▼</span>
      </div>
    </div>
  }

  if (type.includes('NavigationBar') && !type.includes('NavigationBarDest')
      && !type.includes('NavigationDrawer') && !type.includes('NavigationRail')) {
    const dests = p.destinations || [{label:'Home'},{label:'Explore'},{label:'Profile'}]
    const sel   = p.selectedIndex ?? 0
    const ac    = p.indicatorColor?.hex || '#1E6BFF'
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around',
      padding:'8px 0 4px', background:'#0D1B2A', borderTop:'1px solid #1E2D3D' }}>
      {dests.map((d:any,i:number) => (
        <div key={i} style={{ display:'flex', flexDirection:'column' as const, alignItems:'center',
          gap:2, padding:'4px 16px', borderRadius:16, background: i===sel?ac+'22':'transparent' }}>
          <span style={{ fontSize:20, color:i===sel?ac:'#555' }}>◈</span>
          <span style={{ fontSize:10, color:i===sel?ac:'#555', fontWeight:i===sel?600:400 }}>{d.label||''}</span>
        </div>
      ))}
    </div>
  }

  if (type.includes('NavigationRail')) {
    const dests = p.destinations || [{label:'Home'},{label:'Settings'}]
    const sel   = p.selectedIndex ?? 0
    const ac    = '#1E6BFF'
    return <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'center',
      padding:'8px 0', gap:4, background:'#0D1B2A', borderRight:'1px solid #1E2D3D', width:72 }}>
      {dests.map((d:any,i:number) => (
        <div key={i} style={{ display:'flex', flexDirection:'column' as const, alignItems:'center',
          padding:'8px 4px', borderRadius:12, width:64, background:i===sel?ac+'22':'transparent' }}>
          <span style={{ fontSize:20, color:i===sel?ac:'#555' }}>◈</span>
          <span style={{ fontSize:10, color:i===sel?ac:'#555', marginTop:2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  }

  if (type.includes('AlertDialog')) {
    return <div style={{ background:'#0D1B2A', borderRadius:16, padding:20,
      border:'1px solid #1E2D3D', width:'100%' }}>
      <div style={{ fontSize:16, fontWeight:700, color:'#FFFFFF', marginBottom:8 }}>{String(p.title||'Alert')}</div>
      <div style={{ fontSize:13, color:'#8892A4', marginBottom:16 }}>{String(p.content||'Are you sure?')}</div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
        <div style={{ padding:'8px 16px', borderRadius:8, fontSize:13, color:'#8892A4' }}>{String(p.cancelText||'Cancel')}</div>
        <div style={{ padding:'8px 16px', borderRadius:8, fontSize:13, background:'#1E6BFF', color:'#fff' }}>{String(p.confirmText||'OK')}</div>
      </div>
    </div>
  }

  if (type.includes('Stepper')) {
    const steps   = p.steps || [{title:'Step 1'},{title:'Step 2'}]
    const current = p.currentStep ?? 0
    const ac      = '#1E6BFF'
    return <div style={{ width:'100%' }}>
      {steps.map((step:any,i:number) => (
        <div key={i} style={{ display:'flex', gap:12, marginBottom:8 }}>
          <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'center' }}>
            <div style={{ width:24, height:24, borderRadius:'50%',
              background: i<current?'#4caf7d':i===current?ac:'#1E2D3D',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700, color:'#fff' }}>
              {i<current?'✓':i+1}
            </div>
            {i<steps.length-1 && <div style={{ width:2, height:20, background:'#1E2D3D', margin:'2px 0' }}/>}
          </div>
          <div style={{ paddingTop:2 }}>
            <div style={{ fontSize:13, fontWeight:600, color:i===current?'#FFFFFF':i<current?'#4caf7d':'#555' }}>
              {step.title||`Step ${i+1}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  }

  if (type.includes('RichText')) {
    const t = p.text
    return <div style={{ fontSize }}>
      <span style={{ color:color||'#FFFFFF' }}>{t?.text||'Rich '}</span>
      <span style={{ fontWeight:'bold', color:'#1E6BFF' }}>{t?.children?.[0]?.text||'text'}</span>
    </div>
  }

  if (type.includes('DropdownButtonFormField')) {
    return <div style={{ border:'1.5px solid #1E3A5F', borderRadius:8, padding:'10px 14px',
      background:'#0A1628', width:'100%' }}>
      <div style={{ fontSize:11, color:'#8892A4', marginBottom:4 }}>{String(p.labelText||'Select')}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, color:'#555' }}>{p.value||'Choose...'}</span>
        <span style={{ color:'#555' }}>▼</span>
      </div>
    </div>
  }

  // ── Silent layout containers — render nothing, CSS handles them ──
  const SILENT = [
    'Scaffold','Container','Row','Column','Stack','Center','Padding',
    'Expanded','Flexible','Wrap','SafeArea','Align','Positioned','SizedBox',
    'ListView','GridView','SingleChildScrollView','FutureBuilder','StreamBuilder',
    'GestureDetector','InkWell','Material','AnimatedContainer','Card',
    'BottomSheet','Dialog','SnackBar','TabBar','TabBarView',
    'Spacer','ClipRRect','Opacity','Tooltip','AspectRatio',
    'ReorderableListView','PageView',
  ]
  if (SILENT.some(s => type.includes(s))) return null

  // ── Unknown widget — minimal label ───────────────────────
  return (
    <div style={{ padding:'6px 10px', color:'#8892A4', fontSize:11, background:'#0A1420',
      borderRadius:6, border:'1px dashed #1E3A5F', display:'inline-flex', alignItems:'center', gap:6 }}>
      <span style={{fontSize:10}}>◈</span>{type.split('.').pop()}
    </div>
  )
}

function getContainerStyle(widget: WidgetNode): React.CSSProperties {
  const p    = widget.props as Record<string,any>
  const type = widget.type
  const dec  = p.decoration || {}
  const css: React.CSSProperties = {}

  // ── Background color — decoration wins over backgroundColor ──
  if (dec.color?.hex)          css.backgroundColor = dec.color.hex
  else if (p.color?.hex && (type.includes('Container') || type.includes('Card')))
                               css.backgroundColor = p.color.hex
  else if (p.backgroundColor?.hex)
                               css.backgroundColor = p.backgroundColor.hex

  // ── Border radius ─────────────────────────────────────────
  if (dec.borderRadius?.all !== undefined) {
    css.borderRadius = dec.borderRadius.all; css.overflow = 'hidden'
  } else if (dec.borderRadius && (dec.borderRadius.bottomLeft || dec.borderRadius.bottomRight || dec.borderRadius.topLeft || dec.borderRadius.topRight)) {
    const br = dec.borderRadius
    css.borderRadius = `${br.topLeft||0}px ${br.topRight||0}px ${br.bottomRight||0}px ${br.bottomLeft||0}px`
    css.overflow = 'hidden'
  } else if (p.borderRadius?.all !== undefined) {
    css.borderRadius = p.borderRadius.all; css.overflow = 'hidden'
  } else if (p.borderRadius && (p.borderRadius.bottomLeft || p.borderRadius.bottomRight || p.borderRadius.topLeft || p.borderRadius.topRight)) {
    const br = p.borderRadius
    css.borderRadius = `${br.topLeft||0}px ${br.topRight||0}px ${br.bottomRight||0}px ${br.bottomLeft||0}px`
    css.overflow = 'hidden'
  } else if (p.shape?.all !== undefined) {
    css.borderRadius = p.shape.all; css.overflow = 'hidden'
  }

  // ── Border ───────────────────────────────────────────────
  if (dec.border) css.border = `${dec.border.width||1}px solid ${dec.border.color?.hex||'#1E3A5F'}`
  else if (p.border) css.border = `${p.border.width||1}px solid ${p.border.color?.hex||'#1E3A5F'}`

  // ── Box shadow ────────────────────────────────────────────
  const sh = dec.boxShadow?.[0]
  if (sh) css.boxShadow = `${sh.offsetX||0}px ${sh.offsetY||4}px ${sh.blurRadius||8}px ${sh.color?.hex||'#00000044'}`
  else if (p.elevation && p.elevation > 0)
    css.boxShadow = `0 ${p.elevation}px ${p.elevation*3}px rgba(0,0,0,0.35)`

  // ── Padding ───────────────────────────────────────────────
  if (p.padding) {
    const pad = p.padding
    if      (pad.all !== undefined)        css.padding = pad.all
    else if (pad.horizontal !== undefined || pad.vertical !== undefined)
      css.padding = `${pad.vertical||0}px ${pad.horizontal||0}px`
    else css.padding = `${pad.top||0}px ${pad.right||0}px ${pad.bottom||0}px ${pad.left||0}px`
  }

  // ── Margin ────────────────────────────────────────────────
  if (p.margin) {
    const m = p.margin
    if      (m.all !== undefined)      css.margin = m.all
    else if (m.horizontal !== undefined || m.vertical !== undefined)
      css.margin = `${m.vertical||0}px ${m.horizontal||0}px`
    else {
      if (m.top    !== undefined) css.marginTop    = m.top
      if (m.bottom !== undefined) css.marginBottom = m.bottom
      if (m.left   !== undefined) css.marginLeft   = m.left
      if (m.right  !== undefined) css.marginRight  = m.right
    }
  }

  // ── Size ──────────────────────────────────────────────────
  if (p.width)  css.width  = p.width  === 400 ? '100%' : p.width
  if (p.height) css.height = p.height

  // ── Layout type ───────────────────────────────────────────
  if (type.includes('Scaffold')) {
    css.display = 'flex'; css.flexDirection = 'column'
    css.minHeight = '100%'
    if (!css.backgroundColor) css.backgroundColor = '#060E1A'
  }

  if (type.includes('Column')) {
    css.display = 'flex'; css.flexDirection = 'column'
    const ma = p.mainAxisAlignment || 'start'
    css.justifyContent = {center:'center',end:'flex-end',spaceBetween:'space-between',
      spaceEvenly:'space-evenly',spaceAround:'space-around'}[ma] || 'flex-start'
    const ca = p.crossAxisAlignment || 'stretch'
    css.alignItems = {center:'center',end:'flex-end',start:'flex-start'}[ca] || 'stretch'
    if (p.mainAxisSize === 'min') css.alignSelf = 'flex-start'
  }

  if (type.includes('Row')) {
    css.display = 'flex'; css.flexDirection = 'row'
    const ma = p.mainAxisAlignment || 'start'
    css.justifyContent = {center:'center',end:'flex-end',spaceBetween:'space-between',
      spaceEvenly:'space-evenly',spaceAround:'space-around'}[ma] || 'flex-start'
    const ca = p.crossAxisAlignment || 'center'
    css.alignItems = {start:'flex-start',end:'flex-end',stretch:'stretch'}[ca] || 'center'
    css.flexWrap = 'nowrap' as const
    css.gap = p.spacing || 0
  }

  if (type.includes('Stack'))    { css.position = 'relative'; css.display = 'block' }
  if (type.includes('Center'))   { css.display='flex'; css.alignItems='center'; css.justifyContent='center'; css.flex=1; css.flexDirection='column' }
  if (type.includes('Expanded') || type.includes('Flexible')) css.flex = p.flex || 1

  if (type.includes('SizedBox')) {
    if (p.width)  css.width  = p.width
    if (p.height) css.height = p.height
    css.flexShrink = 0
  }

  if (type.includes('Padding')) {
    // Padding already applied above — just pass through
  }

  if (type.includes('ListView')) {
    css.display = 'flex'; css.flexDirection = 'column'
    css.flex = p.shrinkWrap ? undefined : 1
    css.overflowY = 'auto' as const
    css.gap = p.separatorType === 'divider' ? 1 : (p.itemSpacing || 0)
  }

  if (type.includes('GridView')) {
    css.display = 'grid'
    css.gridTemplateColumns = `repeat(${p.crossAxisCount||2}, 1fr)`
    css.gap = p.crossAxisSpacing || 8
  }

  if (type.includes('SingleChildScrollView')) {
    css.flex = 1; css.overflowY = 'auto' as const
    css.display = 'flex'; css.flexDirection = 'column'
  }

  if (type.includes('Card')) {
    if (!css.backgroundColor) css.backgroundColor = p.color?.hex || '#0D1B2A'
    if (!css.borderRadius)    { css.borderRadius = p.shape?.all ?? 16; css.overflow = 'hidden' }
    css.marginBottom = p.margin?.bottom || p.margin?.all || 0
    css.marginTop    = p.margin?.top    || 0
  }

  return css
}


