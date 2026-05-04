import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import type { NavConnection } from '../../types/widget.schema'

// ── Constants ────────────────────────────────────────────────────────────────
const NODE_W  = 160
const NODE_H  = 76
const GRID    = 220  // auto-layout grid spacing

// ── Transition options ────────────────────────────────────────────────────────
const TRANSITIONS: { value: NavConnection['transition']; label: string }[] = [
  { value: 'push',            label: 'Push' },
  { value: 'pushReplacement', label: 'Replace' },
  { value: 'go',              label: 'Go (clear stack)' },
  { value: 'popUntil',        label: 'Pop Until' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function nodeCentre(pos: { x: number; y: number }) {
  return { x: pos.x + NODE_W / 2, y: pos.y + NODE_H / 2 }
}

function edgePoints(from: { x: number; y: number }, to: { x: number; y: number }) {
  // Start: right edge of from node; End: left edge of to node
  const startX = from.x + NODE_W
  const startY = from.y + NODE_H / 2
  const endX   = to.x
  const endY   = to.y + NODE_H / 2
  const dx     = Math.abs(endX - startX)
  const cpOff  = Math.max(60, dx * 0.45)
  return { startX, startY, endX, endY, cpOff }
}

function arrowPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const { startX, startY, endX, endY, cpOff } = edgePoints(from, to)
  return `M ${startX} ${startY} C ${startX + cpOff} ${startY}, ${endX - cpOff} ${endY}, ${endX} ${endY}`
}

function arrowMidpoint(from: { x: number; y: number }, to: { x: number; y: number }) {
  const { startX, startY, endX, endY, cpOff } = edgePoints(from, to)
  // Cubic bezier midpoint (t=0.5)
  const t = 0.5
  const mx = Math.pow(1-t,3)*startX + 3*Math.pow(1-t,2)*t*(startX+cpOff) + 3*(1-t)*t*t*(endX-cpOff) + Math.pow(t,3)*endX
  const my = Math.pow(1-t,3)*startY + 3*Math.pow(1-t,2)*t*startY + 3*(1-t)*t*t*endY + Math.pow(t,3)*endY
  return { x: mx, y: my }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NavigationDesigner(): JSX.Element {
  const {
    project, activeScreenId,
    setActiveScreen, addScreen, deleteScreen,
    setInitialRoute, setScreenNavPos,
    addNavConnection, updateNavConnection, removeNavConnection,
  } = useCanvasStore()

  const svgRef      = useRef<SVGSVGElement>(null)
  const canvasRef   = useRef<HTMLDivElement>(null)

  // Dragging a node
  const [dragging,  setDragging]  = useState<{ screenId: string; ox: number; oy: number } | null>(null)
  // Drawing a new connection
  const [drawing,   setDrawing]   = useState<{ fromId: string; x: number; y: number } | null>(null)
  // Selected connection for editing
  const [selConn,   setSelConn]   = useState<string | null>(null)
  // Canvas pan
  const [pan,       setPan]       = useState({ x: 40, y: 60 })
  const [panning,   setPanning]   = useState<{ ox: number; oy: number; px: number; py: number } | null>(null)
  // Context menu
  const [ctxMenu,   setCtxMenu]   = useState<{ x: number; y: number; screenId: string } | null>(null)

  const screens     = project ? Object.values(project.screens) : []
  const connections = project?.navConnections ?? []

  // ── Auto-layout on first open if positions not set ─────────────────────────
  useEffect(() => {
    if (!project) return
    const unpositioned = screens.filter(s => !s.navPos)
    if (unpositioned.length === 0) return
    // Simple left-to-right grid
    unpositioned.forEach((sc, i) => {
      setScreenNavPos(sc.id, {
        x: 40 + (i % 4) * GRID,
        y: 40 + Math.floor(i / 4) * (NODE_H + 100),
      })
    })
  }, [project?.id]) // only on project change

  const getPos = useCallback((screenId: string) => {
    return project?.screens[screenId]?.navPos ?? { x: 40, y: 40 }
  }, [project])

  // ── Node drag ─────────────────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e: React.MouseEvent, screenId: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const pos = getPos(screenId)
    setDragging({ screenId, ox: e.clientX - pos.x, oy: e.clientY - pos.y })
    setSelConn(null)
    setCtxMenu(null)
  }, [getPos])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const nx = e.clientX - dragging.ox
      const ny = e.clientY - dragging.oy
      setScreenNavPos(dragging.screenId, { x: Math.max(0, nx), y: Math.max(0, ny) })
    }
    if (drawing) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        setDrawing(d => d ? { ...d, x: e.clientX - rect.left - pan.x, y: e.clientY - rect.top - pan.y } : null)
      }
    }
    if (panning) {
      setPan({ x: panning.px + (e.clientX - panning.ox), y: panning.py + (e.clientY - panning.oy) })
    }
  }, [dragging, drawing, panning, pan, setScreenNavPos])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragging) setDragging(null)
    if (drawing) setDrawing(null)
    if (panning) setPanning(null)
  }, [dragging, drawing, panning])

  // ── Connection handle drag ─────────────────────────────────────────────────
  const onHandleMouseDown = useCallback((e: React.MouseEvent, fromId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setDrawing({
      fromId,
      x: e.clientX - rect.left - pan.x,
      y: e.clientY - rect.top - pan.y,
    })
  }, [pan])

  const onNodeMouseUp = useCallback((e: React.MouseEvent, toId: string) => {
    if (!drawing || drawing.fromId === toId) return
    e.stopPropagation()
    // Avoid duplicate connections
    const exists = connections.some(c => c.fromId === drawing.fromId && c.toId === toId)
    if (!exists) {
      addNavConnection({ fromId: drawing.fromId, toId, transition: 'push', label: '' })
    }
    setDrawing(null)
  }, [drawing, connections, addNavConnection])

  // ── Canvas pan ────────────────────────────────────────────────────────────
  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPanning({ ox: e.clientX, oy: e.clientY, px: pan.x, py: pan.y })
    }
    setSelConn(null)
    setCtxMenu(null)
  }, [pan])

  // ── Auto-layout ────────────────────────────────────────────────────────────
  const autoLayout = useCallback(() => {
    if (!project) return
    screens.forEach((sc, i) => {
      setScreenNavPos(sc.id, {
        x: 40 + (i % 4) * GRID,
        y: 60 + Math.floor(i / 4) * (NODE_H + 100),
      })
    })
  }, [project, screens, setScreenNavPos])

  if (!project) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column' as const, gap:12, color:'#444', background:'#0d0d1a' }}>
        <div style={{ fontSize:32, opacity:0.2 }}>⟷</div>
        <div style={{ fontSize:13, color:'#555' }}>No project open</div>
        <div style={{ fontSize:12, color:'#333' }}>Open or create a project to design navigation</div>
      </div>
    )
  }

  const selectedConn = connections.find(c => c.id === selConn)
  const canvasW = Math.max(...screens.map(s => (s.navPos?.x ?? 40) + NODE_W + 80), 800)
  const canvasH = Math.max(...screens.map(s => (s.navPos?.y ?? 40) + NODE_H + 120), 600)

  return (
    <div style={{ display:'flex', flexDirection:'column' as const, height:'100%',
      background:'#0d0d1a', overflow:'hidden' }}>

      {/* ── Header toolbar ─────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px',
        background:'#0a0a14', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#e0d7ff' }}>Navigation Designer</span>
        <span style={{ fontSize:11, color:'#444' }}>
          {screens.length} screen{screens.length !== 1 ? 's' : ''} · {connections.length} connection{connections.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex:1 }} />
        <button onClick={autoLayout} style={toolBtn} title="Auto-arrange all screens">
          ⊞ Auto Layout
        </button>
        <button onClick={() => {
          const n = screens.length + 1
          addScreen(`Screen${n}`, `/screen${n}`)
        }} style={{ ...toolBtn, color:'#4caf7d', borderColor:'#1a5c2e' }}>
          + Screen
        </button>
        <div style={{ fontSize:10, color:'#333', borderLeft:'1px solid #1e1e2e',
          paddingLeft:10, marginLeft:4 }}>
          Alt+drag to pan · Drag handle → to connect
        </div>
      </div>

      {/* ── Canvas area ────────────────────────────────────────────── */}
      <div ref={canvasRef} style={{ flex:1, overflow:'auto', position:'relative' as const,
        cursor: panning ? 'grabbing' : drawing ? 'crosshair' : 'default' }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onCanvasMouseDown}
        onClick={() => { setSelConn(null); setCtxMenu(null) }}
      >
        <div style={{
          position:'absolute' as const, left:0, top:0,
          width: canvasW + pan.x, height: canvasH + pan.y,
          minWidth:'100%', minHeight:'100%',
        }}>

          {/* Dot grid background */}
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
            <defs>
              <pattern id="ndot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="1" fill="#1a1a2a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ndot)" />
          </svg>

          {/* ── SVG layer: connection arrows ──────────────────────── */}
          <svg ref={svgRef}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%',
              overflow:'visible', pointerEvents:'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#4a9edd" />
              </marker>
              <marker id="arrowhead-sel" markerWidth="10" markerHeight="7"
                refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#9d7fe8" />
              </marker>
            </defs>

            {connections.map(conn => {
              const fromPos = getPos(conn.fromId)
              const toPos   = getPos(conn.toId)
              if (!project.screens[conn.fromId] || !project.screens[conn.toId]) return null
              const path  = arrowPath(
                { x: fromPos.x + pan.x, y: fromPos.y + pan.y },
                { x: toPos.x  + pan.x, y: toPos.y  + pan.y  }
              )
              const mid   = arrowMidpoint(
                { x: fromPos.x + pan.x, y: fromPos.y + pan.y },
                { x: toPos.x  + pan.x, y: toPos.y  + pan.y  }
              )
              const isSel = conn.id === selConn
              const color = isSel ? '#9d7fe8' : '#4a9edd'

              return (
                <g key={conn.id}>
                  {/* Invisible thick hit area */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth="16"
                    style={{ pointerEvents:'stroke', cursor:'pointer' }}
                    onClick={e => { e.stopPropagation(); setSelConn(conn.id) }} />
                  {/* Visible arrow */}
                  <path d={path} fill="none" stroke={color} strokeWidth={isSel ? 2.5 : 1.5}
                    strokeDasharray={conn.transition === 'popUntil' ? '6,4' : undefined}
                    markerEnd={isSel ? 'url(#arrowhead-sel)' : 'url(#arrowhead)'}
                    opacity={isSel ? 1 : 0.7} />
                  {/* Label badge */}
                  {conn.label && (
                    <g style={{ pointerEvents:'none' }}>
                      <rect x={mid.x - 32} y={mid.y - 10} width={64} height={20}
                        rx={10} fill="#0d0d1a" stroke={color} strokeWidth={1} opacity={0.95} />
                      <text x={mid.x} y={mid.y + 4} textAnchor="middle"
                        fontSize={9} fill={color} fontFamily="system-ui,sans-serif">
                        {conn.label.length > 12 ? conn.label.slice(0,12)+'…' : conn.label}
                      </text>
                    </g>
                  )}
                  {/* Transition type dot */}
                  {!conn.label && (
                    <circle cx={mid.x} cy={mid.y} r={4} fill={color} opacity={0.8} />
                  )}
                </g>
              )
            })}

            {/* Drawing-in-progress line */}
            {drawing && (() => {
              const fromPos = getPos(drawing.fromId)
              const startX  = fromPos.x + pan.x + NODE_W
              const startY  = fromPos.y + pan.y + NODE_H / 2
              return (
                <line x1={startX} y1={startY} x2={drawing.x + pan.x} y2={drawing.y + pan.y}
                  stroke="#4caf7d" strokeWidth={1.5} strokeDasharray="6,4"
                  markerEnd="url(#arrowhead)" opacity={0.8} />
              )
            })()}
          </svg>

          {/* ── Screen nodes ─────────────────────────────────────── */}
          {screens.map(sc => {
            const pos       = sc.navPos ?? { x: 40, y: 40 }
            const isActive  = sc.id === activeScreenId
            const isInitial = project.initialRoute === sc.route
            const isDrawSrc = drawing?.fromId === sc.id

            return (
              <div key={sc.id}
                style={{
                  position: 'absolute' as const,
                  left: pos.x + pan.x,
                  top:  pos.y + pan.y,
                  width: NODE_W,
                  height: NODE_H,
                  background: isActive  ? '#1e1a33' : '#0f0f1e',
                  border: `1.5px solid ${isActive ? '#7c5cbf' : isDrawSrc ? '#4caf7d' : '#2a2a3a'}`,
                  borderRadius: 10,
                  boxShadow: isActive ? '0 0 0 2px #7c5cbf44' : '0 4px 16px rgba(0,0,0,0.5)',
                  cursor: 'grab',
                  userSelect: 'none' as const,
                  display: 'flex', flexDirection: 'column' as const,
                  overflow: 'hidden',
                  zIndex: isActive ? 10 : 2,
                }}
                onMouseDown={e => onNodeMouseDown(e, sc.id)}
                onMouseUp={e => onNodeMouseUp(e, sc.id)}
                onClick={e => { e.stopPropagation(); setActiveScreen(sc.id) }}
                onContextMenu={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCtxMenu({ x: e.clientX, y: e.clientY, screenId: sc.id })
                }}
              >
                {/* Top color bar */}
                <div style={{
                  height: 4, flexShrink: 0,
                  background: isInitial ? 'linear-gradient(90deg,#c9a227,#e8c547)'
                    : isActive ? 'linear-gradient(90deg,#7c5cbf,#9d7fe8)'
                    : '#1e1e2e',
                }} />

                <div style={{ flex:1, padding:'7px 10px', display:'flex',
                  flexDirection:'column' as const, justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {isInitial && <span style={{ fontSize:10, color:'#c9a227' }} title="Initial route">★</span>}
                    <span style={{ fontSize:12, fontWeight:600,
                      color: isActive ? '#e0d7ff' : '#ccc',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const,
                      flex:1 }}>
                      {sc.name}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:'#555', fontFamily:'monospace',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                    {sc.route}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:9, color:'#444' }}>
                      {Object.keys(sc.widgets).length}w
                    </span>
                    {connections.filter(c => c.toId === sc.id).length > 0 && (
                      <span style={{ fontSize:9, color:'#4a9edd' }}>
                        ← {connections.filter(c => c.toId === sc.id).length}
                      </span>
                    )}
                    {connections.filter(c => c.fromId === sc.id).length > 0 && (
                      <span style={{ fontSize:9, color:'#4caf7d' }}>
                        → {connections.filter(c => c.fromId === sc.id).length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Connection handle — right edge */}
                <div
                  onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, sc.id) }}
                  title="Drag to connect to another screen"
                  style={{
                    position: 'absolute' as const,
                    right: -10, top: '50%', transform: 'translateY(-50%)',
                    width: 18, height: 18, borderRadius: '50%',
                    background: isDrawSrc ? '#4caf7d' : '#1e1e2e',
                    border: `2px solid ${isDrawSrc ? '#4caf7d' : '#3d3d5a'}`,
                    cursor: 'crosshair',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#888', zIndex: 20,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}>
                  →
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Selected connection editor (bottom drawer) ─────────────── */}
      {selectedConn && (
        <div style={{ flexShrink:0, background:'#0a0a14',
          borderTop:'1px solid #1e1e2e', padding:'10px 16px',
          display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'#555', flexShrink:0 }}>Connection:</span>
          <span style={{ fontSize:12, color:'#9d7fe8', fontWeight:600, flexShrink:0 }}>
            {project.screens[selectedConn.fromId]?.name ?? '?'}
          </span>
          <span style={{ fontSize:11, color:'#444' }}>→</span>
          <span style={{ fontSize:12, color:'#9d7fe8', fontWeight:600, flexShrink:0 }}>
            {project.screens[selectedConn.toId]?.name ?? '?'}
          </span>
          <span style={{ fontSize:11, color:'#444', marginLeft:8 }}>Label:</span>
          <input
            value={selectedConn.label ?? ''}
            onChange={e => updateNavConnection(selectedConn.id, { label: e.target.value })}
            placeholder="e.g. On Login Success"
            style={{ padding:'4px 8px', background:'#0d0d1a', border:'1px solid #2a2a3a',
              borderRadius:6, color:'#d4d4d4', fontSize:11, width:180,
              outline:'none', fontFamily:'system-ui,sans-serif' }}
          />
          <span style={{ fontSize:11, color:'#444' }}>Transition:</span>
          <select
            value={selectedConn.transition}
            onChange={e => updateNavConnection(selectedConn.id, { transition: e.target.value as NavConnection['transition'] })}
            style={{ padding:'4px 8px', background:'#0d0d1a', border:'1px solid #2a2a3a',
              borderRadius:6, color:'#d4d4d4', fontSize:11, cursor:'pointer',
              outline:'none', fontFamily:'system-ui,sans-serif' }}>
            {TRANSITIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div style={{ flex:1 }} />
          <button onClick={() => { removeNavConnection(selectedConn.id); setSelConn(null) }}
            style={{ ...toolBtn, color:'#e05252', borderColor:'#5c1a1a' }}>
            ✕ Delete
          </button>
        </div>
      )}

      {/* ── Context menu ───────────────────────────────────────────── */}
      {ctxMenu && (
        <div style={{ position:'fixed' as const, top: ctxMenu.y, left: ctxMenu.x, zIndex:9000,
          background:'#0d0d1a', border:'1px solid #2a2a3a', borderRadius:10,
          boxShadow:'0 8px 32px rgba(0,0,0,0.8)', minWidth:190, overflow:'hidden' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ padding:'6px 0' }}>
            <CtxItem label="★ Set as initial screen" color="#c9a227" onClick={() => {
              const sc = project.screens[ctxMenu.screenId]
              if (sc) setInitialRoute(sc.route)
              setCtxMenu(null)
            }} />
            <CtxItem label="✎ Go to Canvas" color="#9d7fe8" onClick={() => {
              setActiveScreen(ctxMenu.screenId)
              setCtxMenu(null)
            }} />
            <div style={{ height:1, background:'#1e1e2e', margin:'4px 0' }} />
            <CtxItem label="⊕ Add new screen" color="#4caf7d" onClick={() => {
              const n = screens.length + 1
              addScreen(`Screen${n}`, `/screen${n}`)
              setCtxMenu(null)
            }} />
            <div style={{ height:1, background:'#1e1e2e', margin:'4px 0' }} />
            {screens.length > 1 && (
              <CtxItem label="✕ Delete screen" color="#e05252" onClick={() => {
                // Remove all connections involving this screen too
                connections.filter(c => c.fromId === ctxMenu.screenId || c.toId === ctxMenu.screenId)
                  .forEach(c => removeNavConnection(c.id))
                deleteScreen(ctxMenu.screenId)
                setCtxMenu(null)
              }} />
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ flexShrink:0, padding:'4px 14px', background:'#080812',
        display:'flex', gap:16, fontSize:10, color:'#333',
        borderTop:'1px solid #14141e' }}>
        <span>★ Initial screen</span>
        <span style={{ color:'#4a9edd' }}>── Push</span>
        <span style={{ color:'#4a9edd' }}>- - Pop until</span>
        <span style={{ color:'#555' }}>Click arrow to edit · Right-click screen for options</span>
      </div>
    </div>
  )
}

function CtxItem({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display:'flex', alignItems:'center', gap:10, width:'100%',
        padding:'8px 14px', background: hover ? '#1a1a2e' : 'none',
        border:'none', cursor:'pointer', textAlign:'left' as const,
        fontFamily:'system-ui,sans-serif', color, fontSize:12,
        transition:'background 0.1s' }}>
      {label}
    </button>
  )
}

const toolBtn: React.CSSProperties = {
  padding: '4px 10px', background: '#0e0e20',
  border: '1px solid #22223a', borderRadius: 6,
  color: '#888', cursor: 'pointer', fontSize: 11,
  fontFamily: 'system-ui,sans-serif', flexShrink: 0,
}
