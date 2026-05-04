import React, { useState, useRef, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import { useIntegrationsStore } from '../../store/integrations.store'
import { useProjectStore, type ServiceEntry, type GatewayEntry } from '../../store/project.store'
import { useCodeStore, type ScreenCodeFile, type ServiceCodeFile, type SharedCodeFile } from '../../store/code.store'
import type { FlutterForgeProject } from '../../types/widget.schema'

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

interface ProjectBundle {
  version:      string          // bundle format version
  exportedAt:   string
  exportedBy:   string
  checksum:     string

  // Flutter project (Canvas tab)
  flutterProject: FlutterForgeProject

  // Service graph (Services tab)
  serviceGraph: {
    gateway:  GatewayEntry
    services: ServiceEntry[]
  }

  // Code files (Code tab) — Dart, Java, Shared
  codeFiles: {
    screenFiles:  Record<string, ScreenCodeFile>
    serviceFiles: Record<string, ServiceCodeFile>
    sharedFiles:  SharedCodeFile[]
  }

  // Summary
  meta: {
    name:        string
    packageName: string
    projectVersion: string
    screens:     number
    widgets:     number
    services:    number
    providers:   number
    microservices:  number
    dartFiles:     number
    javaFiles:     number
    sharedFiles:   number
  }
}

type ImportStatus = 'idle' | 'dragging' | 'validating' | 'success' | 'error'

interface Props { onClose: () => void }

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

export default function ProjectManager({ onClose }: Props): JSX.Element {
  const { project } = useCanvasStore()
  const [tab, setTab] = useState<'new' | 'open' | 'save' | 'recent' | 'settings'>(
    project ? 'settings' : 'new'
  )

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <div style={s.headerLeft}>
            <span style={{ fontSize:20, color:'#7c5cbf' }}>◆</span>
            <div>
              <div style={s.modalTitle}>Project Manager</div>
              <div style={s.modalSub}>Folder-based · auto-save · undo/redo</div>
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.tabRow}>
          {([
            { id:'new',      icon:'✦',  label:'New'      },
            { id:'open',     icon:'📂', label:'Open'     },
            { id:'save',     icon:'💾', label:'Save'     },
            { id:'recent',   icon:'◷',  label:'Recent'   },
            { id:'settings', icon:'⚙', label:'Settings'  },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              ...s.tabBtn,
              background:   tab===t.id ? '#1e1a33' : 'transparent',
              color:        tab===t.id ? '#e0d7ff' : '#555',
              borderBottom: tab===t.id ? '2px solid #7c5cbf' : '2px solid transparent',
            }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div style={s.modalBody}>
          {tab === 'new'      && <NewProjectPanel onClose={onClose} />}
          {tab === 'open'     && <OpenProjectPanel onClose={onClose} />}
          {tab === 'save'     && <SaveProjectPanel onClose={onClose} />}
          {tab === 'recent'   && <RecentPanel />}
          {tab === 'settings' && <ProjectSettingsPanel onClose={onClose} />}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// EXPORT PANEL
// ─────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────
// NEW PROJECT PANEL
// ─────────────────────────────────────────────────────────

function NewProjectPanel({ onClose }: { onClose: () => void }) {
  const { newProject } = useCanvasStore()
  const codeStore       = useCodeStore()

  const [name,    setName]    = React.useState('MyApp')
  const [pkg,     setPkg]     = React.useState('')
  const [version, setVersion] = React.useState('1.0.0')
  const [desc,    setDesc]    = React.useState('')
  const [created, setCreated] = React.useState(false)

  const handleCreate = () => {
    if (!name.trim()) return
    // Reset code store
    Object.keys(codeStore.screenFiles).forEach(id => codeStore.deleteScreenFile(id))
    Object.keys(codeStore.serviceFiles).forEach(id => codeStore.deleteServiceFile(id))
    codeStore.sharedFiles.forEach(f => codeStore.deleteSharedFile(f.id))
    // Create new project
    newProject(name.trim(), pkg.trim() || 'com.' + name.trim().toLowerCase().replace(/[^a-z0-9]/g,'') + '.app')
    // Reset integrations store for fresh project
    useIntegrationsStore.getState().loadFromProject({ dataFiles: [], interfaces: [] })
    // Reset Services store — clear any stale services from previous project
    useProjectStore.getState().resetToDefault()
    setCreated(true)
    setTimeout(() => onClose(), 1200)
  }

  if (created) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, gap:12 }}>
      <div style={{ fontSize:32, color:'#4caf7d' }}>✓</div>
      <div style={{ fontSize:15, fontWeight:700, color:'#e0d7ff' }}>Project created!</div>
      <div style={{ fontSize:12, color:'#555' }}>Closing...</div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ padding:'12px 16px', background:'rgba(29,185,84,0.08)', borderRadius:10, border:'1px solid rgba(29,185,84,0.2)', fontSize:12, color:'#4caf7d', lineHeight:1.7 }}>
        Creates a blank project and resets the Canvas. Export your current project first if you want to keep it.
      </div>

      <div>
        <div style={s.fieldLabel}>App Name *</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. My Banking App"
          style={s.fieldInput} />
      </div>
      <div>
        <div style={s.fieldLabel}>Package Name</div>
        <input value={pkg} onChange={e => setPkg(e.target.value)}
          placeholder="e.g. com.yourcompany.appname"
          style={s.fieldInput} />
      </div>
      <div>
        <div style={s.fieldLabel}>Version</div>
        <input value={version} onChange={e => setVersion(e.target.value)}
          placeholder="1.0.0"
          style={s.fieldInput} />
      </div>
      <div>
        <div style={s.fieldLabel}>Description (optional)</div>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Short description of the app"
          style={s.fieldInput} />
      </div>

      <button onClick={handleCreate} disabled={!name.trim()} style={{
        ...s.primaryBtn,
        opacity: name.trim() ? 1 : 0.4,
        marginTop:6,
      }}>
        ✦ Create New Project
      </button>
    </div>
  )
}


