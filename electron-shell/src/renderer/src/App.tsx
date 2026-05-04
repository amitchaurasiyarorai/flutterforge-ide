import React, { useEffect, useState, useRef, useCallback } from "react"
import Canvas from "./components/canvas/Canvas"
import WidgetPalette, { PaletteItem } from "./components/canvas/WidgetPalette"
import FieldsPanel   from "./components/canvas/FieldsPanel"
import ThemeEditor   from "./components/canvas/ThemeEditor"
import PhonePreview  from "./components/canvas/PhonePreview"
import WidgetTree from "./components/canvas/WidgetTree"
import PropertiesPanel from "./components/properties/PropertiesPanel"
import CodegenPanel from "./components/codegen/CodegenPanel"

import ProjectManager from "./components/project/ProjectManager"
import AICopilot from "./components/copilot/AICopilot"
import CodeEditor from "./components/code/CodeEditor"
import AssetsManager from "./components/assets/AssetsManager"
import ConfigPanel    from "./components/config/ConfigPanel"
import DataFilesPanel from "./components/datafiles/DataFilesPanel"
import InterfacesPanel from "./components/interfaces/InterfacesPanel"
import NavigationDesigner from "./components/navigation/NavigationDesigner"
import { useIntegrationsStore } from "./store/integrations.store"

import NativePluginPalette, { type NativePlugin } from "./components/canvas/NativePluginPalette"
import ComponentLibrary, { SaveAsComponentModal } from "./components/canvas/ComponentLibrary"
import FigmaImporter from "./components/figma/FigmaImporter"
import { useCanvasStore, selectActiveScreen } from "./store/canvas.store"
import { useCodeStore } from "./store/code.store"
import { useUIStore, type IDETab as Tab } from "./store/ui.store"

const ENGINE = "http://localhost:9876"

// ── Panel width defaults + constraints ────────────────────────────────────────
const PANEL_DEFAULTS = { left: 220, palette: 200, right: 260 }
const PANEL_MIN      = { left: 160, palette: 160, right: 220 }
const PANEL_MAX      = { left: 320, palette: 280, right: 400 }

// ── Resize handle hook ────────────────────────────────────────────────────────
function useResize(
  initial: number | (() => number), min: number, max: number, storageKey: string,
  direction: 'right' | 'left' = 'right'
) {
  const [width, setWidth] = useState<number>(initial)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = width

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = direction === 'right' ? ev.clientX - startX.current : startX.current - ev.clientX
      const next  = Math.min(max, Math.max(min, startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // persist
      try { localStorage.setItem(storageKey, String(width)) } catch {}
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width, min, max, storageKey, direction])

  // persist on width change
  useEffect(() => {
    try { localStorage.setItem(storageKey, String(width)) } catch {}
  }, [width, storageKey])

  const reset = useCallback(() => setWidth(initial), [initial])

  return { width, onMouseDown, reset }
}

// ── Activity Bar items ────────────────────────────────────────────────────────
// Each item maps to one or more tabs it activates
const ACTIVITY_ITEMS: {
  id: string
  icon: string
  label: string
  tab: Tab
  color: string
}[] = [
  { id: "canvas",     icon: "⬡",   label: "Canvas",      tab: "canvas",     color: "#9d7fe8" },
  { id: "theme",      icon: "◑",   label: "Theme",       tab: "theme",      color: "#9d7fe8" },
  { id: "preview",    icon: "◻",   label: "Preview",     tab: "preview",    color: "#9d7fe8" },
  { id: "assets",     icon: "⊞",   label: "Assets",      tab: "assets",     color: "#9d7fe8" },
  { id: "navigation", icon: "⟷",   label: "Navigation",  tab: "navigation", color: "#4caf7d" },
  { id: "datafiles",  icon: "◈",   label: "Data Files",  tab: "datafiles",  color: "#4caf7d" },
  { id: "interfaces", icon: "⟳",   label: "Interfaces",  tab: "interfaces", color: "#4caf7d" },
  { id: "code",       icon: "</>", label: "Code",        tab: "code",       color: "#4a9edd" },
  { id: "codegen",    icon: "⚡",   label: "Generate",    tab: "codegen",    color: "#4a9edd" },
  { id: "figma",      icon: "✦",   label: "Figma",       tab: "figma",      color: "#c9a227" },
  { id: "config",     icon: "⚙",   label: "Config",      tab: "config",     color: "#c9a227" },
]

