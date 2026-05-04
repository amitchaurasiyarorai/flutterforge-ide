import React, { useState, useEffect, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import type { WidgetNode } from '../../types/widget.schema'
import { v4 as uuidv4 } from 'uuid'

// ─────────────────────────────────────────────────────────────────────────────
// .AZCOMP FILE FORMAT
// ─────────────────────────────────────────────────────────────────────────────

export interface AzCompFile {
  _format:      'appzillon-component'
  _version:     1
  name:         string
  category:     string
  exportedAt:   string
  exportedFrom: string
  rootWidgetId: string
  widgets:      Record<string, WidgetNode>
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Deep-clone a widget subtree and remap all IDs to fresh ones.
// Returns { widgets: remapped map, rootId: new root id }
function cloneWidgetTree(
  widgets: Record<string, WidgetNode>,
  rootId:  string
): { widgets: Record<string, WidgetNode>; rootId: string } {
  const idMap: Record<string, string> = {}

  // First pass — generate new IDs for every node in the subtree
  const collectIds = (id: string) => {
    if (!widgets[id]) return
    idMap[id] = 'w_' + uuidv4().substring(0, 8)
    widgets[id].children?.forEach(collectIds)
  }
  collectIds(rootId)

  // Second pass — clone nodes with remapped IDs + children
  const cloned: Record<string, WidgetNode> = {}
  const cloneNode = (id: string) => {
    const original = widgets[id]
    if (!original) return
    const newId = idMap[id]
    cloned[newId] = {
      ...JSON.parse(JSON.stringify(original)),
      id:       newId,
      children: original.children?.map(c => idMap[c]).filter(Boolean) as string[] | undefined,
    }
    original.children?.forEach(cloneNode)
  }
  cloneNode(rootId)

  return { widgets: cloned, rootId: idMap[rootId] }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT CARD
// ─────────────────────────────────────────────────────────────────────────────

interface ComponentEntry {
  name:   string
  data:   AzCompFile
}

interface CardProps {
  entry:     ComponentEntry
  onDrop:    (entry: ComponentEntry) => void
  onExport:  (entry: ComponentEntry) => void
  onDelete:  (name: string) => void
}

function ComponentCard({ entry, onDrop, onExport, onDelete }: CardProps) {
  const [hovering, setHovering] = useState(false)
  const [confirm,  setConfirm]  = useState(false)

  const widgetCount = Object.keys(entry.data.widgets).length
  const rootType    = entry.data.widgets[entry.data.rootWidgetId]?.type?.split('.').pop() || 'Widget'

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('azcomp', JSON.stringify(entry.data)) }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setConfirm(false) }}
      style={{
        background:   hovering ? '#0f0f1e' : '#0a0a14',
        border:       `1px solid ${hovering ? '#3d3060' : '#1e1e2e'}`,
        borderRadius: 10, padding: '10px 12px', marginBottom: 6,
        cursor: 'grab', transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#1e1a33',
          border: '1px solid #3d3060', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
          ◈
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e0d7ff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.name}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
            {rootType} · {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 10, color: '#444', marginBottom: 8 }}>
        from <span style={{ color: '#555' }}>{entry.data.exportedFrom || 'unknown'}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={e => { e.stopPropagation(); onDrop(entry) }}
          style={actionBtn('#1e1a33', '#9d7fe8')}
          title="Add to active screen"
        >
          + Add
        </button>
        <button
          onClick={e => { e.stopPropagation(); onExport(entry) }}
          style={actionBtn('#0a1628', '#4a9edd')}
          title="Export as .azcomp file"
        >
          ↓ Export
        </button>
        {!confirm ? (
          <button
            onClick={e => { e.stopPropagation(); setConfirm(true) }}
            style={actionBtn('#1a0a0a', '#e05252')}
            title="Delete from IDE library"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onDelete(entry.name) }}
            style={{ ...actionBtn('#3a0a0a', '#ff6b6b'), fontWeight: 700 }}
          >
            Sure?
          </button>
        )}
      </div>
    </div>
  )
}