// ─────────────────────────────────────────────────────────
// OPEN PROJECT PANEL
// ─────────────────────────────────────────────────────────

function OpenProjectPanel({ onClose }: { onClose: () => void }) {
  const { setProject, setFilePath } = useCanvasStore()
  const codeStore = useCodeStore()
  const [status,  setStatus]  = React.useState<'idle'|'loading'|'success'|'error'>('idle')
  const [error,   setError]   = React.useState('')
  const [summary, setSummary] = React.useState<{name:string;screens:number;codeFiles:number}|null>(null)

  const handleOpen = async () => {
    console.log('[Open] button clicked')
    setStatus('loading'); setError('')
    try {
      // Debug: check what's available
      const ff = (window as any).flutterForge
      console.log('[Open] flutterForge:', ff ? Object.keys(ff) : 'undefined')
      console.log('[Open] fs keys:', ff?.fs ? Object.keys(ff.fs) : 'undefined')

      if (!ff?.fs?.chooseOutputDir) {
        setStatus('error')
        setError('IDE bridge not ready. Please restart Electron (npm run dev).')
        return
      }

      const rawFolderPath: string | null = await ff.fs.chooseOutputDir()
      console.log('[Open] chosen folder:', rawFolderPath)
      if (!rawFolderPath) { setStatus('idle'); return }

      // Normalise to forward-slashes (Windows returns backslashes)
      const folderPath = rawFolderPath.replace(/\\/g, '/')

      // Read app.json using existing fs:readFile
      let appJson: any
      try {
        // @ts-ignore
        const appJsonText = await window.flutterForge?.fs?.readFile(folderPath + '/app.json')
        if (!appJsonText || appJsonText.trim() === '') throw new Error('empty')
        appJson = JSON.parse(appJsonText)
        if (!appJson.name) throw new Error('missing name field')
      } catch (e: any) {
        setStatus('error')
        setError(
          e?.message?.includes('ENOENT') || e?.message?.includes('not found') || e?.message?.includes('empty')
            ? 'app.json not found — make sure you selected the .appzillon project folder (the folder that contains app.json directly inside it)'
            : 'Invalid app.json: ' + (e?.message || 'parse error')
        )
        return
      }

      // Build full project — preserve inline screens from app.json (old format support)
      const inlineScreens: Record<string, any> = appJson.screens || {}
      const fullProject: any = { ...appJson, screens: {}, services: {}, stateProviders: {}, assets: [] }

      // Determine which screens to load — in priority order:
      // 1. screenNames array in app.json (new format, written on every save)
      // 2. names derived from inline screens object (old format — screens stored in app.json directly)
      // Never fall back to hardcoded names — every project defines its own screens
      const inlineScreenNames: string[] = Object.values(inlineScreens)
        .map((s: any) => s.name)
        .filter(Boolean)
      const screenNames: string[] = appJson.screenNames?.length > 0
        ? appJson.screenNames
        : inlineScreenNames

      let codeFileCount = 0
      for (const screenName of screenNames) {
        try {
          const screenPath = folderPath + '/screens/' + screenName + '/screen.json'
          // @ts-ignore
          const screenText = await window.flutterForge?.fs?.readFile(screenPath)
          const screenDef  = JSON.parse(screenText)
          const sid        = screenDef.id || ('screen-' + screenName.toLowerCase())

          // If screen.json has no widgets, check if inline app.json has widget data
          // This recovers from the bug where screen.json was saved empty
          const inlineSc   = Object.values(inlineScreens).find((s: any) => s.name === screenName) as any
          const widgets    = (screenDef.widgets && Object.keys(screenDef.widgets).length > 0)
            ? screenDef.widgets
            : (inlineSc?.widgets && Object.keys(inlineSc.widgets).length > 0)
              ? inlineSc.widgets
              : {}
          const rootWidgetId = screenDef.rootWidgetId ||
            (Object.keys(widgets).length > 0 ? inlineSc?.rootWidgetId : undefined)

          fullProject.screens[sid] = { ...screenDef, ...( inlineSc || {}), id: sid, widgets, rootWidgetId: rootWidgetId || screenDef.rootWidgetId }

          // Try reading dart file
          const snakeCase = screenName.replace(/([A-Z])/g, (m,l,i) => (i>0?'_':'')+l.toLowerCase())
          const dartPath  = folderPath + '/screens/' + screenName + '/' + snakeCase + '.dart'
          try {
            // @ts-ignore
            const dartCode = await window.flutterForge?.fs?.readFile(dartPath)
            codeStore.initScreenFile(sid, screenName, screenDef.route || '/')
            codeStore.updateScreenCode(sid, dartCode)
            codeFileCount++
          } catch { /* no dart file — ok */ }
        } catch {
          // screen.json not found — use inline data from app.json (old single-file format)
          const inlineSc = Object.values(inlineScreens).find((s: any) => s.name === screenName) as any
          if (inlineSc) {
            const sid = inlineSc.id || ('screen-' + screenName.toLowerCase())
            fullProject.screens[sid] = { ...inlineSc, id: sid, widgets: inlineSc.widgets || {} }
            const snakeCase = screenName.replace(/([A-Z])/g, (m,l,i) => (i>0?'_':'')+l.toLowerCase())
            const dartPath  = folderPath + '/screens/' + screenName + '/' + snakeCase + '.dart'
            try {
              // @ts-ignore
              const dartCode = await window.flutterForge?.fs?.readFile(dartPath)
              codeStore.initScreenFile(sid, screenName, inlineSc.route || '/')
              codeStore.updateScreenCode(sid, dartCode)
              codeFileCount++
            } catch { /* no dart file — ok */ }
          }
        }
      }

      // Last resort: if no screens loaded at all, restore everything directly from app.json
      if (Object.keys(fullProject.screens).length === 0 && Object.keys(inlineScreens).length > 0) {
        for (const [sid, sc] of Object.entries(inlineScreens)) {
          fullProject.screens[sid] = { ...(sc as any), id: sid, widgets: (sc as any).widgets || {} }
        }
      }

      // Read shared files — use sharedFileNames from app.json if available, else scan defaults
      // Only load shared files that are explicitly listed in app.json
      // Never guess file names — each project defines its own shared files
      const sharedNames: string[] = appJson.sharedFileNames || []
      for (const fname of sharedNames) {
        try {
          const ff2 = (window as any).flutterForge
          const code = await ff2?.fs?.readFile(folderPath + '/shared/' + fname)
          if (!code) continue
          const lang: 'dart'|'java' = fname.endsWith('.java') ? 'java' : 'dart'
          const existing = useCodeStore.getState().sharedFiles.find((f: any) => f.filename === fname)
          if (existing) {
            codeStore.updateSharedCode(existing.id, code)
          } else {
            codeStore.addSharedFile(fname, lang)
            const added = useCodeStore.getState().sharedFiles.find((f: any) => f.filename === fname)
            if (added) codeStore.updateSharedCode(added.id, code)
          }
          codeFileCount++
        } catch { /* file not found — skip */ }
      }

      // Read data/ files (JSON datasets, LOVs, mock data)
      const dataFileNames: string[] = appJson.dataFileNames || []
      const loadedDataFiles: Record<string,string> = {}
      for (const dfn of dataFileNames) {
        try {
          const ff3 = (window as any).flutterForge
          const txt = await ff3?.fs?.readFile(folderPath + '/data/' + dfn)
          if (txt) { loadedDataFiles[dfn] = txt; codeFileCount++ }
        } catch {}
      }
      if (Object.keys(loadedDataFiles).length > 0) {
        fullProject._dataFiles = loadedDataFiles
      }

      // Read config files — app-config.json + build-config.json + others
      const configFiles = ['app-config.json','build-config.json','android.json','ios.json','environments.json']
      const loadedConfigs: Record<string,any> = {}
      for (const cfgFile of configFiles) {
        try {
          const ff2 = (window as any).flutterForge
          const cfgText = await ff2?.fs?.readFile(folderPath + '/config/' + cfgFile)
          loadedConfigs[cfgFile] = JSON.parse(cfgText)
        } catch { /* not present — skip */ }
      }
      // Store configs in project meta for ConfigPanel to pick up
      if (Object.keys(loadedConfigs).length > 0) {
        fullProject._configs = loadedConfigs
      }



      // Load integrations (Data Files + Interfaces)
      try {
        const ff4 = (window as any).flutterForge
        const intText = await ff4?.fs?.readFile(folderPath + '/services/interfaces.json')
        const intData = JSON.parse(intText)
        useIntegrationsStore.getState().loadFromProject(intData)
      } catch { /* not present — ok */ }

      // Load Services graph (Services tab) — reset to defaults if not present in this project
      try {
        const ff5 = (window as any).flutterForge
        const graphText = await ff5?.fs?.readFile(folderPath + '/services/graph.json')
        const graphData = JSON.parse(graphText)
        useProjectStore.getState().setGraphState(graphData.gateway, graphData.services)
      } catch {
        // No graph.json in this project — reset to clean defaults
        // This clears any services left over from a different project
        useProjectStore.getState().resetToDefault()
      }

      // Restore asset files (icon, splash, images) from disk
      // Each is read back as a base64 data URL so AssetsManager can display them
      const assetEntries: Array<{ id: string; name: string; path: string; type: 'image'; dataUrl: string }> = []
      const assetCandidates = [
        { id: 'asset_icon',   path: 'assets/icon/icon.png',     name: 'icon.png'   },
        { id: 'asset_splash', path: 'assets/splash/splash.png', name: 'splash.png' },
      ]
      // Also try any image paths listed in app.json assets array
      for (const existingAsset of (appJson.assets || []) as any[]) {
        if (existingAsset.path && !assetCandidates.find(c => c.path === existingAsset.path)) {
          assetCandidates.push({ id: existingAsset.id || 'asset_' + Date.now(), path: existingAsset.path, name: existingAsset.name || existingAsset.path.split('/').pop() || 'image' })
        }
      }
      for (const candidate of assetCandidates) {
        try {
          const ff6 = (window as any).flutterForge
          const dataUrl = await ff6?.fs?.readFileBase64(folderPath + '/' + candidate.path)
          if (dataUrl) {
            assetEntries.push({ ...candidate, type: 'image', dataUrl })
            codeFileCount++
          }
        } catch { /* asset not on disk yet — skip */ }
      }
      if (assetEntries.length > 0) {
        fullProject.assets = assetEntries
      }

      // Restore navigation connections (saved by Navigation Designer)
      if (appJson.navConnections?.length > 0) {
        fullProject.navConnections = appJson.navConnections
      }

      setProject(fullProject)
      setFilePath(folderPath)

      setSummary({ name: appJson.name || 'Project', screens: Object.keys(fullProject.screens).length, codeFiles: codeFileCount })
      setStatus('success')
      setTimeout(() => onClose(), 1500)
    } catch (e: any) {
      setStatus('error'); setError(e.message || 'Failed to open project')
    }
  }

  if (status === 'success' && summary) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'24px 0' }}>
      <div style={{ fontSize:36, color:'#4caf7d' }}>✓</div>
      <div style={{ fontSize:15, fontWeight:700, color:'#e0d7ff' }}>{summary.name} opened</div>
      <div style={{ fontSize:12, color:'#666', textAlign:'center' as const, lineHeight:2 }}>
        {summary.screens} screens · {summary.codeFiles} code files<br/>
        <span style={{ color:'#4caf7d', fontSize:11 }}>Auto-save active — changes save automatically</span>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ padding:'12px 14px', background:'rgba(74,158,221,0.08)', borderRadius:10,
        border:'1px solid rgba(74,158,221,0.2)', fontSize:12, color:'#4a9edd', lineHeight:1.8 }}>
        Opens an <strong>.appzillon</strong> project folder.<br/>
        Structure: <code>app.json</code> · <code>screens/</code> · <code>assets/</code> · <code>shared/</code> · <code>config/</code>
      </div>
      <div style={{ padding:'20px', background:'#0a0a14', border:'2px dashed #2a2a3a', borderRadius:12,
        display:'flex', flexDirection:'column' as const, alignItems:'center', gap:12,
        cursor: status==='loading' ? 'not-allowed' : 'pointer' }}
        onClick={status !== 'loading' ? handleOpen : undefined}>
        <div style={{ fontSize:36 }}>📂</div>
        <div style={{ fontSize:14, color:'#888', fontWeight:600 }}>
          {status === 'loading' ? '◌ Opening...' : 'Click to choose project folder'}
        </div>
        <div style={{ fontSize:11, color:'#444' }}>Browse to <code>my-app.appzillon</code> folder</div>
      </div>
      {error && (
        <div style={{ padding:'10px 14px', background:'#1a0a0a', borderRadius:8,
          border:'1px solid #5c1a1a', fontSize:12, color:'#e05252' }}>✗ {error}</div>
      )}
      <button onClick={handleOpen} disabled={status==='loading'}
        style={{ ...s.primaryBtn, opacity: status==='loading' ? 0.5 : 1 }}>
        📂 Open .appzillon Folder
      </button>
    </div>
  )
}