export default function App(): JSX.Element {
  const [engineReady,   setEngineReady]   = useState(false)
  const [engineChecked, setEngineChecked] = useState(false)
  const { activeTab, setActiveTab } = useUIStore()
  const [draggedItem,   setDraggedItem]   = useState<PaletteItem | null>(null)
  const [showProjMgr,   setShowProjMgr]   = useState(false)
  const [showCopilot,   setShowCopilot]   = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pluginDropped,  setPluginDropped]  = useState<{ plugin: NativePlugin, toast: string } | null>(null)
  const [paletteTab,    setPaletteTab]    = useState<'widgets' | 'plugins' | 'components'>('widgets')
  const [draggedPlugin,  setDraggedPlugin]  = useState<NativePlugin | null>(null)
  const [saveAsComp,     setSaveAsComp]     = useState<{ widgetIds: string[]; screenId: string } | null>(null)
  const [renamingScreenId, setRenamingScreenId] = useState<string | null>(null)
  const [renameScreenVal,  setRenameScreenVal]  = useState('')

  // ── Build state (lifted from ConfigPanel → always visible in toolbar) ────
  const [building,    setBuilding]    = useState(false)
  const [buildDone,   setBuildDone]   = useState<'success' | 'error' | null>(null)
  const [buildLog,    setBuildLog]    = useState<string[]>([])
  const [showBuildLog, setShowBuildLog] = useState(false)
  const [buildConfig,  setBuildConfig]  = useState<any>(null) // loaded lazily from disk

  // ── B1: Resizable panel widths ──────────────────────────────────────────
  const leftResize    = useResize(
    () => parseInt(localStorage.getItem('az_left_w')    || '') || PANEL_DEFAULTS.left,
    PANEL_MIN.left,    PANEL_MAX.left,    'az_left_w',    'right')
  const paletteResize = useResize(
    () => parseInt(localStorage.getItem('az_palette_w') || '') || PANEL_DEFAULTS.palette,
    PANEL_MIN.palette, PANEL_MAX.palette, 'az_palette_w', 'right')
  const rightResize   = useResize(
    () => parseInt(localStorage.getItem('az_right_w')   || '') || PANEL_DEFAULTS.right,
    PANEL_MIN.right,   PANEL_MAX.right,   'az_right_w',   'left')
  const logRef = useRef<HTMLDivElement>(null)

  const { updateScreenCode, screenFiles, sharedFiles, initScreenFile, renameScreenCascade } = useCodeStore()

  const handleStartScreenRename = (sc: { id: string; name: string }, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingScreenId(sc.id)
    setRenameScreenVal(sc.name)
  }

  const handleCommitScreenRename = (screenId: string) => {
    const newName = renameScreenVal.trim()
    if (!newName) { setRenamingScreenId(null); return }
    useCanvasStore.getState().updateScreen(screenId, { name: newName })
    renameScreenCascade(screenId, newName)
    setRenamingScreenId(null)
  }

  const { newProject, project, activeScreenId, addScreen, addWidget,
          setActiveScreen, deleteScreen, isDirty, projectFilePath, setFilePath,
          zoom, setZoom, gridEnabled, toggleGrid,
          canUndo, canRedo, undo, redo } = useCanvasStore()

  const activeScreen = useCanvasStore(selectActiveScreen)

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch(ENGINE + "/actuator/health")
        const data = await res.json()
        setEngineReady(data.status === "UP")
      } catch { setEngineReady(false) }
      finally  { setEngineChecked(true) }
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll build log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [buildLog])

  // Load buildConfig from disk when project changes
  useEffect(() => {
    if (!projectFilePath) return
    const load = async () => {
      try {
        const ff = (window as any).flutterForge
        const text = await ff?.fs?.readFile(projectFilePath + '/config/build-config.json')
        if (text) setBuildConfig(JSON.parse(text))
      } catch {}
    }
    load()
  }, [projectFilePath])

  // Plugin drop
  const handlePluginDrop = (plugin: NativePlugin) => {
    if (!activeScreenId || !project) return
    const screen = project.screens[activeScreenId]
    if (!screen) return
    if (!screenFiles[activeScreenId]) {
      initScreenFile(activeScreenId, screen.name, screen.route)
    }
    const file = useCodeStore.getState().screenFiles[activeScreenId]
    if (!file) return
    const existing     = file.dartCode
    const snippet      = plugin.dartSnippet.trimEnd()
    const uniqueMarker = `// ── ${plugin.name}`
    if (existing.includes(uniqueMarker)) {
      setPluginDropped({ plugin, toast: `${plugin.name} already added` })
      setTimeout(() => setPluginDropped(null), 2000)
      return
    }
    const insertAt = existing.lastIndexOf('\n}')
    const newCode  = insertAt >= 0
      ? existing.slice(0, insertAt) + '\n\n  ' + snippet.split('\n').join('\n  ') + existing.slice(insertAt)
      : existing + '\n\n' + snippet
    updateScreenCode(activeScreenId, newCode)
    setActiveTab('code')
    setPluginDropped({ plugin, toast: `${plugin.name} added → Code tab` })
    setTimeout(() => setPluginDropped(null), 3000)
  }

  // ── Build trigger (lifted from ConfigPanel) ───────────────────────────────
  const handleBuild = useCallback(async () => {
    if (!project || !projectFilePath) {
      setBuildLog(['✗ No project open. Open a project first.'])
      setShowBuildLog(true)
      return
    }
    const cfg = buildConfig || {}
    if (!cfg.flutterPath) {
      setBuildLog(['✗ Flutter SDK path not set. Go to Config → Build Config to set it.'])
      setShowBuildLog(true)
      return
    }
    setBuilding(true)
    setBuildDone(null)
    setBuildLog([])
    setShowBuildLog(true)

    const appendLog = (line: string) => setBuildLog(l => [...l, line])

    try {
      appendLog(`[Build] ▶  ${project.name}  ·  ${cfg.buildMode || 'debug'}  ·  ${(cfg.targets || ['apk']).join(' + ')}`)

      // Normalize appConfig
      const rawCfg = (project as any)?._configs?.['app-config.json'] || {}
      const normalizedAppConfig = {
        baseUrl:          rawCfg.baseUrl          || '',
        aesKey:           rawCfg.aesKey           || '',
        encryptValues:    rawCfg.encryptValues     ?? true,
        logLevel:         (rawCfg.logLevel         || 'info').toLowerCase(),
        tokenExpiry:      rawCfg.tokenExpiry       || 3600,
        sessionTimeout:   rawCfg.sessionTimeout    || 1800,
        maxRetries:       rawCfg.maxRetries        || 3,
        splashDuration:   rawCfg.splashDuration    || 3,
        postSplashRoute:  rawCfg.postSplashRoute   || '',
        biometricEnabled: rawCfg.biometricEnabled  ?? false,
        analyticsEnabled: rawCfg.analyticsEnabled  ?? false,
        debugMode:        rawCfg.debugMode         ?? true,
        fcmSenderId:      rawCfg.fcmSenderId       || '',
        activeEnv:        rawCfg.activeEnv         || 'dev',
        environments: Object.fromEntries(
          Object.entries(rawCfg.environments || {}).map(([k, v]: [string, any]) => [k, {
            baseUrl:  v.baseUrl  || '',
            logLevel: (v.logLevel || 'info').toLowerCase(),
            mockMode: v.mockMode ?? false,
          }])
        ),
      }

      const screenNames = Object.values(project.screens || {}).map((s: any) => s.name)
      const payload = {
        projectPath:         projectFilePath,
        projectName:         project.name,
        packageName:         project.packageName,
        appConfig:           normalizedAppConfig,
        buildConfig:         cfg,
        screenNames,
        initialRoute:        (project as any).initialRoute || '/',
        projectDependencies: (project as any).dependencies || {},
      }

      let res: Response
      try {
        res = await fetch(ENGINE + '/api/build/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (netErr: any) {
        throw new Error('Cannot reach engine at ' + ENGINE + ' — is it running? (' + netErr.message + ')')
      }

      if (!res.ok) {
        let detail = ''
        try { detail = await res.text() } catch {}
        throw new Error(`HTTP ${res.status}${detail ? ' — ' + detail.slice(0, 200) : ''}`)
      }

      if (!res.body) throw new Error('No response body from build endpoint')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const rawLine of chunk.split('\n')) {
          const t = rawLine.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (!data) continue
          if (data === '[DONE]') { setBuildDone('success'); setBuilding(false); return }
          if (data.startsWith('[ERROR]')) {
            appendLog('✗ ' + data.slice(7)); setBuildDone('error'); setBuilding(false); return
          }
          appendLog(data)
        }
      }
      setBuildDone('success')
    } catch (e: any) {
      appendLog('✗ ' + e.message)
      setBuildDone('error')
    } finally {
      setBuilding(false)
    }
  }, [project, projectFilePath, buildConfig])

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!project || !projectFilePath || !isDirty) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const ff = (window as any).flutterForge
        if (!ff?.project?.saveFolder) return
        const folderPath = projectFilePath
        const write = (rel: string, content: string) =>
          ff.project.saveScreen({ folderPath, relativePath: rel, content })

        // Save all dirty screens
        for (const [screenId, sf] of Object.entries(screenFiles)) {
          if ((sf as any).dirty && project.screens[screenId]) {
            const sc = project.screens[screenId]
            await ff.project.saveScreen({ folderPath, screenName: sc.name, screenJson: JSON.stringify(sc, null, 2), dartCode: (sf as any).dartCode || '', route: sc.route })
          }
        }
        // Save app.json
        await ff.project.saveAppJson(folderPath, project)
        // Save shared dart files
        for (const [, sf] of Object.entries(sharedFiles)) {
          if ((sf as any).dirty) await write('shared/' + (sf as any).filename, (sf as any).dartCode || '')
        }
        // Save integrations
        const intData = useIntegrationsStore.getState().getExportData()
        if (intData.dataFiles.length > 0 || intData.interfaces.length > 0) {
          await write('services/interfaces.json', JSON.stringify(intData, null, 2))
        }
        // Save assets
        for (const asset of ((project as any).assets || []) as any[]) {
          if (asset.dataUrl && asset.path) {
            try { await ff?.fs?.writeFileBase64(folderPath + '/' + asset.path, asset.dataUrl) } catch {}
          }
        }
      } catch (e) { console.warn('[AutoSave]', e) }
    }, 1500)
  }, [isDirty, project, projectFilePath, activeScreenId])

  // Ctrl+S
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.key === 'p' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowProjMgr(true) }
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setShowCopilot(c => !c) }
      if (e.key === 'b' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleBuild() }
      if (e.key === '?' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); setShowShortcuts(s => !s) }
      if (e.key === 'Escape') { setShowShortcuts(false) }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && e.ctrlKey && e.shiftKey)) { e.preventDefault(); redo() }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (!project || !projectFilePath) return
        try {
          const ff = (window as any).flutterForge
          if (!ff) return
          const write = (rel: string, content: string) =>
            ff.project.saveScreen({ folderPath: projectFilePath, relativePath: rel, content })
          for (const [screenId, sf] of Object.entries(screenFiles)) {
            if (project.screens[screenId]) {
              const sc = project.screens[screenId]
              await ff.project.saveScreen({ folderPath: projectFilePath, screenName: sc.name, screenJson: JSON.stringify(sc, null, 2), dartCode: (sf as any).dartCode || '', route: sc.route })
            }
          }
          await ff.project.saveAppJson(projectFilePath, project)
          for (const [, sf] of Object.entries(sharedFiles)) {
            await write('shared/' + (sf as any).filename, (sf as any).dartCode || '')
          }
          const ctrlInt = useIntegrationsStore.getState().getExportData()
          if (ctrlInt.dataFiles.length > 0 || ctrlInt.interfaces.length > 0) {
            await write('services/interfaces.json', JSON.stringify(ctrlInt, null, 2))
          }
          for (const asset of ((project as any).assets || []) as any[]) {
            if (asset.dataUrl && asset.path) {
              try { await ff?.fs?.writeFileBase64(projectFilePath + '/' + asset.path, asset.dataUrl) } catch {}
            }
          }
        } catch (e) { console.warn('[Ctrl+S]', e) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [project, projectFilePath, screenFiles, sharedFiles, handleBuild, undo, redo])

  const eColor  = !engineChecked ? "#888" : engineReady ? "#2da44e" : "#e05252"
  const eBg     = !engineChecked ? "#1a1a2a" : engineReady ? "#0a1a0f" : "#1a0a0a"
  const eBorder = !engineChecked ? "#333"   : engineReady ? "#1a5c2e" : "#5c1a1a"
  const eLabel  = !engineChecked ? "..." : engineReady ? ":9876" : "offline"
  const screens = project ? Object.values(project.screens) : []

  // Activity bar active item
  const activeActivity = ACTIVITY_ITEMS.find(a => a.tab === activeTab)

  const buildBtnColor = building ? '#c9a227' : buildDone === 'success' ? '#4caf7d' : buildDone === 'error' ? '#e05252' : '#4a9edd'
  const buildBtnBg    = building ? '#1a1400' : buildDone === 'success' ? '#0a1a0f' : buildDone === 'error' ? '#1a0808' : '#0a0f1a'
  const buildBtnLabel = building ? '◌ Building…' : buildDone === 'success' ? '✓ Built' : buildDone === 'error' ? '✗ Failed' : '▶ Build'

  return (
    <div style={s.root}>
      {showProjMgr && <ProjectManager onClose={() => setShowProjMgr(false)} />}

      {/* ── D1: Keyboard shortcuts modal ─────────────────────────────── */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* ── D2: Welcome screen (no project open) ─────────────────────── */}
      {!project && (
        <WelcomeScreen
          onOpen={() => setShowProjMgr(true)}
          onShortcuts={() => setShowShortcuts(true)}
        />
      )}

      {/* ── Toolbar (top bar — slimmer, context-sensitive) ──────────────── */}
      <div style={s.toolbar}>
        {/* Logo + project */}
        <span style={{ color:"#7c5cbf", fontSize:16, flexShrink:0 }}>◆</span>
        <span style={{ fontWeight:700, color:"#e0d7ff", fontSize:13, marginLeft:6, marginRight:4, flexShrink:0 }}>
          Appzillon-New
        </span>
        <button onClick={() => setShowProjMgr(true)} style={s.fileBtn}>⊡ Project</button>

        <Sep />

        {/* Active section label */}
        {activeActivity && (
          <span style={{ fontSize:11, color: activeActivity.color, fontWeight:600, flexShrink:0, minWidth:70 }}>
            {activeActivity.label}
          </span>
        )}

        {/* Canvas-specific tools */}
        {activeTab === "canvas" && (
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <ToolBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</ToolBtn>
            <ToolBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪</ToolBtn>
            <Sep />
            <ToolBtn onClick={toggleGrid} active={gridEnabled} title="Grid">⊞</ToolBtn>
            <ToolBtn onClick={() => setZoom(zoom-0.1)} title="Zoom out">−</ToolBtn>
            <span style={{ fontSize:11, color:"#555", minWidth:34, textAlign:"center" as const }}>
              {Math.round(zoom*100)}%
            </span>
            <ToolBtn onClick={() => setZoom(zoom+0.1)} title="Zoom in">+</ToolBtn>
            <ToolBtn onClick={() => setZoom(1)} title="Reset zoom">⊙</ToolBtn>
          </div>
        )}

        <div style={{ flex:1 }} />

        {/* Save status */}
        {projectFilePath && (
          <span style={{ fontSize:10, color: isDirty ? '#c9a227' : '#2a4a2a',
            padding:'2px 8px', background:'#0a0a14', borderRadius:4,
            border:'1px solid #1e1e2e', fontFamily:'monospace', flexShrink:0 }}>
            {isDirty ? '● Unsaved' : '✓ Saved'}
          </span>
        )}

        <Sep />

        {/* ── Build button — always visible ── */}
        <button
          onClick={handleBuild}
          disabled={building}
          title="Build APK (Ctrl+B)"
          style={{
            padding:"4px 12px", borderRadius:6, border:`1px solid ${buildBtnColor}44`,
            background: buildBtnBg, color: buildBtnColor,
            cursor: building ? 'not-allowed' : 'pointer',
            fontSize:12, fontWeight:600, fontFamily:"system-ui,sans-serif",
            display:"flex", alignItems:"center", gap:5, flexShrink:0,
          }}>
          {buildBtnLabel}
        </button>

        {/* Build log toggle */}
        {buildLog.length > 0 && (
          <button
            onClick={() => setShowBuildLog(v => !v)}
            title="Toggle build log"
            style={{ ...s.fileBtn, color: buildDone === 'error' ? '#e05252' : '#555', padding:'4px 8px' }}>
            ☰ {buildLog.length}
          </button>
        )}

        <Sep />

        {/* Copilot toggle */}
        <button onClick={() => setShowCopilot(c => !c)} style={{
          padding:"4px 10px", borderRadius:6, border:"1px solid",
          background:  showCopilot ? "#1e1a33" : "#13132a",
          borderColor: showCopilot ? "#7c5cbf" : "#2a2a3a",
          color:       showCopilot ? "#c8a8ff"  : "#555",
          cursor:"pointer", fontSize:11, fontFamily:"system-ui,sans-serif",
          display:"flex", alignItems:"center", gap:4, flexShrink:0,
        }} title="AI Copilot (Ctrl+K)">
          <span style={{ fontSize:12 }}>◆</span> Copilot
        </button>

        {/* Engine status */}
        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px",
          borderRadius:16, background:eBg, border:"1px solid "+eBorder, flexShrink:0 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:eColor }} />
          <span style={{ fontSize:10, color:"#888" }}>{eLabel}</span>
        </div>
      </div>

      {/* ── Main layout: Activity Bar + content ─────────────────────────── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", position:"relative" as const }}>

        {/* ── Activity Bar (left icon strip) ────────────────────────────── */}
        <div style={s.activityBar}>
          {ACTIVITY_ITEMS.map(item => {
            const isActive = activeTab === item.tab
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.tab)}
                title={item.label}
                style={{
                  width:44, height:44, border:"none",
                  cursor:"pointer", display:"flex", flexDirection:"column" as const,
                  alignItems:"center", justifyContent:"center", gap:2,
                  borderLeft: isActive ? `2px solid ${item.color}` : "2px solid transparent",
                  background: isActive ? item.color + "14" : "transparent",
                  color: isActive ? item.color : "#3a3a5a",
                  transition:"all 0.12s",
                } as any}>
                <span style={{ fontSize: item.icon === '</>' ? 9 : 15, fontWeight: 600, lineHeight:1 }}>
                  {item.icon}
                </span>
                <span style={{ fontSize:8, letterSpacing:"0.03em", opacity: isActive ? 1 : 0.6 }}>
                  {item.label.split(' ')[0].substring(0,6)}
                </span>
              </button>
            )
          })}

          {/* Spacer + Copilot at bottom */}
          <div style={{ flex:1 }} />
          <button
            onClick={() => setShowCopilot(c => !c)}
            title="AI Copilot"
            style={{
              width:44, height:44, border:"none",
              cursor:"pointer", display:"flex", flexDirection:"column" as const,
              alignItems:"center", justifyContent:"center", gap:2,
              borderLeft: showCopilot ? "2px solid #9d7fe8" : "2px solid transparent",
              background: showCopilot ? "#9d7fe814" : "transparent",
              color: showCopilot ? "#9d7fe8" : "#3a3a5a",
            } as any}>
            <span style={{ fontSize:15 }}>◆</span>
            <span style={{ fontSize:8 }}>AI</span>
          </button>
        </div>

        {/* ── B2: Persistent screens strip — visible on ALL tabs ──────────── */}
        {activeTab !== "canvas" && (
          <div style={{ width:150, flexShrink:0, background:"#0a0a16",
            borderRight:"1px solid #1e1e2e", display:"flex", flexDirection:"column" as const,
            overflow:"hidden" }}>
            <div style={s.panelHeader}>
              <span style={s.pt}>SCREENS</span>
              <button onClick={() => { const n=screens.length+1; addScreen(`Screen${n}`,`/screen${n}`) }}
                style={s.addBtn}>+</button>
            </div>
            <div style={{ overflowY:'auto' as const, flex:1 }}>
              {screens.map(sc => {
                const isActive = activeScreenId === sc.id
                return (
                  <div key={sc.id} onClick={() => setActiveScreen(sc.id)} style={{
                    padding:"5px 10px", cursor:"pointer", fontSize:11,
                    background:  isActive ? "#1e1a33" : "transparent",
                    color:       isActive ? "#e0d7ff" : "#666",
                    borderLeft:  isActive ? "2px solid #7c5cbf" : "2px solid transparent",
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const,
                  }} title={sc.name}>{sc.name}</div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── B1+B2: Left panel (canvas) — Screens + Widget Tree ─────────── */}
        {activeTab === "canvas" && (
          <>
            <div style={{ ...s.leftPanel, width: leftResize.width }}>
              <div style={s.panelSection}>
                <div style={s.panelHeader}>
                  <span style={s.pt}>SCREENS</span>
                  <button
                    onClick={() => { const n=screens.length+1; addScreen(`Screen${n}`,`/screen${n}`) }}
                    style={s.addBtn}>+</button>
                </div>
                <div style={{ overflowY:'auto' as const, maxHeight:160 }}>
                  {screens.map(sc => {
                    const isRenaming = renamingScreenId === sc.id
                    const isActive   = activeScreenId === sc.id
                    return (
                      <div key={sc.id} onClick={() => setActiveScreen(sc.id)} style={{
                        ...s.screenItem,
                        background:  isActive ? "#1e1a33" : "transparent",
                        color:       isActive ? "#e0d7ff" : "#666",
                        borderLeft:  isActive ? "2px solid #7c5cbf" : "2px solid transparent",
                      }}>
                        {isRenaming ? (
                          <input autoFocus value={renameScreenVal}
                            onChange={e => setRenameScreenVal(e.target.value)}
                            onBlur={() => handleCommitScreenRename(sc.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  { e.stopPropagation(); handleCommitScreenRename(sc.id) }
                              if (e.key === 'Escape') { e.stopPropagation(); setRenamingScreenId(null) }
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ flex:1, padding:'1px 4px', background:'#0a0a14',
                              border:'1px solid #7c5cbf', borderRadius:3,
                              fontSize:11, color:'#e0d7ff', outline:'none', fontFamily:'monospace' }}
                          />
                        ) : (
                          <div style={{ flex:1, overflow:'hidden' }}>
                            <div style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis',
                              whiteSpace:'nowrap' as const, cursor:'text' }}
                              onDoubleClick={e => handleStartScreenRename(sc, e)}
                              title="Double-click to rename">
                              {sc.name}
                            </div>
                            {screenFiles[sc.id] && (
                              <div style={{ fontSize:9, color:'#555', fontFamily:'monospace', marginTop:1 }}>
                                {screenFiles[sc.id].filename}
                              </div>
                            )}
                          </div>
                        )}
                        {!isRenaming && (
                          <button onClick={e => handleStartScreenRename(sc, e)}
                            style={{ background:'none', border:'1px solid #3d3060', borderRadius:3,
                              color:'#9d7fe8', cursor:'pointer', fontSize:11, padding:'1px 5px',
                              lineHeight:1.2, flexShrink:0 }} title="Rename">✎</button>
                        )}
                        {screens.length > 1 && !isRenaming && (
                          <button onClick={e => { e.stopPropagation(); deleteScreen(sc.id) }}
                            style={{ background:"none", border:"none", color:"#444",
                              cursor:"pointer", fontSize:11, flexShrink:0 }}>×</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" as const,
                borderTop:"1px solid #1e1e2e" }}>
                <div style={s.panelHeader}>
                  <span style={s.pt}>WIDGET TREE</span>
                  <span style={{ fontSize:9, color:"#444" }}>
                    {activeScreen ? Object.keys(activeScreen.widgets).length : 0}
                  </span>
                </div>
                <WidgetTree />
              </div>
            </div>
            {/* Resize handle — left panel right edge */}
            <ResizeHandle onMouseDown={leftResize.onMouseDown} onDoubleClick={leftResize.reset} />
          </>
        )}

        {/* ── Palette (canvas only) + resize handle ───────────────────────── */}
        {activeTab === "canvas" && (
          <>
            <div style={{ ...s.palettePanel, width: paletteResize.width }}>
              <div style={{ display:'flex', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
                {([ ['widgets','⬡','#9d7fe8'], ['plugins','⊛','#e09b2d'], ['components','◈','#4caf7d'] ] as const).map(([id, icon, color]) => (
                  <button key={id} onClick={() => setPaletteTab(id as any)} style={{
                    flex:1, padding:'6px 0', fontSize:10, fontWeight:700, cursor:'pointer',
                    background: paletteTab===id ? '#0d0d1e' : 'transparent',
                    color:      paletteTab===id ? color : '#444',
                    border:'none', borderBottom: paletteTab===id ? `2px solid ${color}` : '2px solid transparent',
                    fontFamily:'system-ui,sans-serif',
                  }}>{icon} {id.charAt(0).toUpperCase()+id.slice(1,4)}</button>
                ))}
              </div>
              {paletteTab === 'widgets' && (
                <>
                  <WidgetPalette onDragStart={setDraggedItem} />
                  <div style={{ borderTop:'1px solid #1e1e2e', overflowY:'auto' as const, flexShrink:0, maxHeight:220 }}>
                    <FieldsPanel />
                  </div>
                </>
              )}
              {paletteTab === 'plugins' && (
                <NativePluginPalette
                  onDragStart={(plugin) => setDraggedPlugin(plugin)}
                  onDrop={(plugin) => handlePluginDrop(plugin)} />
              )}
              {paletteTab === 'components' && <ComponentLibrary />}
            </div>
            {/* Resize handle — palette right edge */}
            <ResizeHandle onMouseDown={paletteResize.onMouseDown} onDoubleClick={paletteResize.reset} />
          </>
        )}

        {/* ── Centre content ────────────────────────────────────────────── */}
        <div style={s.centre}>
          {activeTab === "canvas"     && <Canvas
            draggedItem={draggedItem} onDragEnd={() => setDraggedItem(null)}
            draggedPlugin={draggedPlugin}
            onPluginDrop={(plugin) => { handlePluginDrop(plugin); setDraggedPlugin(null) }}
            onSaveAsComponent={(widgetIds, screenId) => setSaveAsComp({ widgetIds, screenId })} />}
          {activeTab === "navigation" && <NavigationDesigner />}
          {activeTab === "code"       && <CodeEditor engineUrl={ENGINE} />}
          {activeTab === "codegen"    && <CodegenPanel engineUrl={ENGINE} />}
          {activeTab === "theme"      && <ThemeEditor />}
          {activeTab === "preview"    && <PhonePreview />}
          {activeTab === "figma"      && <FigmaImporter />}
          {activeTab === "assets"     && <AssetsManager />}
          {activeTab === "config"     && <ConfigPanel engineUrl={ENGINE} />}
          {activeTab === "datafiles"  && <DataFilesPanel />}
          {activeTab === "interfaces" && <InterfacesPanel engineUrl={ENGINE} />}

          {/* ── Build log panel (bottom, collapsible) ─────────────────── */}
          {showBuildLog && buildLog.length > 0 && (
            <div style={{
              flexShrink:0, height:200, background:"#06060f",
              borderTop:`1px solid ${buildDone === 'error' ? '#5c1a1a' : buildDone === 'success' ? '#1a5c2e' : '#1e1e2e'}`,
              display:"flex", flexDirection:"column" as const,
            }}>
              {/* Log header */}
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px",
                background:"#0a0a14", borderBottom:"1px solid #1e1e2e", flexShrink:0 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background: buildBtnColor, flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:700, color: buildBtnColor, letterSpacing:"0.06em" }}>
                  BUILD LOG
                </span>
                <span style={{ fontSize:10, color:"#444", marginLeft:4 }}>
                  {building ? '◌ Running…' : buildDone === 'success' ? '✓ Success' : buildDone === 'error' ? '✗ Failed' : ''}
                </span>
                <div style={{ flex:1 }} />
                <button onClick={() => setBuildLog([])}
                  style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:11 }}>
                  Clear
                </button>
                <button onClick={() => setShowBuildLog(false)}
                  style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:14 }}>
                  ×
                </button>
              </div>
              {/* Log lines */}
              <div ref={logRef} style={{ flex:1, overflowY:"auto" as const, padding:"8px 14px", fontFamily:"monospace", fontSize:11 }}>
                {buildLog.map((line, i) => {
                  const isErr = line.startsWith('✗') || line.toLowerCase().includes('error')
                  const isOk  = line.startsWith('✓') || line.includes('[DONE]')
                  return (
                    <div key={i} style={{
                      color: isErr ? '#e05252' : isOk ? '#4caf7d' : '#8892a4',
                      lineHeight:1.7, whiteSpace:'pre-wrap' as const,
                    }}>{line}</div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Save as Component modal */}
        {saveAsComp && (
          <SaveAsComponentModal
            widgetIds={saveAsComp.widgetIds} screenId={saveAsComp.screenId}
            onClose={() => setSaveAsComp(null)}
            onSaved={() => { setSaveAsComp(null); setPaletteTab('components') }} />
        )}

        {/* Plugin drop toast */}
        {pluginDropped && (
          <div style={{ position:"absolute" as const, bottom:36, left:"50%", transform:"translateX(-50%)",
            background:"#0a1a0f", border:"1px solid #1a5c2e", borderRadius:10,
            padding:"10px 18px", display:"flex", alignItems:"center", gap:10,
            fontSize:12, color:"#4caf7d", zIndex:999,
            whiteSpace:"nowrap" as const, pointerEvents:"none" as const }}>
            <span style={{ fontSize:16 }}>{pluginDropped.plugin.icon}</span>
            <div>
              <div style={{ fontWeight:600 }}>{pluginDropped.toast}</div>
              <div style={{ fontSize:10, color:"#2a7a4a", marginTop:2 }}>
                Switch to Code tab to customise
              </div>
            </div>
          </div>
        )}

        {/* Docked Copilot */}
        {showCopilot && (
          <div style={s.copilotPanel}>
            <AICopilot engineUrl={ENGINE} />
          </div>
        )}

        {/* Right panel — Properties (canvas only) */}
        {activeTab === "canvas" && (
          <>
            {/* Resize handle — right panel left edge */}
            <ResizeHandle onMouseDown={rightResize.onMouseDown} onDoubleClick={rightResize.reset} side="left" />
            <div style={{ ...s.rightPanel, width: rightResize.width }}>
              <PropertiesPanel />
              <div style={{ borderTop:"1px solid #1e1e2e", padding:10 }}>
                <button onClick={() => setShowProjMgr(true)} style={s.importExportBtn}>
                  ⊡ Import / Export
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div style={s.statusBar}>
        <span style={{ color:"#555" }}>Appzillon-New</span>
        {project && <><span style={{ color:"#333", margin:"0 4px" }}>›</span>
          <span style={{ color:"#666" }}>{project.name}</span></>}
        {activeActivity && <><span style={{ color:"#333", margin:"0 4px" }}>›</span>
          <span style={{ color: activeActivity.color, fontSize:10 }}>{activeActivity.label}</span></>}
        {activeTab === "canvas" && activeScreen && <>
          <span style={{ color:"#333", margin:"0 4px" }}>›</span>
          <span style={{ color:"#888", fontSize:10 }}>{activeScreen.name}</span>
        </>}
        <span style={{ marginLeft:"auto", color:"#333", fontSize:10, cursor:"pointer" }}
          onClick={() => setShowShortcuts(true)}
          title="View all keyboard shortcuts (Ctrl+Shift+?)">
          Ctrl+B = Build · Ctrl+P = Project · Ctrl+? = Shortcuts
        </span>
      </div>
    </div>
  )
}

function ToolBtn({ children, onClick, disabled, title, active }: {
  children:React.ReactNode; onClick:()=>void; disabled?:boolean; title?:string; active?:boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width:26, height:26, background: active?"#1e1a33":"#13132a",
      border:`1px solid ${active?"#3d3060":"#2a2a3a"}`, borderRadius:4,
      color:disabled?"#333":active?"#9d7fe8":"#888",
      cursor:disabled?"not-allowed":"pointer", fontSize:14,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>{children}</button>
  )
}
function Sep() { return <div style={{ width:1, height:18, background:"#1e1e2e", margin:"0 4px" }} /> }

// ── B1: Resize handle component ───────────────────────────────────────────────
function ResizeHandle({ onMouseDown, onDoubleClick, side = 'right' }: {
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
  side?: 'left' | 'right'
}) {
  const [hover, setHover] = React.useState(false)
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Drag to resize · Double-click to reset"
      style={{
        width: 4, flexShrink: 0, cursor: 'col-resize',
        background: hover ? '#7c5cbf66' : 'transparent',
        borderLeft:  side === 'left'  ? `1px solid ${hover ? '#7c5cbf' : '#1e1e2e'}` : 'none',
        borderRight: side === 'right' ? `1px solid ${hover ? '#7c5cbf' : '#1e1e2e'}` : 'none',
        transition: 'background 0.1s, border-color 0.1s',
        zIndex: 10,
      }}
    />
  )
}

// ── D1: Keyboard Shortcuts Modal ─────────────────────────────────────────────

const SHORTCUT_GROUPS = [
  {
    label: 'Canvas', color: '#9d7fe8',
    items: [
      { keys: ['Ctrl', 'Z'],         desc: 'Undo' },
      { keys: ['Ctrl', 'Y'],         desc: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'],desc: 'Redo (alternate)' },
      { keys: ['Ctrl', 'Scroll'],    desc: 'Zoom in / out' },
      { keys: ['Delete'],            desc: 'Delete selected widget' },
      { keys: ['Escape'],            desc: 'Deselect / close modal' },
    ],
  },
  {
    label: 'Project & Build', color: '#4caf7d',
    items: [
      { keys: ['Ctrl', 'S'],   desc: 'Save project' },
      { keys: ['Ctrl', 'P'],   desc: 'Open project manager' },
      { keys: ['Ctrl', 'B'],   desc: 'Build APK' },
    ],
  },
  {
    label: 'Navigation', color: '#4a9edd',
    items: [
      { keys: ['Ctrl', 'K'],   desc: 'Toggle AI Copilot' },
      { keys: ['Ctrl', '1'],   desc: 'Canvas tab' },
      { keys: ['Ctrl', '2'],   desc: 'Theme tab' },
      { keys: ['Ctrl', '3'],   desc: 'Preview tab' },
      { keys: ['Ctrl', '4'],   desc: 'Code tab' },
    ],
  },
  {
    label: 'Panels', color: '#c9a227',
    items: [
      { keys: ['Ctrl', 'Shift', '?'], desc: 'This shortcuts panel' },
      { keys: ['Dbl-click', 'handle'], desc: 'Reset panel to default width' },
      { keys: ['Dbl-click', 'screen'], desc: 'Rename screen' },
    ],
  },
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = React.useState('')

  const filtered = SHORTCUT_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i =>
      !search || i.desc.toLowerCase().includes(search.toLowerCase()) ||
      i.keys.some(k => k.toLowerCase().includes(search.toLowerCase()))
    ),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{
      position:'fixed' as const, inset:0, zIndex:9000,
      background:'rgba(0,0,0,0.7)', display:'flex',
      alignItems:'center', justifyContent:'center',
    }} onClick={onClose}>
      <div style={{
        background:'#0d0d1a', border:'1px solid #2a2a3a', borderRadius:16,
        width:560, maxHeight:'80vh', display:'flex', flexDirection:'column' as const,
        boxShadow:'0 24px 80px rgba(0,0,0,0.9)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 20px', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#e0d7ff' }}>Keyboard Shortcuts</div>
            <div style={{ fontSize:11, color:'#444', marginTop:2 }}>Ctrl+Shift+? to open anytime</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'#555', cursor:'pointer', fontSize:18, padding:'4px 8px' }}>×</button>
        </div>
        {/* Search */}
        <div style={{ padding:'10px 20px', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search shortcuts..."
            style={{ width:'100%', padding:'7px 12px', background:'#0a0a14',
              border:'1px solid #2a2a3a', borderRadius:8, color:'#d4d4d4',
              fontSize:12, outline:'none', boxSizing:'border-box' as const }}/>
        </div>
        {/* Groups */}
        <div style={{ overflowY:'auto' as const, padding:'8px 20px 20px' }}>
          {filtered.map(group => (
            <div key={group.label} style={{ marginTop:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:group.color,
                letterSpacing:'0.08em', textTransform:'uppercase' as const,
                marginBottom:8 }}>
                {group.label}
              </div>
              {group.items.map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center',
                  justifyContent:'space-between', padding:'6px 0',
                  borderBottom:'1px solid #0f0f1a' }}>
                  <span style={{ fontSize:12, color:'#888' }}>{item.desc}</span>
                  <div style={{ display:'flex', gap:4 }}>
                    {item.keys.map((k, ki) => (
                      <React.Fragment key={ki}>
                        <kbd style={{
                          padding:'2px 7px', background:'#1a1a2e',
                          border:'1px solid #2a2a3a', borderRadius:5,
                          fontSize:11, color:'#d4d4d4', fontFamily:'monospace',
                          borderBottom:'2px solid #2a2a3a',
                        }}>{k}</kbd>
                        {ki < item.keys.length - 1 && (
                          <span style={{ fontSize:10, color:'#333', alignSelf:'center' }}>+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding:'32px 0', textAlign:'center' as const, color:'#444', fontSize:13 }}>
              No shortcuts match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── D2: Welcome Screen ────────────────────────────────────────────────────────

function WelcomeScreen({ onOpen, onShortcuts }: {
  onOpen: () => void
  onShortcuts: () => void
}) {
  return (
    <div style={{
      position:'fixed' as const, inset:0, zIndex:500,
      background:'#0d0d1a', display:'flex', flexDirection:'column' as const,
      alignItems:'center', justifyContent:'center', gap:0,
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <span style={{ fontSize:48, color:'#7c5cbf' }}>◆</span>
        <div>
          <div style={{ fontSize:28, fontWeight:700, color:'#e0d7ff', letterSpacing:'-0.5px' }}>
            Appzillon-New
          </div>
          <div style={{ fontSize:13, color:'#555', marginTop:2 }}>
            Visual Flutter App Builder · Powered by AI
          </div>
        </div>
      </div>

      {/* Feature strip */}
      <div style={{ display:'flex', gap:24, margin:'28px 0', opacity:0.6 }}>
        {[
          ['⬡', 'Visual Canvas'],
          ['</>','Dart Codegen'],
          ['▶', 'Build APK'],
          ['◆', 'AI Copilot'],
        ].map(([icon, label]) => (
          <div key={label} style={{ display:'flex', flexDirection:'column' as const,
            alignItems:'center', gap:6 }}>
            <span style={{ fontSize:22, color:'#9d7fe8' }}>{icon}</span>
            <span style={{ fontSize:11, color:'#555' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ display:'flex', gap:12, marginBottom:36 }}>
        <button onClick={onOpen} style={{
          padding:'12px 32px', background:'#7c5cbf',
          border:'none', borderRadius:10, color:'#fff',
          fontSize:14, fontWeight:600, cursor:'pointer',
          fontFamily:'system-ui,sans-serif',
        }}>
          ⊡ Open / New Project
        </button>
        <button onClick={onShortcuts} style={{
          padding:'12px 20px', background:'transparent',
          border:'1px solid #2a2a3a', borderRadius:10, color:'#666',
          fontSize:13, cursor:'pointer', fontFamily:'system-ui,sans-serif',
        }}>
          ⌨ Shortcuts
        </button>
      </div>

      {/* Flow diagram */}
      <div style={{ display:'flex', alignItems:'center', gap:8,
        padding:'14px 28px', background:'#0a0a14', borderRadius:12,
        border:'1px solid #1a1a2e' }}>
        {[
          ['⬡', 'Design', '#9d7fe8'],
          null,
          ['◈', 'Bind Data', '#4caf7d'],
          null,
          ['</>','Codegen', '#4a9edd'],
          null,
          ['▶', 'Build', '#c9a227'],
        ].map((item, i) => item ? (
          <div key={i} style={{ display:'flex', flexDirection:'column' as const,
            alignItems:'center', gap:4 }}>
            <span style={{ fontSize:16, color: item[2] as string }}>{item[0]}</span>
            <span style={{ fontSize:10, color:'#444' }}>{item[1]}</span>
          </div>
        ) : (
          <span key={i} style={{ fontSize:14, color:'#2a2a3a' }}>→</span>
        ))}
      </div>

      <div style={{ marginTop:16, fontSize:11, color:'#333' }}>
        Ctrl+P to open project · Ctrl+Shift+? for shortcuts
      </div>
    </div>
  )
}

const s: Record<string,React.CSSProperties> = {
  root:          { display:"flex", flexDirection:"column", height:"100vh", background:"#0d0d1a",
                   color:"#ccc", fontFamily:"system-ui,sans-serif", fontSize:13, overflow:"hidden" },
  toolbar:       { display:"flex", alignItems:"center", height:36, padding:"0 10px", gap:6,
                   background:"#060610", borderBottom:"1px solid #14142a", flexShrink:0, overflow:"hidden" },
  fileBtn:       { padding:"3px 9px", background:"#0e0e20", border:"1px solid #22223a", borderRadius:5,
                   color:"#9d7fe8", cursor:"pointer", fontSize:11, fontFamily:"system-ui,sans-serif",
                   flexShrink:0, whiteSpace:"nowrap" as const },
  activityBar:   { width:44, flexShrink:0, background:"#060610", borderRight:"1px solid #14142a",
                   display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  // leftPanel / palettePanel / rightPanel widths are dynamic via useResize — these are base styles only
  leftPanel:     { flexShrink:0, background:"#0a0a16", borderRight:"1px solid #1e1e2e",
                   display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  palettePanel:  { flexShrink:0, background:"#0a0a16", borderRight:"1px solid #1e1e2e",
                   display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  rightPanel:    { flexShrink:0, background:"#0a0a16", borderLeft:"1px solid #1e1e2e",
                   display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  copilotPanel:  { width:340, flexShrink:0, background:"#0a0a16", borderLeft:"1px solid #1e1e2e",
                   display:"flex", flexDirection:"column" as const, overflow:"hidden" },
  centre:        { flex:1, overflow:"hidden", display:"flex", flexDirection:"column" as const },
  panelSection:  { borderBottom:"1px solid #1e1e2e" },
  panelHeader:   { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px 4px" },
  pt:            { fontSize:9, fontWeight:700, color:"#444", letterSpacing:"0.08em" },
  addBtn:        { width:18, height:18, background:"#1e1a33", border:"1px solid #3d3060", borderRadius:3,
                   color:"#9d7fe8", cursor:"pointer", fontSize:14, display:"flex",
                   alignItems:"center", justifyContent:"center", lineHeight:1 },
  screenItem:    { display:"flex", alignItems:"center", gap:4, padding:"5px 12px",
                   cursor:"pointer", fontSize:12 },
  importExportBtn:{ width:"100%", padding:"7px", background:"#13132a", border:"1px solid #3d3060",
                    borderRadius:8, color:"#9d7fe8", cursor:"pointer", fontSize:11,
                    fontFamily:"system-ui,sans-serif" },
  statusBar:     { display:"flex", alignItems:"center", height:22, padding:"0 16px",
                   background:"#080813", borderTop:"1px solid #1e1e2e", fontSize:11,
                   color:"#555", flexShrink:0 },
}
