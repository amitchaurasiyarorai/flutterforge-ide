import React, { useEffect, useState } from 'react'
import { useCanvasStore } from './store/canvas.store'

export default function App(): JSX.Element {
  const { newProject, project } = useCanvasStore()
  const [engineReady, setEngineReady] = useState(false)
  const [engineChecked, setEngineChecked] = useState(false)

  // Check codegen engine health on startup
  useEffect(() => {
    const checkEngine = async () => {
      try {
        // @ts-ignore — window.flutterForge exposed via preload
        const healthy = await window.flutterForge?.codegen?.health()
        setEngineReady(!!healthy)
      } catch {
        setEngineReady(false)
      } finally {
        setEngineChecked(true)
      }
    }

    checkEngine()

    // Also listen for engine-ready event
    // @ts-ignore
    const unsub = window.flutterForge?.codegen?.onReady?.(() => setEngineReady(true))
    return () => unsub?.()
  }, [])

  // Create a default project on first load
  useEffect(() => {
    if (!project) {
      newProject('MyFlutterApp', 'com.example.myflutterapp')
    }
  }, [project, newProject])

  return (
    <div style={styles.root}>
      {/* ── Top bar ── */}
      <div style={styles.topBar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◆</span>
          <span style={styles.logoText}>FlutterForge</span>
          <span style={styles.logoVersion}>v1.0 — Session 1</span>
        </div>
        <div style={styles.topBarRight}>
          <div style={{
            ...styles.engineBadge,
            background: engineChecked
              ? (engineReady ? '#1a3a2a' : '#3a1a1a')
              : '#2a2a2a',
            borderColor: engineChecked
              ? (engineReady ? '#2da44e' : '#e05252')
              : '#555'
          }}>
            <div style={{
              ...styles.engineDot,
              background: engineChecked
                ? (engineReady ? '#2da44e' : '#e05252')
                : '#888'
            }} />
            <span>
              {!engineChecked
                ? 'Checking engine...'
                : engineReady
                  ? 'Codegen engine running'
                  : 'Engine offline — start codegen-engine'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={styles.main}>
        {/* ── Left sidebar placeholder ── */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>SCREENS</div>
            {project && Object.values(project.screens).map(screen => (
              <div key={screen.id} style={styles.sidebarItem}>
                <span style={styles.sidebarIcon}>▤</span>
                {screen.name}
              </div>
            ))}
            <div style={{ ...styles.sidebarItem, color: '#666', fontSize: 11, marginTop: 8 }}>
              + Add screen (Session 4)
            </div>
          </div>

          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>WIDGETS</div>
            {['Scaffold', 'AppBar', 'Column', 'Row', 'Container', 'Text',
              'TextField', 'Button', 'Image', 'ListView'].map(w => (
              <div key={w} style={styles.sidebarItem}>
                <span style={styles.sidebarIcon}>⬡</span>
                {w}
              </div>
            ))}
            <div style={{ ...styles.sidebarItem, color: '#666', fontSize: 11, marginTop: 8 }}>
              Full palette in Session 4
            </div>
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div style={styles.canvas}>
          <div style={styles.canvasPlaceholder}>
            <div style={styles.sessionBadge}>Session 1 — Foundation</div>
            <div style={styles.canvasTitle}>FlutterForge IDE</div>
            <div style={styles.canvasSubtitle}>
              {project
                ? `Project "${project.name}" loaded · ${Object.keys(project.screens).length} screen(s)`
                : 'Loading project...'}
            </div>

            <div style={styles.statusGrid}>
              <StatusCard
                label="Codegen Engine"
                value={engineReady ? 'Running :9876' : 'Offline'}
                ok={engineReady}
              />
              <StatusCard label="React + Electron" value="Running" ok />
              <StatusCard label="Canvas UI" value="Session 4" ok={false} pending />
              <StatusCard label="AI Copilot" value="Session 5" ok={false} pending />
            </div>

            <div style={styles.sessionList}>
              {[
                { n: 1, label: 'Foundation scaffold', done: true },
                { n: 2, label: 'Dart codegen completions', done: false },
                { n: 3, label: 'Spring Boot generator', done: false },
                { n: 4, label: 'React canvas + palette', done: false },
                { n: 5, label: 'AI Copilot + screen gen', done: false },
                { n: 6, label: 'Infrastructure generator', done: false },
              ].map(s => (
                <div key={s.n} style={styles.sessionItem}>
                  <div style={{
                    ...styles.sessionDot,
                    background: s.done ? '#2da44e' : '#333',
                    border: s.done ? 'none' : '1px solid #555'
                  }}>
                    {s.done ? '✓' : s.n}
                  </div>
                  <span style={{ color: s.done ? '#ccc' : '#666' }}>
                    Session {s.n} — {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right properties panel placeholder ── */}
        <div style={{ ...styles.sidebar, borderLeft: '1px solid #2a2a2a', borderRight: 'none' }}>
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>PROPERTIES</div>
            <div style={{ color: '#555', fontSize: 11, padding: '8px 0' }}>
              Select a widget to edit properties
            </div>
            <div style={{ color: '#444', fontSize: 11, marginTop: 16 }}>
              Full panel in Session 4
            </div>
          </div>
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarTitle}>AI COPILOT</div>
            <div style={{ color: '#555', fontSize: 11, padding: '8px 0' }}>
              Claude-powered assistant
            </div>
            <div style={{ color: '#444', fontSize: 11, marginTop: 4 }}>
              Coming in Session 5
            </div>
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div style={styles.statusBar}>
        <span>FlutterForge IDE · Session 1</span>
        <span style={{ marginLeft: 'auto' }}>
          {project ? `${project.name} · ${project.packageName}` : ''}
        </span>
        <span style={{ marginLeft: 24 }}>Electron + React + TypeScript</span>
      </div>
    </div>
  )
}

function StatusCard({
  label, value, ok, pending
}: {
  label: string
  value: string
  ok: boolean
  pending?: boolean
}): JSX.Element {
  return (
    <div style={{
      padding: '12px 16px',
      background: '#1a1a2a',
      borderRadius: 8,
      border: `1px solid ${ok ? '#1a3a2a' : pending ? '#2a2a2a' : '#3a1a1a'}`,
      minWidth: 160
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        color: ok ? '#2da44e' : pending ? '#555' : '#e05252'
      }}>
        {ok ? '✓ ' : pending ? '○ ' : '✗ '}{value}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#13131f',
    color: '#ccc',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 13,
    userSelect: 'none',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    padding: '0 16px',
    background: '#0d0d1a',
    borderBottom: '1px solid #2a2a3a',
    flexShrink: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: { color: '#7c5cbf', fontSize: 16 },
  logoText: { fontWeight: 600, color: '#e0d7ff', fontSize: 14 },
  logoVersion: { fontSize: 11, color: '#555', marginLeft: 4 },
  topBarRight: { marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' },
  engineBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 20,
    border: '1px solid', fontSize: 11, color: '#aaa'
  },
  engineDot: { width: 6, height: 6, borderRadius: '50%' },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 200, flexShrink: 0,
    background: '#0f0f1e',
    borderRight: '1px solid #2a2a3a',
    overflowY: 'auto', padding: '8px 0'
  },
  sidebarSection: { padding: '8px 0 16px' },
  sidebarTitle: {
    fontSize: 10, fontWeight: 600, color: '#555',
    letterSpacing: '0.08em', padding: '0 12px 6px'
  },
  sidebarItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 12px', color: '#888', fontSize: 12,
    cursor: 'default'
  },
  sidebarIcon: { color: '#555', fontSize: 11 },
  canvas: {
    flex: 1, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#13131f', overflow: 'hidden'
  },
  canvasPlaceholder: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 20, maxWidth: 600, padding: 32
  },
  sessionBadge: {
    padding: '4px 12px', borderRadius: 20,
    background: '#1e1a33', border: '1px solid #3d3060',
    color: '#9d7fe8', fontSize: 11, fontWeight: 500
  },
  canvasTitle: { fontSize: 28, fontWeight: 700, color: '#e0d7ff' },
  canvasSubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  statusGrid: {
    display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center'
  },
  sessionList: {
    display: 'flex', flexDirection: 'column', gap: 8,
    width: '100%', marginTop: 8
  },
  sessionItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 16px', background: '#0f0f1e',
    borderRadius: 8, border: '1px solid #1e1e2e'
  },
  sessionDot: {
    width: 24, height: 24, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 600, color: '#fff', flexShrink: 0
  },
  statusBar: {
    display: 'flex', alignItems: 'center',
    height: 24, padding: '0 16px',
    background: '#0d0d1a', borderTop: '1px solid #2a2a3a',
    fontSize: 11, color: '#555', flexShrink: 0
  }
}