function SaveProjectPanel({ onClose }: { onClose: () => void }) {
  const { project, projectFilePath, setFilePath } = useCanvasStore()
  const { screenFiles, sharedFiles } = useCodeStore()
  const [status,    setStatus]    = React.useState<'idle'|'saving'|'success'|'error'>('idle')
  const [error,     setError]     = React.useState('')
  const [savedPath, setSavedPath] = React.useState('')

  const handleSave = async () => {
    if (!project) return
    setStatus('saving'); setError('')

    try {
      // Use existing compiled IPC for folder selection
      let folderPath = projectFilePath
      if (!folderPath) {
        // @ts-ignore
        const parentDir: string | null = await window.flutterForge?.fs?.chooseOutputDir()
        if (!parentDir) { setStatus('idle'); return }
        const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g,'-').toLowerCase()
        folderPath = parentDir.replace(/\\/g,'/') + '/' + safeName + '.appzillon'
      }

      const write = async (relPath: string, content: string) => {
        // @ts-ignore
        await window.flutterForge?.fs?.writeFile(folderPath + '/' + relPath, content)
      }

      // Write app.json — includes screenNames AND full screens inline as backup
      // This means even if screen.json files are lost, app.json always has the full data
      const appJson = {
        id: project.id, name: project.name, packageName: project.packageName,
        version: project.version, description: project.description,
        initialRoute: project.initialRoute, theme: project.theme,
        dependencies: project.dependencies, metadata: project.metadata,
        navConnections: project.navConnections || [],
        createdAt: project.createdAt, updatedAt: new Date().toISOString(),
        screenNames:     Object.values(project.screens).map((s: any) => s.name),
        screens:         project.screens,   // full widget data — recovery backup
        sharedFileNames: (sharedFiles as any[]).map((f: any) => f.filename).filter(Boolean),
        dataFileNames:   Object.keys((project as any)._dataFiles || {}),
      }
      await write('app.json', JSON.stringify(appJson, null, 2))

      // Write each screen
      for (const screen of Object.values(project.screens) as any[]) {
        const snakeCase = screen.name.replace(/([A-Z])/g, (m: string, l: string, i: number) => (i>0?'_':'')+l.toLowerCase())
        await write(`screens/${screen.name}/screen.json`, JSON.stringify(screen, null, 2))
        const sf = Object.values(screenFiles).find((f: any) => f.screenName === screen.name || f.screenId === screen.id) as any
        if (sf?.dartCode) await write(`screens/${screen.name}/${snakeCase}.dart`, sf.dartCode)
      }

      // Write shared files
      for (const sf of sharedFiles as any[]) {
        if (sf.code) await write(`shared/${sf.filename}`, sf.code)
      }

      // Write ALL config files from project._configs (saved by ConfigPanel)
      // This ensures app-config, build-config, android, ios, environments are all exported
      const configs = (project as any)._configs || {}

      // Always write environments.json (from app-config if available)
      const appCfg = configs['app-config.json']
      if (appCfg) {
        await write('config/app-config.json', JSON.stringify(appCfg, null, 2))
      } else {
        await write('config/app-config.json', JSON.stringify({
          baseUrl: 'https://your-api.com', encryptValues: true, logLevel: 'info',
          tokenExpiry: 3600, sessionTimeout: 1800, maxRetries: 3,
          biometricEnabled: true, analyticsEnabled: false, debugMode: false,
          activeEnv: 'dev',
          environments: {
            dev:  { baseUrl: 'http://localhost:9876', logLevel: 'debug', mockMode: true  },
            uat:  { baseUrl: 'https://uat.your-api.com', logLevel: 'info', mockMode: false },
            prod: { baseUrl: 'https://your-api.com', logLevel: 'error', mockMode: false },
          }
        }, null, 2))
      }

      const buildCfg = configs['build-config.json']
      if (buildCfg) {
        await write('config/build-config.json', JSON.stringify(buildCfg, null, 2))
      } else {
        await write('config/build-config.json', JSON.stringify({
          flutterPath: '', androidSdkPath: '', javaHome: '', xcodePath: '',
          mavenPath: '', antPath: '', buildMode: 'debug', targets: ['apk'],
          versionName: project.version || '1.0.0', versionCode: 1,
          keystore: '', keystoreAlias: '', keystorePassword: '', keyPassword: '',
          provisioningProfile: '', appleTeamId: '', outputDir: ''
        }, null, 2))
      }

      if (configs['android.json']) await write('config/android.json', JSON.stringify(configs['android.json'], null, 2))
      if (configs['ios.json'])     await write('config/ios.json',     JSON.stringify(configs['ios.json'],     null, 2))

      // environments.json — derived from app-config for backward compat
      const envs = appCfg?.environments || {}
      await write('config/environments.json', JSON.stringify({
        active:       appCfg?.activeEnv || 'dev',
        environments: envs,
      }, null, 2))

      // Write data/ files (JSON datasets)
      const dataFiles = (project as any)._dataFiles || {}
      for (const [fname, txt] of Object.entries(dataFiles)) {
        if (txt) await write('data/' + fname, txt as string)
      }

      // Write integrations data (Data Files + Interfaces)
      const intExport = useIntegrationsStore.getState().getExportData()
      if (intExport.dataFiles.length > 0 || intExport.interfaces.length > 0) {
        await write('services/interfaces.json', JSON.stringify(intExport, null, 2))
      }

      // Write Services graph (Services tab) — always save so it round-trips with the project
      const graphState = useProjectStore.getState()
      const graphExport = { gateway: graphState.gateway, services: graphState.services }
      await write('services/graph.json', JSON.stringify(graphExport, null, 2))

      // Write asset files — icon, splash, uploaded images
      // These are binary files stored as base64 dataUrls in the canvas store
      for (const asset of ((project as any).assets || []) as any[]) {
        if (asset.dataUrl && asset.path) {
          try {
            const ff7 = (window as any).flutterForge
            await ff7?.fs?.writeFileBase64(folderPath + '/' + asset.path, asset.dataUrl)
          } catch (e) { console.warn('[Save] Asset write failed:', asset.path, e) }
        }
      }

      setFilePath(folderPath)
      setSavedPath(folderPath)
      setStatus('success')
    } catch (e: any) {
      setStatus('error'); setError(e.message || 'Save failed')
    }
  }

  if (status === 'success') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'20px 0' }}>
      <div style={{ fontSize:36, color:'#4caf7d' }}>✓</div>
      <div style={{ fontSize:15, fontWeight:700, color:'#e0d7ff' }}>Saved!</div>
      <div style={{ fontSize:11, color:'#555', fontFamily:'monospace', textAlign:'center' as const, padding:'0 8px', wordBreak:'break-all' as const }}>{savedPath}</div>
      <div style={{ fontSize:11, color:'#4caf7d' }}>Auto-save active — changes save to this folder</div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={() => (window.flutterForge as any)?.fs?.openInExplorer(savedPath)} style={s.secondaryBtn}>Open in Explorer</button>
        <button onClick={onClose} style={s.primaryBtn}>Done</button>
      </div>
    </div>
  )

  if (!project) return (
    <div style={{ textAlign:'center' as const, padding:'40px 0', color:'#555', fontSize:13 }}>No project — create or open one first</div>
  )

  const screenCount = Object.keys(project.screens || {}).length
  const codeCount   = Object.keys(screenFiles).length + sharedFiles.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ padding:'12px 14px', background:'rgba(29,185,84,0.08)', borderRadius:10,
        border:'1px solid rgba(29,185,84,0.2)', fontSize:12, color:'#4caf7d', lineHeight:1.8 }}>
        {projectFilePath
          ? <>Saves to <code style={{ fontSize:10, wordBreak:'break-all' as const }}>{projectFilePath}</code><br/>After first save, <strong>auto-save</strong> keeps everything in sync.</>
          : <>Choose a folder — IDE creates <code>{project.name.replace(/[^a-zA-Z0-9-_]/g,'-').toLowerCase()}.appzillon</code> inside it.</>}
      </div>

      <div style={s.previewCard}>
        <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:10 }}>What will be saved</div>
        <div style={{ fontFamily:'monospace', fontSize:12, lineHeight:2 }}>
          <div style={{ color:'#c9a227' }}>📁 {project.name.replace(/[^a-zA-Z0-9-_]/g,'-').toLowerCase()}.appzillon/</div>
          <div style={{ paddingLeft:16, color:'#4caf7d' }}>📄 app.json</div>
          <div style={{ paddingLeft:16, color:'#4a9edd' }}>📁 screens/ ({screenCount} screens + dart files)</div>
          <div style={{ paddingLeft:16, color:'#888' }}>📁 shared/ ({sharedFiles.length} files) · 📁 config/</div>
        </div>
      </div>

      {error && <div style={{ padding:'10px 14px', background:'#1a0a0a', borderRadius:8, border:'1px solid #5c1a1a', fontSize:12, color:'#e05252' }}>✗ {error}</div>}

      <button onClick={handleSave} disabled={status==='saving'}
        style={{ ...s.primaryBtn, opacity: status==='saving' ? 0.6 : 1 }}>
        {status==='saving' ? '◌ Saving...' : projectFilePath ? '💾 Save' : '💾 Save As Folder'}
      </button>
    </div>
  )
}