function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1, padding: '4px 0', background: bg,
    border: `1px solid ${color}33`, borderRadius: 6,
    color, cursor: 'pointer', fontSize: 10, fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 16px', gap: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>◈</div>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
        No components yet.
      </div>
      <div style={{ fontSize: 11, color: '#3a3a4a', lineHeight: 1.6 }}>
        Right-click any widget on the canvas and choose "Save as Component"
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function ComponentLibrary() {
  const { project, activeScreenId } = useCanvasStore()

  const [components, setComponents] = useState<ComponentEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load from IDE userData ──────────────────────────────────────────────────
  const loadComponents = useCallback(async () => {
    setLoading(true)
    try {
      // @ts-ignore
      const raw: { name: string; json: string }[] = await window.flutterForge?.components?.list() || []
      const parsed: ComponentEntry[] = raw.map(r => ({
        name: r.name,
        data: JSON.parse(r.json) as AzCompFile,
      })).filter(e => e.data._format === 'appzillon-component')
      setComponents(parsed)
    } catch (e) {
      showToast('Failed to load components', false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadComponents() }, [loadComponents])

  // ── Drop onto active screen ─────────────────────────────────────────────────
  const handleDrop = useCallback((entry: ComponentEntry) => {
    if (!activeScreenId || !project) {
      showToast('Open a project and select a screen first', false); return
    }
    const screen = project.screens[activeScreenId]
    if (!screen) { showToast('No active screen', false); return }

    const { widgets: cloned, rootId } = cloneWidgetTree(entry.data.widgets, entry.data.rootWidgetId)

    // Find the body/center container to drop into (first container child of scaffold)
    const scaffold   = screen.widgets[screen.rootWidgetId]
    const bodyId     = scaffold?.children?.find(cid => {
      const w = screen.widgets[cid]
      return w && !w.type.includes('AppBar')
    }) || scaffold?.children?.[0]

    const store = useCanvasStore.getState()

    // Batch-add all cloned widgets directly to screen store
    useCanvasStore.setState(state => {
      const s = state.project?.screens[activeScreenId]
      if (!s) return
      Object.assign(s.widgets, cloned)
      // Attach root to body container
      if (bodyId && s.widgets[bodyId]) {
        if (!s.widgets[bodyId].children) s.widgets[bodyId].children = []
        s.widgets[bodyId].children!.push(rootId)
      }
      state.isDirty = true
    })

    store.selectWidget(activeScreenId, rootId)
    showToast(`✓ "${entry.name}" added to ${screen.name}`)
  }, [activeScreenId, project])

  // ── Export single component as .azcomp ──────────────────────────────────────
  const handleExport = useCallback(async (entry: ComponentEntry) => {
    try {
      const input    = document.createElement('input')
      input.type     = 'file'
      // We can't use showSaveDialog from renderer, so use a download trick
      const blob     = new Blob([JSON.stringify(entry.data, null, 2)], { type: 'application/json' })
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = entry.name.replace(/\s+/g, '-').toLowerCase() + '.azcomp'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast(`✓ Exported "${entry.name}.azcomp"`)
    } catch {
      showToast('Export failed', false)
    }
  }, [])

  // ── Import .azcomp file ─────────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const input    = document.createElement('input')
    input.type     = 'file'
    input.accept   = '.azcomp,.json'
    input.multiple = true
    input.style.display = 'none'
    document.body.appendChild(input)

    input.onchange = async () => {
      const files = Array.from(input.files || [])
      let imported = 0

      for (const file of files) {
        try {
          const text   = await file.text()
          const parsed = JSON.parse(text) as AzCompFile

          if (parsed._format !== 'appzillon-component') {
            showToast(`"${file.name}" is not a valid .azcomp file`, false)
            continue
          }
          if (!parsed.name || !parsed.widgets || !parsed.rootWidgetId) {
            showToast(`"${file.name}" is missing required fields`, false)
            continue
          }

          // @ts-ignore
          await window.flutterForge?.components?.save(parsed.name, JSON.stringify(parsed, null, 2))
          imported++
        } catch {
          showToast(`Failed to import "${file.name}"`, false)
        }
      }

      document.body.removeChild(input)
      if (imported > 0) {
        showToast(`✓ Imported ${imported} component${imported > 1 ? 's' : ''}`)
        await loadComponents()
      }
    }

    input.click()
  }, [loadComponents])

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (name: string) => {
    try {
      // @ts-ignore
      await window.flutterForge?.components?.delete(name)
      showToast(`Deleted "${name}"`)
      await loadComponents()
    } catch {
      showToast('Delete failed', false)
    }
  }, [loadComponents])

  // ── Drag from external drop (azcomp dragged from OS file manager) ───────────
  const handleExternalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.azcomp') || f.name.endsWith('.json'))
    if (!files.length) return
    let imported = 0
    for (const file of files) {
      try {
        const text   = await file.text()
        const parsed = JSON.parse(text) as AzCompFile
        if (parsed._format !== 'appzillon-component') continue
        // @ts-ignore
        await window.flutterForge?.components?.save(parsed.name, JSON.stringify(parsed, null, 2))
        imported++
      } catch { /* skip */ }
    }
    if (imported > 0) { showToast(`✓ Dropped in ${imported} component${imported > 1 ? 's' : ''}`); await loadComponents() }
  }, [loadComponents])

  const filtered = components.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleExternalDrop}
    >
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'absolute' as const, top: 8, left: 8, right: 8, zIndex: 999,
          background: toast.ok ? '#0a1a0f' : '#1a0a0a',
          border: `1px solid ${toast.ok ? '#1a5c2e' : '#5c1a1a'}`,
          borderRadius: 8, padding: '7px 12px', fontSize: 11,
          color: toast.ok ? '#4caf7d' : '#e05252',
          pointerEvents: 'none' as const,
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e1e2e',
        display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>

        {/* Import + count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: '0.07em' }}>
            COMPONENTS {components.length > 0 && `· ${components.length}`}
          </span>
          <button onClick={handleImport} style={{
            padding: '3px 10px', background: '#1e1a33', border: '1px solid #3d3060',
            borderRadius: 6, color: '#9d7fe8', cursor: 'pointer',
            fontSize: 10, fontWeight: 600, fontFamily: 'system-ui, sans-serif',
          }}>
            ↑ Import
          </button>
        </div>

        {/* Search */}
        {components.length > 3 && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components..."
            style={{
              width: '100%', padding: '5px 8px', background: '#0a0a14',
              border: '1px solid #1e1e2e', borderRadius: 6, color: '#ccc',
              fontSize: 11, outline: 'none', fontFamily: 'system-ui, sans-serif',
            }}
          />
        )}
      </div>

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: '#444' }}>
            Loading...
          </div>
        ) : filtered.length === 0 && search ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: '#444' }}>
            No components match "{search}"
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map(entry => (
            <ComponentCard
              key={entry.name}
              entry={entry}
              onDrop={handleDrop}
              onExport={handleExport}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* ── Footer hint ── */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid #1e1e2e',
        fontSize: 9, color: '#333', textAlign: 'center', flexShrink: 0 }}>
        Drag card onto canvas · Drop .azcomp files here to import
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE-AS-COMPONENT MODAL  (called from Canvas right-click)
// ─────────────────────────────────────────────────────────────────────────────

interface SaveModalProps {
  widgetIds:    string[]
  screenId:     string
  onClose:      () => void
  onSaved:      (name: string) => void
}

export function SaveAsComponentModal({ widgetIds, screenId, onClose, onSaved }: SaveModalProps) {
  const { project } = useCanvasStore()
  const [name,    setName]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    if (!/^[a-zA-Z0-9 _\-]+$/.test(trimmed)) { setError('Use letters, numbers, spaces, _ or - only'); return }
    if (!project) { setError('No project loaded'); return }

    const screen = project.screens[screenId]
    if (!screen) { setError('Screen not found'); return }

    setSaving(true)
    try {
      // Collect the full subtree for each selected widget
      const allWidgets: Record<string, WidgetNode> = {}

      const collectSubtree = (id: string) => {
        const w = screen.widgets[id]
        if (!w || allWidgets[id]) return
        allWidgets[id] = JSON.parse(JSON.stringify(w))
        w.children?.forEach(collectSubtree)
      }
      widgetIds.forEach(collectSubtree)

      // If multiple widgets selected, wrap in a virtual Column root
      let rootWidgetId: string
      if (widgetIds.length === 1) {
        rootWidgetId = widgetIds[0]
      } else {
        rootWidgetId = 'w_root_' + uuidv4().substring(0, 8)
        allWidgets[rootWidgetId] = {
          id:       rootWidgetId,
          type:     'flutter.widgets.Column' as any,
          props:    { mainAxisSize: 'min' },
          children: widgetIds,
        }
      }

      const payload: AzCompFile = {
        _format:      'appzillon-component',
        _version:     1,
        name:         trimmed,
        category:     'Custom',
        exportedAt:   new Date().toISOString(),
        exportedFrom: project.name || 'Unknown',
        rootWidgetId,
        widgets:      allWidgets,
      }

      // @ts-ignore
      await window.flutterForge?.components?.save(trimmed, JSON.stringify(payload, null, 2))
      onSaved(trimmed)
      onClose()
    } catch (e: any) {
      setError('Save failed: ' + (e?.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }, [name, widgetIds, screenId, project, onSaved, onClose])

  return (
    <div
      style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: 340, background: '#0d0d1a', border: '1px solid #2a2a3a',
        borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>

        <div style={{ fontSize: 15, fontWeight: 700, color: '#e0d7ff', marginBottom: 6 }}>
          Save as Component
        </div>
        <div style={{ fontSize: 11, color: '#555', marginBottom: 20 }}>
          {widgetIds.length} widget{widgetIds.length > 1 ? 's' : ''} selected ·
          will be saved to your IDE library
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#8892A4', marginBottom: 6 }}>Component name</div>
          <input
            autoFocus
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            placeholder="e.g. BankCard, LoginForm, ProfileHeader"
            style={{
              width: '100%', padding: '9px 12px', background: '#0a0a14',
              border: `1px solid ${error ? '#e05252' : '#2a2a3a'}`, borderRadius: 8,
              color: '#e0d7ff', fontSize: 12, outline: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          />
          {error && <div style={{ fontSize: 10, color: '#e05252', marginTop: 5 }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px 0', background: 'transparent',
            border: '1px solid #2a2a3a', borderRadius: 8, color: '#666',
            cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui, sans-serif',
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} style={{
            flex: 2, padding: '9px 0', background: saving || !name.trim() ? '#1e1a33' : '#3d2d6e',
            border: '1px solid #7c5cbf', borderRadius: 8,
            color: saving || !name.trim() ? '#555' : '#e0d7ff',
            cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'system-ui, sans-serif',
          }}>
            {saving ? 'Saving...' : '◈ Save to IDE Library'}
          </button>
        </div>
      </div>
    </div>
  )
}