function RecentPanel() {
  const [recent, setRecent] = useState<Array<{meta: ProjectBundle['meta'], file: string, date: string}>>(() => loadRecent())

  if (recent.length === 0) {
    return (
      <div style={s.empty}>
        <div style={{ fontSize:32, marginBottom:12 }}>◷</div>
        <div style={{ color:'#555', fontSize:13 }}>No recent exports yet</div>
        <div style={{ color:'#444', fontSize:11, marginTop:6 }}>Export or import a project to see it here</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ fontSize:11, color:'#555' }}>{recent.length} recent</span>
        <button onClick={() => { localStorage.removeItem('ff_recent_v2'); setRecent([]) }}
          style={s.clearBtn}>Clear</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {recent.map((r, i) => (
          <div key={i} style={s.recentCard}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#e0d7ff', marginBottom:2 }}>{r.meta.name}</div>
              <div style={{ fontSize:10, color:'#555', fontFamily:'monospace', marginBottom:6 }}>{r.meta.packageName}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <RecentTag>{r.meta.screens} screens</RecentTag>
                <RecentTag>{r.meta.microservices} microservices</RecentTag>
                <RecentTag>v{r.meta.projectVersion}</RecentTag>
              </div>
            </div>
            <div style={{ fontSize:10, color:'#444', textAlign:'right' as const }}>
              <div>{formatDate(r.date)}</div>
              <div style={{ marginTop:4, color:'#333', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.file}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: { icon:string; label:string; value:number; color:string }) {
  return (
    <div style={{ padding:'10px', background:'#0f0f1e', border:'1px solid #1e1e2e', borderRadius:8, textAlign:'center' as const }}>
      <div style={{ fontSize:18, color, marginBottom:2 }}>{icon}</div>
      <div style={{ fontSize:18, fontWeight:700, color:'#e0d7ff' }}>{value}</div>
      <div style={{ fontSize:9, color:'#555' }}>{label}</div>
    </div>
  )
}

function PreviewBlock({ icon, label, color, children }: { icon:string; label:string; color:string; children:React.ReactNode }) {
  return (
    <div style={{ padding:'8px 10px', background:'#0f0f1e', borderRadius:6, border:'1px solid #1e1e2e' }}>
      <div style={{ fontSize:10, color, marginBottom:3 }}>{icon} {label}</div>
      <div style={{ fontSize:11, color:'#888' }}>{children}</div>
    </div>
  )
}

function RecentTag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize:9, padding:'2px 6px', background:'#13132a', borderRadius:8, color:'#666', border:'1px solid #2a2a3a' }}>
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────

function simpleChecksum(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) { h = ((h<<5)-h)+str.charCodeAt(i); h = h&h }
  return Math.abs(h).toString(16).padStart(8,'0')
}

function toKebab(str: string): string {
  return str.replace(/([A-Z])/g,'-$1').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
}

function dateTag(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
}

function formatDate(iso: string): string {
  try { const d = new Date(iso); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }
  catch { return iso }
}

function saveRecent(meta: ProjectBundle['meta'], file: string) {
  try {
    const key = 'ff_recent_v2'
    const list = loadRecent()
    const filtered = list.filter(r => r.meta.name !== meta.name)
    const updated = [{ meta, file, date: new Date().toISOString() }, ...filtered].slice(0, 10)
    localStorage.setItem(key, JSON.stringify(updated))
  } catch { /* ignore */ }
}

function loadRecent(): Array<{ meta: ProjectBundle['meta']; file: string; date: string }> {
  try { const r = localStorage.getItem('ff_recent_v2'); return r ? JSON.parse(r) : [] }
  catch { return [] }
}


// ─────────────────────────────────────────────────────────
// PROJECT SETTINGS PANEL
// ─────────────────────────────────────────────────────────

function ProjectSettingsPanel({ onClose }: { onClose: () => void }) {
  const { project, projectFilePath, updateProjectMeta } = useCanvasStore()

  const [appName,     setAppName]     = React.useState(project?.name        ?? '')
  const [bundleId,    setBundleId]    = React.useState(project?.packageName ?? '')
  const [version,     setVersion]     = React.useState(project?.version     ?? '1.0.0')
  const [description, setDescription] = React.useState(project?.description ?? '')
  const [status,      setStatus]      = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error,       setError]       = React.useState('')

  // ── Validation ──────────────────────────────────────────
  const bundleIdError = React.useMemo(() => {
    if (!bundleId) return 'Bundle ID is required'
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,4}$/.test(bundleId))
      return 'Must be lowercase dot-separated segments, e.g. com.mycompany.myapp'
    if (bundleId.split('.').length < 2)
      return 'Must have at least 2 segments, e.g. com.myapp'
    return ''
  }, [bundleId])

  const versionError = React.useMemo(() => {
    if (!version) return 'Version is required'
    if (!/^\d+\.\d+\.\d+$/.test(version)) return 'Must follow semver format: 1.0.0'
    return ''
  }, [version])

  const appNameError = React.useMemo(() => {
    if (!appName.trim()) return 'App name is required'
    return ''
  }, [appName])

  const hasErrors = !!(bundleIdError || versionError || appNameError)
  const isDirty   = appName !== (project?.name ?? '') ||
                    bundleId !== (project?.packageName ?? '') ||
                    version  !== (project?.version ?? '') ||
                    description !== (project?.description ?? '')

  const handleSave = async () => {
    if (hasErrors || !project) return
    setStatus('saving'); setError('')

    try {
      // 1. Update the in-memory store
      updateProjectMeta({ name: appName.trim(), packageName: bundleId, version, description })

      // 2. Write app.json back to disk if path is known
      if (projectFilePath) {
        const ff = (window as any).flutterForge
        const appJsonPath = projectFilePath + '/app.json'
        try {
          const existing = await ff?.fs?.readFile(appJsonPath)
          const parsed   = existing ? JSON.parse(existing) : {}
          const updated  = {
            ...parsed,
            name:        appName.trim(),
            packageName: bundleId,
            version,
            description,
            updatedAt:   new Date().toISOString(),
          }
          await ff?.fs?.writeFile(appJsonPath, JSON.stringify(updated, null, 2))
        } catch (e: any) {
          // If readFile fails the project isn't saved to disk yet — that's fine
          console.warn('[Settings] Could not update app.json on disk:', e?.message)
        }
      }

      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2500)
    } catch (e: any) {
      setStatus('error')
      setError(e?.message ?? 'Unknown error')
    }
  }

  if (!project) {
    return (
      <div style={{ textAlign:'center', padding:'48px 24px' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>📂</div>
        <div style={{ color:'#888', fontSize:14 }}>No project is currently open.</div>
        <div style={{ color:'#555', fontSize:12, marginTop:6 }}>Open or create a project first, then come back here to edit its settings.</div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header info */}
      <div style={{ background:'#12102a', border:'1px solid #2a2244', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:24 }}>⚙</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#c9b8ff' }}>Project Settings</div>
          <div style={{ fontSize:11, color:'#555', marginTop:2 }}>
            Changes take effect on the next build.
            {projectFilePath
              ? <span style={{ color:'#444' }}> · Saved to disk automatically.</span>
              : <span style={{ color:'#c9a227' }}> · Save the project to persist changes to disk.</span>
            }
          </div>
        </div>
      </div>

      {/* App Name */}
      <div>
        <label style={ps.label}>App Name</label>
        <input
          value={appName}
          onChange={e => setAppName(e.target.value)}
          placeholder="e.g. My App"
          style={{ ...ps.input, borderColor: appNameError ? '#c0392b' : '#2a2a3a' }}
        />
        {appNameError
          ? <div style={ps.err}>{appNameError}</div>
          : <div style={ps.hint}>Display name shown on device home screen.</div>
        }
      </div>

      {/* Bundle ID */}
      <div>
        <label style={ps.label}>
          Bundle ID
          <span style={{ fontWeight:400, color:'#555', marginLeft:6 }}>(Android: applicationId · iOS: Bundle Identifier)</span>
        </label>
        <input
          value={bundleId}
          onChange={e => setBundleId(e.target.value.toLowerCase().replace(/\s/g, ''))}
          placeholder="e.g. com.mycompany.myapp"
          style={{ ...ps.input, fontFamily:'monospace', borderColor: bundleId && bundleIdError ? '#c0392b' : bundleId && !bundleIdError ? '#2d7a3a' : '#2a2a3a' }}
          spellCheck={false}
        />
        {bundleId && bundleIdError
          ? <div style={ps.err}>⚠ {bundleIdError}</div>
          : bundleId && !bundleIdError
            ? <div style={{ ...ps.hint, color:'#2d7a3a' }}>✓ Valid Bundle ID</div>
            : <div style={ps.hint}>Must be unique across all apps. Use reverse-domain notation.</div>
        }
        {bundleId !== (project.packageName ?? '') && !bundleIdError && (
          <div style={{ marginTop:6, background:'#1a1400', border:'1px solid #4a3800', borderRadius:6, padding:'8px 10px', fontSize:11, color:'#c9a227' }}>
            ⚠ Bundle ID changed from <code style={{ background:'#2a1e00', padding:'1px 4px', borderRadius:3, fontFamily:'monospace' }}>{project.packageName}</code> to <code style={{ background:'#2a1e00', padding:'1px 4px', borderRadius:3, fontFamily:'monospace' }}>{bundleId}</code>.
            Delete the <code style={{ background:'#2a1e00', padding:'1px 4px', borderRadius:3 }}>build/</code> folder before rebuilding to avoid stale artifacts.
          </div>
        )}
      </div>

      {/* Version */}
      <div>
        <label style={ps.label}>Version</label>
        <input
          value={version}
          onChange={e => setVersion(e.target.value)}
          placeholder="e.g. 1.0.0"
          style={{ ...ps.input, width:140, borderColor: version && versionError ? '#c0392b' : '#2a2a3a' }}
        />
        {versionError
          ? <div style={ps.err}>{versionError}</div>
          : <div style={ps.hint}>Semantic version: major.minor.patch</div>
        }
      </div>

      {/* Description */}
      <div>
        <label style={ps.label}>Description <span style={{ fontWeight:400, color:'#555' }}>(optional)</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Short description of what this app does"
          rows={2}
          style={{ ...ps.input, resize:'vertical', minHeight:56, fontFamily:'inherit' }}
        />
      </div>

      {/* Read-only info */}
      <div style={{ background:'#0c0c18', border:'1px solid #1e1e2e', borderRadius:8, padding:'10px 14px' }}>
        <div style={{ fontSize:11, color:'#555', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Project info (read-only)</div>
        <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:'4px 12px', fontSize:12 }}>
          {[
            ['Project ID',  project.id],
            ['Screens',     String(Object.keys(project.screens ?? {}).length)],
            ['Created',     project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'],
            ['Project file', projectFilePath ?? 'Not saved to disk yet'],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <span style={{ color:'#555' }}>{k}</span>
              <span style={{ color:'#888', fontFamily: k === 'Project ID' || k === 'Project file' ? 'monospace' : 'inherit', fontSize: k === 'Project file' ? 10 : 12, wordBreak:'break-all' }}>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:4 }}>
        <button
          onClick={handleSave}
          disabled={hasErrors || !isDirty || status === 'saving'}
          style={{
            ...ps.btn,
            background: hasErrors || !isDirty ? '#1e1a33' : '#7c5cbf',
            color:      hasErrors || !isDirty ? '#444' : '#fff',
            cursor:     hasErrors || !isDirty ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'saving' ? '⏳ Saving…' : status === 'saved' ? '✓ Saved' : '💾 Save Settings'}
        </button>
        {!isDirty && status !== 'saved' && (
          <span style={{ fontSize:12, color:'#444' }}>No changes</span>
        )}
        {status === 'saved' && (
          <span style={{ fontSize:12, color:'#2d7a3a' }}>✓ Settings applied — next build will use these values</span>
        )}
        {status === 'error' && (
          <span style={{ fontSize:12, color:'#c0392b' }}>✗ {error}</span>
        )}
      </div>

    </div>
  )
}

// Project Settings local styles
const ps: Record<string, React.CSSProperties> = {
  label: { display:'block', fontSize:12, fontWeight:600, color:'#8b7ec8', marginBottom:6, letterSpacing:'0.03em' },
  input: { width:'100%', background:'#0c0c18', border:'1px solid #2a2a3a', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#e0d7ff', outline:'none', boxSizing:'border-box' },
  hint:  { fontSize:11, color:'#555', marginTop:4 },
  err:   { fontSize:11, color:'#c0392b', marginTop:4 },
  btn:   { padding:'9px 20px', borderRadius:8, border:'none', fontSize:13, fontWeight:600, transition:'background 0.15s' },
}

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay:       { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:         { width:580, maxHeight:'90vh', background:'#0d0d1a', border:'1px solid #2a2a3a', borderRadius:16, display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.8)' },
  modalHeader:   { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  headerLeft:    { display:'flex', alignItems:'center', gap:12 },
  modalTitle:    { fontSize:16, fontWeight:700, color:'#e0d7ff' },
  modalSub:      { fontSize:11, color:'#555', marginTop:2 },
  closeBtn:      { background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:18, padding:'4px 8px', borderRadius:6 },
  tabRow:        { display:'flex', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  tabBtn:        { flex:1, padding:'12px 8px', border:'none', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'system-ui,sans-serif' },
  modalBody:     { flex:1, overflowY:'auto', padding:20 },
  includeBox:    { background:'#0f0f1e', border:'1px solid #1e1e2e', borderRadius:10, padding:14 },
  includeRow:    { display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid #1a1a2a' },
  formatBox:     { padding:'8px 12px', background:'#0a0a14', borderRadius:8, border:'1px solid #1e1e2e', fontSize:11, color:'#555' },
  code:          { background:'#1a1a2e', padding:'1px 5px', borderRadius:3, fontSize:11, color:'#9d7fe8', fontFamily:'monospace' },
  successBox:    { padding:12, background:'#0a1a0f', borderRadius:8, border:'1px solid #1a5c2e' },
  primaryBtn:    { padding:'12px 20px', background:'#7c5cbf', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  secondaryBtn:  { padding:'12px 16px', background:'#13132a', border:'1px solid #3d3060', borderRadius:8, color:'#9d7fe8', fontSize:12, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  modeRow:       { display:'flex', gap:8 },
  modeBtn:       { flex:1, padding:'9px 14px', border:'1px solid', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'system-ui,sans-serif' },
  dropZone:      { border:'2px dashed', borderRadius:12, padding:'36px 24px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.2s', textAlign:'center' as const, minHeight:150 },
  textarea:      { width:'100%', height:150, padding:10, background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:8, fontSize:11, color:'#d4d4d4', outline:'none', fontFamily:'monospace', resize:'vertical' as const },
  errorBox:      { padding:10, background:'#1a0a0a', borderRadius:8, border:'1px solid #5c1a1a', fontSize:12, color:'#e05252' },
  previewCard:   { padding:14, background:'#13132a', border:'1px solid #2a2a3a', borderRadius:10 },
  mergeModeBox:  { padding:12, background:'#0f0f1e', border:'1px solid #1e1e2e', borderRadius:10 },
  empty:         { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', color:'#444', textAlign:'center' as const },
  fieldLabel:    { fontSize:11, fontWeight:700, color:'#666', marginBottom:5, letterSpacing:'0.04em' },
  fieldInput:    { width:'100%', padding:'9px 12px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:8, fontSize:13, color:'#e0d7ff', outline:'none', fontFamily:'system-ui,sans-serif' },
  recentCard:    { display:'flex', padding:12, background:'#0f0f1e', border:'1px solid #1e1e2e', borderRadius:8, gap:12 },
  clearBtn:      { background:'none', border:'1px solid #2a2a3a', borderRadius:6, color:'#555', cursor:'pointer', fontSize:11, padding:'3px 10px' },
}
