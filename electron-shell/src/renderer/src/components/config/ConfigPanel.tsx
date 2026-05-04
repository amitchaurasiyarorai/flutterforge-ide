import React, { useState, useEffect, useRef } from 'react'
import { useCanvasStore } from '../../store/canvas.store'

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface AppConfig {
  // Runtime
  baseUrl:        string
  aesKey:         string
  encryptValues:  boolean
  logLevel:       'debug' | 'info' | 'warn' | 'error' | 'none'
  // Session
  tokenExpiry:    number   // seconds
  sessionTimeout: number   // seconds
  maxRetries:     number
  splashDuration:  number   // seconds on splash before navigating to home
  postSplashRoute: string   // route to navigate to after splash (e.g. "/login")
  // Feature flags
  biometricEnabled:  boolean
  analyticsEnabled:  boolean
  debugMode:         boolean
  // Push notifications
  fcmSenderId:    string
  // Per-env overrides
  environments: {
    dev:  { baseUrl: string; logLevel: string; mockMode: boolean }
    uat:  { baseUrl: string; logLevel: string; mockMode: boolean }
    prod: { baseUrl: string; logLevel: string; mockMode: boolean }
  }
  activeEnv: 'dev' | 'uat' | 'prod'
}

export interface BuildConfig {
  // Tool paths
  flutterPath:     string
  androidSdkPath:  string
  javaHome:        string
  xcodePath:       string
  mavenPath:       string
  antPath:         string
  // Build settings
  buildMode:       'debug' | 'release' | 'profile'
  targets:         ('apk' | 'aab' | 'ipa' | 'war' | 'web')[]
  // Versioning
  versionName:     string
  versionCode:     number
  // Android signing
  keystore:        string
  keystoreAlias:   string
  keystorePassword: string
  keyPassword:     string
  // iOS signing
  provisioningProfile: string
  appleTeamId:     string
  // Output
  outputDir:       string
}

const DEFAULT_APP_CONFIG: AppConfig = {
  baseUrl: 'https://your-api.com',
  aesKey: '',
  encryptValues: true,
  logLevel: 'info',
  tokenExpiry: 3600,
  splashDuration:  3,
  postSplashRoute: '',       // empty = auto-detect (next screen after splash)
  sessionTimeout: 1800,
  maxRetries: 3,
  biometricEnabled: true,
  analyticsEnabled: false,
  debugMode: false,
  fcmSenderId: '',
  environments: {
    dev:  { baseUrl: 'http://localhost:9876', logLevel: 'debug', mockMode: true  },
    uat:  { baseUrl: 'https://uat.your-api.com', logLevel: 'info', mockMode: false },
    prod: { baseUrl: 'https://your-api.com',     logLevel: 'error', mockMode: false },
  },
  activeEnv: 'dev',
}

const DEFAULT_BUILD_CONFIG: BuildConfig = {
  flutterPath: '',
  androidSdkPath: '',
  javaHome: '',
  xcodePath: '/Applications/Xcode.app',
  mavenPath: '',
  antPath: '',
  buildMode: 'debug',
  targets: ['apk'],
  versionName: '1.0.0',
  versionCode: 1,
  keystore: '',
  keystoreAlias: '',
  keystorePassword: '',
  keyPassword: '',
  provisioningProfile: '',
  appleTeamId: '',
  outputDir: '',
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

type ConfigTab = 'app' | 'build'

export default function ConfigPanel({ engineUrl }: { engineUrl: string }): JSX.Element {
  const { project, projectFilePath } = useCanvasStore()
  const [tab,         setTab]         = useState<ConfigTab>('app')
  const [appConfig,   setAppConfig]   = useState<AppConfig>(DEFAULT_APP_CONFIG)
  const [buildConfig, setBuildConfig] = useState<BuildConfig>(DEFAULT_BUILD_CONFIG)
  const [saved,       setSaved]       = useState(false)
  const [buildLog,    setBuildLog]    = useState<string[]>([])
  const [building,    setBuilding]    = useState(false)
  const [buildDone,   setBuildDone]   = useState<'success'|'error'|null>(null)
  const [buildPhase,  setBuildPhase]  = useState<{step:number;label:string}>({step:0,label:''})
  const logRef = useRef<HTMLDivElement>(null)

  // Load config ONLY when the project path changes (i.e. a different project is opened)
  // Using a ref to prevent re-loading when canvas edits update the project object
  const loadedPathRef = React.useRef<string | null>(null)

  useEffect(() => {
    // Only reload when the project file path actually changes (new project opened)
    if (!projectFilePath || loadedPathRef.current === projectFilePath) return
    loadedPathRef.current = projectFilePath

    const load = async () => {
      // 1. Try in-memory configs first (populated by ProjectManager.Open)
      const cached = (project as any)?._configs
      let appLoaded   = false
      let buildLoaded = false

      if (cached?.['app-config.json']) {
        setAppConfig({ ...DEFAULT_APP_CONFIG, ...cached['app-config.json'] })
        appLoaded = true
      }
      if (cached?.['build-config.json']) {
        setBuildConfig({ ...DEFAULT_BUILD_CONFIG, ...cached['build-config.json'] })
        buildLoaded = true
      }

      // 2. Read from disk for anything not in memory
      if (appLoaded && buildLoaded) return
      try {
        const ff = (window as any).flutterForge
        if (!appLoaded) {
          try {
            const appText = await ff?.fs?.readFile(projectFilePath + '/config/app-config.json')
            if (appText) setAppConfig({ ...DEFAULT_APP_CONFIG, ...JSON.parse(appText) })
          } catch {}
        }
        if (!buildLoaded) {
          try {
            const buildText = await ff?.fs?.readFile(projectFilePath + '/config/build-config.json')
            if (buildText) setBuildConfig({ ...DEFAULT_BUILD_CONFIG, ...JSON.parse(buildText) })
          } catch {}
        }
      } catch {}
    }
    load()
  }, [projectFilePath])   // ← ONLY depends on path, not project object

  // Auto-scroll build log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [buildLog])

  const saveConfigs = async () => {
    if (!projectFilePath) return
    try {
      const ff = (window as any).flutterForge
      // Ensure config directory exists
      try { await ff?.fs?.mkdirp?.(projectFilePath + '/config') } catch {}

      // Write to disk
      await ff?.fs?.writeFile(projectFilePath + '/config/app-config.json',
        JSON.stringify(appConfig, null, 2))
      await ff?.fs?.writeFile(projectFilePath + '/config/build-config.json',
        JSON.stringify(buildConfig, null, 2))
      // Write environments.json for backward compat
      await ff?.fs?.writeFile(projectFilePath + '/config/environments.json',
        JSON.stringify({ active: appConfig.activeEnv, environments: appConfig.environments }, null, 2))

      // Keep in-memory project._configs in sync
      if (project) {
        (project as any)._configs = {
          ...((project as any)._configs || {}),
          'app-config.json':   appConfig,
          'build-config.json': buildConfig,
        }
      }
      // Update loadedPathRef so re-opening same project reads fresh values
      loadedPathRef.current = projectFilePath

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      alert('Save failed: ' + (e?.message || e))
    }
  }

  const browsePath = async (field: keyof BuildConfig) => {
    const ff = (window as any).flutterForge
    const path = await ff?.fs?.chooseOutputDir()
    if (path) setBuildConfig(prev => ({ ...prev, [field]: path }))
  }

  const browseFile = async (field: keyof BuildConfig, ext?: string) => {
    const ff = (window as any).flutterForge
    try {
      // Use openProject dialog as file picker
      const text = await ff?.fs?.openProject()
      // openProject returns file content — we just want the path shown to user
      // Workaround: show input for manual entry
    } catch {}
  }

  // Build phases — matched from log line prefixes
  const PHASE_PATTERNS: { pattern: RegExp; phase: string; step: number }[] = [
    { pattern: /\[Step 1/,   phase: 'Generating Flutter project',  step: 1 },
    { pattern: /\[Step 2/,   phase: 'Injecting app config',        step: 2 },
    { pattern: /\[Step 3/,   phase: 'Running flutter build',       step: 3 },
    { pattern: /\[APK\]/,    phase: 'Building APK',               step: 3 },
    { pattern: /\[AAB\]/,    phase: 'Building AAB',               step: 3 },
    { pattern: /\[IPA\]/,    phase: 'Building IPA',               step: 3 },
    { pattern: /\[WAR\]/,    phase: 'Building WAR',               step: 3 },
    { pattern: /✓ Build complete/, phase: 'Complete',              step: 4 },
  ]

  const diagnoseBuildError = (log: string[]): string => {
    const full = log.join('\n').toLowerCase()
    if (full.includes('http 400'))       return '⚠ HTTP 400 — Build engine rejected the request. This usually means a field name mismatch between the project config and the engine. Update codegen engine to latest version and restart.'
    if (full.includes('http 430'))       return '⚠ HTTP 430 — Build payload too large. Fix: add spring.codec.max-in-memory-size=52428800 to application.yml and restart the engine.'
    if (full.includes('http 4'))         return '⚠ Engine rejected the request — check engine is running on ' + engineUrl
    if (full.includes('createprocess error=193') || full.includes('not a valid win32'))
                                          return '⚠ Windows: wrong Flutter executable — set Flutter SDK Path to the flutter ROOT folder (e.g. D:\\flutter). The engine will use flutter.bat automatically after this fix.'
    if (full.includes('flutter: command not found') || full.includes('flutter: not found') || full.includes('cannot run program'))
                                          return '⚠ Flutter SDK not found — set Flutter SDK Path to your flutter root folder (e.g. D:\\flutter or /home/user/flutter)'
    if (full.includes('android home') || full.includes('android_home'))
                                          return '⚠ Android SDK not found — check Android SDK path in Build Config'
    if (full.includes('java_home') || full.includes('java home'))
                                          return '⚠ Java not found — check Java Home (JDK) path in Build Config'
    if (full.includes('gradle'))         return '⚠ Gradle error — check Android SDK installation and internet connection'
    if (full.includes('cocoapods') || full.includes('pod install'))
                                          return '⚠ CocoaPods error — run: sudo gem install cocoapods'
    if (full.includes('no project loaded') || full.includes('projectpath'))
                                          return '⚠ No project path — open a project first (Project → Open)'
    if (full.includes('keystore') || full.includes('signing'))
                                          return '⚠ Signing error — check keystore path and passwords in Android Signing'
    if (full.includes('out of memory') || full.includes('heap space'))
                                          return '⚠ Out of memory — increase Gradle JVM heap: org.gradle.jvmargs=-Xmx4g'
    return '⚠ Build failed — see log above for details'
  }

  const startBuild = async () => {
    if (!project || !projectFilePath) return
    setBuilding(true)
    setBuildDone(null)
    setBuildLog([])
    setBuildPhase({ step: 0, label: 'Preparing...' })

    const appendLog = (line: string) => setBuildLog(l => [...l, line])

    try {
      appendLog(`[Build] ▶  ${project.name}  ·  ${buildConfig.buildMode}  ·  ${buildConfig.targets.join(' + ')}`)

      // Pre-flight checks
      if (!buildConfig.flutterPath) {
        throw new Error('Flutter SDK path is not set. Go to Build Config → Flutter SDK Path.')
      }

      // Normalize appConfig before sending — handles both new and legacy disk formats
      // Ensures Java primitive int/boolean fields always receive a value (never null → 400)
      const rawCfg = appConfig as any
      const normalizedAppConfig = {
        baseUrl:          rawCfg.baseUrl          || '',
        aesKey:           rawCfg.aesKey           || '',
        encryptValues:    rawCfg.encryptValues     ?? true,
        logLevel:         (rawCfg.logLevel         || 'info').toLowerCase(),
        tokenExpiry:      rawCfg.tokenExpiry       || 3600,
        sessionTimeout:   rawCfg.sessionTimeout
                          || (rawCfg.sessionTimeoutMinutes ? rawCfg.sessionTimeoutMinutes * 60 : 1800),
        maxRetries:       rawCfg.maxRetries        || rawCfg.maxLoginAttempts || 3,
        splashDuration:   rawCfg.splashDuration    || 3,
        postSplashRoute:  rawCfg.postSplashRoute  || '',
        biometricEnabled: rawCfg.biometricEnabled  ?? false,
        analyticsEnabled: rawCfg.analyticsEnabled  ?? false,
        debugMode:        rawCfg.debugMode         ?? ('debug' === buildConfig.buildMode),
        fcmSenderId:      rawCfg.fcmSenderId       || '',
        activeEnv:        rawCfg.activeEnv         || 'dev',
        environments: Object.fromEntries(
          Object.entries(rawCfg.environments || {}).map(([k, v]: [string, any]) => [k, {
            baseUrl:  v.baseUrl  || '',
            logLevel: (v.logLevel || 'info').toLowerCase(),
            mockMode: v.mockMode ?? v.mockEnabled ?? false,
          }])
        ),
      }

      // Collect screen names from project for router generation
      const screenNames          = Object.values(project.screens || {}).map((s: any) => s.name)
      const initialRoute         = project.initialRoute || '/'
      const projectDependencies  = (project as any).dependencies || {}

      const payload = {
        projectPath:  projectFilePath,
        projectName:  project.name,
        packageName:  project.packageName,
        appConfig:    normalizedAppConfig,
        buildConfig,
        screenNames,
        initialRoute,
        projectDependencies,
      }

      let res: Response
      try {
        res = await fetch(engineUrl + '/api/build/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch (netErr: any) {
        throw new Error('Cannot reach codegen engine at ' + engineUrl + ' — is it running? (' + netErr.message + ')')
      }

      if (!res.ok) {
        let detail = ''
        try { detail = await res.text() } catch {}
        if (res.status === 430) {
          throw new Error('HTTP 430 — request too large. Fix: add spring.codec.max-in-memory-size=52428800 to application.yml and restart the engine.')
        }
        if (res.status === 413) {
          throw new Error('HTTP 413 — payload too large. Fix: add spring.codec.max-in-memory-size=52428800 to application.yml and restart the engine.')
        }
        throw new Error(`HTTP ${res.status}${detail ? ' — ' + detail.slice(0,200) : ''}`)
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

          if (data === '[DONE]') {
            setBuildDone('success')
            setBuildPhase({ step: 4, label: 'Complete' })
            setBuilding(false)
            return
          }
          if (data.startsWith('[ERROR]')) {
            appendLog('✗ ' + data.slice(7))
            setBuildDone('error')
            setBuilding(false)
            return
          }

          appendLog(data)

          // Update active phase from log content
          for (const pp of PHASE_PATTERNS) {
            if (pp.pattern.test(data)) {
              setBuildPhase({ step: pp.step, label: pp.phase })
              break
            }
          }
        }
      }
      setBuildDone('success')
    } catch (e: any) {
      appendLog('✗ ' + e.message)
      setBuildDone('error')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#e0d7ff' }}>Configuration</div>
          <div style={{ fontSize:10, color:'#555' }}>
            {projectFilePath ? `${project?.name || 'Project'} · ${projectFilePath.split(/[\\/]/).pop()}` : 'No project loaded'}
          </div>
        </div>
        <button onClick={saveConfigs} disabled={!projectFilePath} style={{
          ...s.saveBtn, opacity: projectFilePath ? 1 : 0.4,
          background: saved ? '#1a3a1a' : '#1e1a33',
          borderColor: saved ? '#4caf7d' : '#3d3060',
          color: saved ? '#4caf7d' : '#e0d7ff',
        }}>
          {saved ? '✓ Saved' : '💾 Save Config'}
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={s.tabRow}>
        {([
          { id:'app',   label:'App Config', icon:'⚙' },
          { id:'build', label:'Build',      icon:'▶' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...s.tabBtn,
            background:   tab===t.id ? '#1e1a33' : 'transparent',
            color:        tab===t.id ? '#e0d7ff' : '#555',
            borderBottom: tab===t.id ? '2px solid #7c5cbf' : '2px solid transparent',
          }}>
            <span style={{ fontSize:13 }}>{t.icon}</span>
            <span style={{ fontSize:11 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={s.body}>
        {tab === 'app'   && <AppConfigForm   config={appConfig}   onChange={setAppConfig}   />}
        {tab === 'build' && <BuildConfigForm
          config={buildConfig} onChange={setBuildConfig}
          onBrowsePath={browsePath}
          onBuild={startBuild}
          building={building}
          buildDone={buildDone}
          buildLog={buildLog}
          buildPhase={buildPhase}
          onDiagnose={() => setBuildLog(l => [...l, diagnoseBuildError(l)])}
          logRef={logRef}
          projectLoaded={!!projectFilePath}
        />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// APP CONFIG FORM
// ─────────────────────────────────────────────────────────

function AppConfigForm({ config, onChange }: { config: AppConfig; onChange: (c: AppConfig) => void }) {
  const set = (key: keyof AppConfig, val: any) => onChange({ ...config, [key]: val })
  const setEnv = (env: 'dev'|'uat'|'prod', key: string, val: any) =>
    onChange({ ...config, environments: { ...config.environments, [env]: { ...config.environments[env], [key]: val } } })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Runtime */}
      <Section title="Runtime" color="#4a9edd">
        <Field label="Base URL" hint="Default API endpoint">
          <input style={s.input} value={config.baseUrl}
            onChange={e => set('baseUrl', e.target.value)} placeholder="https://your-api.com"/>
        </Field>
        <Field label="AES Encryption Key" hint="Used by AzCrypto — injected into hidden code">
          <input style={s.input} type="password" value={config.aesKey}
            onChange={e => set('aesKey', e.target.value)} placeholder="32-char secret key"/>
        </Field>
        <Field label="Encrypt API Values" hint="AzCrypto encrypts request/response bodies">
          <Toggle value={config.encryptValues} onChange={v => set('encryptValues', v)}/>
        </Field>
        <Field label="Log Level" hint="AzLogger minimum level">
          <Select value={config.logLevel} onChange={v => set('logLevel', v as any)}
            options={['debug','info','warn','error','none']}/>
        </Field>
      </Section>

      {/* Session */}
      <Section title="Session" color="#9d7fe8">
        <Field label="Token Expiry (seconds)" hint="JWT / session token lifetime">
          <input style={s.inputSm} type="number" value={config.tokenExpiry}
            onChange={e => set('tokenExpiry', +e.target.value)}/>
        </Field>
        <Field label="Splash Duration (seconds)" hint="Seconds on splash before auto-navigating to home. Developer never writes navigation code.">
          <input style={s.inputSm} type="number" min={1} max={10} value={config.splashDuration ?? 3}
            onChange={e => set('splashDuration', +e.target.value)}/>
        </Field>
        <Field label="Post-Splash Route" hint="Route to navigate to after splash. Leave empty to use the next screen in your screen list. e.g. /login or /home">
          <input style={s.input} type="text" placeholder="/login  (or leave empty = auto)"
            value={config.postSplashRoute ?? ''}
            onChange={e => set('postSplashRoute', e.target.value)}/>
        </Field>
        <Field label="Session Timeout (seconds)" hint="Inactivity auto-logout">
          <input style={s.inputSm} type="number" value={config.sessionTimeout}
            onChange={e => set('sessionTimeout', +e.target.value)}/>
        </Field>
        <Field label="Max API Retries" hint="AzServer retry count on failure">
          <input style={s.inputSm} type="number" value={config.maxRetries} min={0} max={10}
            onChange={e => set('maxRetries', +e.target.value)}/>
        </Field>
      </Section>

      {/* Feature flags */}
      <Section title="Feature Flags" color="#4caf7d">
        <Field label="Biometric Login" hint="Enable Face ID / Fingerprint auth">
          <Toggle value={config.biometricEnabled} onChange={v => set('biometricEnabled', v)}/>
        </Field>
        <Field label="Analytics" hint="Enable usage tracking">
          <Toggle value={config.analyticsEnabled} onChange={v => set('analyticsEnabled', v)}/>
        </Field>
        <Field label="Debug Mode" hint="Show debug overlays in app">
          <Toggle value={config.debugMode} onChange={v => set('debugMode', v)}/>
        </Field>
        <Field label="FCM Sender ID" hint="Firebase push notifications sender">
          <input style={s.input} value={config.fcmSenderId}
            onChange={e => set('fcmSenderId', e.target.value)} placeholder="123456789"/>
        </Field>
      </Section>

      {/* Per-environment */}
      <Section title="Per-Environment Overrides" color="#c9a227">
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          {(['dev','uat','prod'] as const).map(env => (
            <button key={env} onClick={() => set('activeEnv', env)} style={{
              padding:'4px 12px', borderRadius:6, border:'1px solid',
              fontSize:11, cursor:'pointer', fontFamily:'system-ui,sans-serif',
              background:  config.activeEnv===env ? '#1e1a33' : 'transparent',
              color:       config.activeEnv===env ? '#e0d7ff' : '#555',
              borderColor: config.activeEnv===env ? '#7c5cbf' : '#2a2a3a',
            }}>{env.toUpperCase()}</button>
          ))}
        </div>
        {(['dev','uat','prod'] as const).map(env => config.activeEnv !== env ? null : (
          <div key={env} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Field label={`${env.toUpperCase()} Base URL`} hint="">
              <input style={s.input} value={config.environments[env].baseUrl}
                onChange={e => setEnv(env,'baseUrl',e.target.value)}/>
            </Field>
            <Field label="Log Level" hint="">
              <Select value={config.environments[env].logLevel}
                onChange={v => setEnv(env,'logLevel',v)}
                options={['debug','info','warn','error','none']}/>
            </Field>
            <Field label="Mock Mode" hint="Use mock responses instead of real API">
              <Toggle value={config.environments[env].mockMode}
                onChange={v => setEnv(env,'mockMode',v)}/>
            </Field>
          </div>
        ))}
      </Section>

      {/* Hidden code preview */}
      <Section title="Generated hidden code (az_config.dart)" color="#555">
        <div style={{ background:'#080812', borderRadius:8, padding:'12px 14px',
          fontSize:11, fontFamily:'monospace', color:'#6dda9d', lineHeight:1.8,
          border:'1px solid #1e1e2e' }}>
          <div style={{ color:'#8892A4', marginBottom:6 }}>// Auto-generated — developer never edits this file</div>
          <div>class AzConfig {'{'}</div>
          <div style={{ paddingLeft:16 }}>static const baseUrl = <span style={{ color:'#ce9178' }}>'{config.environments[config.activeEnv]?.baseUrl || config.baseUrl}'</span>;</div>
          <div style={{ paddingLeft:16 }}>static const encryptValues = <span style={{ color:'#569cd6' }}>{String(config.encryptValues)}</span>;</div>
          <div style={{ paddingLeft:16 }}>static const logLevel = AzLogLevel.<span style={{ color:'#569cd6' }}>{config.environments[config.activeEnv]?.logLevel || config.logLevel}</span>;</div>
          <div style={{ paddingLeft:16 }}>static const tokenExpiry = <span style={{ color:'#b5cea8' }}>{config.tokenExpiry}</span>;</div>
          <div style={{ paddingLeft:16 }}>static const sessionTimeout = <span style={{ color:'#b5cea8' }}>{config.sessionTimeout}</span>;</div>
          <div style={{ paddingLeft:16 }}>static const biometricEnabled = <span style={{ color:'#569cd6' }}>{String(config.biometricEnabled)}</span>;</div>
          <div style={{ paddingLeft:16 }}>static const analyticsEnabled = <span style={{ color:'#569cd6' }}>{String(config.analyticsEnabled)}</span>;</div>
          <div>{'}'}</div>
        </div>
        <div style={{ fontSize:10, color:'#555', marginTop:6 }}>
          This file is injected into <code>lib/appzillon/az_config.dart</code> during generation. AES key is never written to disk.
        </div>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// BUILD CONFIG FORM
// ─────────────────────────────────────────────────────────

function BuildConfigForm({ config, onChange, onBrowsePath, onBuild, building, buildDone, buildLog, logRef, projectLoaded, buildPhase, onDiagnose }: {
  config: BuildConfig
  onChange: (c: BuildConfig) => void
  onBrowsePath: (field: keyof BuildConfig) => void
  onBuild: () => void
  building: boolean
  buildDone: 'success'|'error'|null
  buildLog: string[]
  logRef: React.RefObject<HTMLDivElement>
  projectLoaded: boolean
  buildPhase: {step:number; label:string}
  onDiagnose: () => void
}) {
  const set = (key: keyof BuildConfig, val: any) => onChange({ ...config, [key]: val })
  const toggleTarget = (t: string) => {
    const current = config.targets as string[]
    const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t]
    set('targets', next)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Tool paths */}
      <Section title="Tool Paths" color="#4a9edd">
        <PathField label="Flutter SDK" value={config.flutterPath}
          onChange={v => set('flutterPath', v)} onBrowse={() => onBrowsePath('flutterPath')}
          placeholder="C:\flutter or /usr/local/flutter"/>
        <PathField label="Android SDK" value={config.androidSdkPath}
          onChange={v => set('androidSdkPath', v)} onBrowse={() => onBrowsePath('androidSdkPath')}
          placeholder="C:\Users\you\AppData\Local\Android\Sdk"/>
        <PathField label="Java Home (JDK)" value={config.javaHome}
          onChange={v => set('javaHome', v)} onBrowse={() => onBrowsePath('javaHome')}
          placeholder="C:\Program Files\Java\jdk-17"/>
        <PathField label="Xcode Path (iOS)" value={config.xcodePath}
          onChange={v => set('xcodePath', v)} onBrowse={() => onBrowsePath('xcodePath')}
          placeholder="/Applications/Xcode.app"/>
        <PathField label="Maven Path (WAR)" value={config.mavenPath}
          onChange={v => set('mavenPath', v)} onBrowse={() => onBrowsePath('mavenPath')}
          placeholder="/usr/local/maven"/>
        <PathField label="Output Directory" value={config.outputDir}
          onChange={v => set('outputDir', v)} onBrowse={() => onBrowsePath('outputDir')}
          placeholder="Leave blank = project folder"/>
      </Section>

      {/* Build settings */}
      <Section title="Build Settings" color="#4caf7d">
        <Field label="Build Mode" hint="">
          <div style={{ display:'flex', gap:8 }}>
            {(['debug','release','profile'] as const).map(m => (
              <button key={m} onClick={() => set('buildMode', m)} style={{
                padding:'4px 14px', borderRadius:6, border:'1px solid', fontSize:11,
                cursor:'pointer', fontFamily:'system-ui,sans-serif',
                background:  config.buildMode===m ? (m==='release'?'#1a2e1a':m==='debug'?'#1e1a33':'#1a1a2a') : 'transparent',
                color:       config.buildMode===m ? (m==='release'?'#4caf7d':m==='debug'?'#4a9edd':'#888') : '#555',
                borderColor: config.buildMode===m ? (m==='release'?'#4caf7d':m==='debug'?'#4a9edd':'#555') : '#2a2a3a',
              }}>{m}</button>
            ))}
          </div>
        </Field>
        <Field label="Build Targets" hint="Select one or more outputs">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
            {[
              { id:'apk',  label:'APK',  color:'#4caf7d' },
              { id:'aab',  label:'AAB',  color:'#4caf7d' },
              { id:'ipa',  label:'IPA',  color:'#4a9edd' },
              { id:'web',  label:'Web',  color:'#9d7fe8' },
              { id:'war',  label:'WAR',  color:'#c9a227' },
            ].map(t => {
              const active = (config.targets as string[]).includes(t.id)
              return (
                <button key={t.id} onClick={() => toggleTarget(t.id)} style={{
                  padding:'4px 14px', borderRadius:6, border:'1px solid', fontSize:11,
                  cursor:'pointer', fontFamily:'system-ui,sans-serif',
                  background:  active ? t.color + '22' : 'transparent',
                  color:       active ? t.color : '#555',
                  borderColor: active ? t.color : '#2a2a3a',
                }}>{t.label}</button>
              )
            })}
          </div>
        </Field>
        <div style={{ display:'flex', gap:16 }}>
          <Field label="Version Name" hint="">
            <input style={{ ...s.inputSm, width:100 }} value={config.versionName}
              onChange={e => set('versionName', e.target.value)} placeholder="1.0.0"/>
          </Field>
          <Field label="Version Code" hint="">
            <input style={{ ...s.inputSm, width:80 }} type="number" value={config.versionCode}
              onChange={e => set('versionCode', +e.target.value)}/>
          </Field>
        </div>
      </Section>

      {/* Android signing */}
      {(config.targets as string[]).some(t => ['apk','aab'].includes(t)) && (
        <Section title="Android Signing" color="#4caf7d">
          <PathField label="Keystore File (.jks / .keystore)" value={config.keystore}
            onChange={v => set('keystore', v)} onBrowse={() => onBrowsePath('keystore')}
            placeholder="path/to/my-release-key.jks"/>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <Field label="Key Alias" hint=""><input style={s.input} value={config.keystoreAlias} onChange={e => set('keystoreAlias', e.target.value)} placeholder="my-key-alias"/></Field>
            </div>
            <div style={{ flex:1 }}>
              <Field label="Store Password" hint=""><input style={s.input} type="password" value={config.keystorePassword} onChange={e => set('keystorePassword', e.target.value)}/></Field>
            </div>
            <div style={{ flex:1 }}>
              <Field label="Key Password" hint=""><input style={s.input} type="password" value={config.keyPassword} onChange={e => set('keyPassword', e.target.value)}/></Field>
            </div>
          </div>
        </Section>
      )}

      {/* iOS signing */}
      {(config.targets as string[]).includes('ipa') && (
        <Section title="iOS Signing" color="#4a9edd">
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1 }}>
              <Field label="Apple Team ID" hint=""><input style={s.input} value={config.appleTeamId} onChange={e => set('appleTeamId', e.target.value)} placeholder="ABCD1234EF"/></Field>
            </div>
            <div style={{ flex:2 }}>
              <Field label="Provisioning Profile" hint=""><input style={s.input} value={config.provisioningProfile} onChange={e => set('provisioningProfile', e.target.value)} placeholder="MyApp_Distribution.mobileprovision"/></Field>
            </div>
          </div>
        </Section>
      )}

      {/* Build button */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <button onClick={onBuild} disabled={building || !projectLoaded || !config.flutterPath} style={{
          padding:'14px 24px', borderRadius:12, border:'none', cursor: building || !projectLoaded || !config.flutterPath ? 'not-allowed' : 'pointer',
          background: buildDone==='success' ? '#1a3a1a' : buildDone==='error' ? '#2a0a0a' : '#1E6BFF',
          color: buildDone==='success' ? '#4caf7d' : buildDone==='error' ? '#e05252' : '#fff',
          fontSize:14, fontWeight:700, fontFamily:'system-ui,sans-serif',
          opacity: building || !projectLoaded || !config.flutterPath ? 0.5 : 1,
        }}>
          {building ? '⟳ Building...' : buildDone==='success' ? '✓ Build Complete' : buildDone==='error' ? '✗ Build Failed — Retry' : `▶ Build (${(config.targets as string[]).join(' + ')} · ${config.buildMode})`}
        </button>

        {!config.flutterPath && (
          <div style={{ fontSize:11, color:'#c9a227', textAlign:'center' as const }}>
            ⚠ Set Flutter SDK path above to enable build
          </div>
        )}

        {/* ── Phase progress bar ── */}
        {(building || buildDone) && (
          <div style={{ border:'1px solid #1e2d3d', borderRadius:10, overflow:'hidden' }}>
            {/* Phase steps */}
            <div style={{ display:'flex', background:'#0a0a14' }}>
              {[
                { n:1, label:'Generate' },
                { n:2, label:'Config'   },
                { n:3, label:'Build'    },
                { n:4, label:'Done'     },
              ].map(ph => {
                const done    = buildDone === 'success' ? true : buildPhase.step > ph.n
                const active  = buildPhase.step === ph.n && building
                const failed  = buildDone === 'error' && buildPhase.step === ph.n
                const pending = buildPhase.step < ph.n && !buildDone
                return (
                  <div key={ph.n} style={{ flex:1, padding:'8px 6px', display:'flex', flexDirection:'column' as const,
                    alignItems:'center', gap:4, borderRight:'1px solid #1e2d3d',
                    background: failed ? '#1a0808' : active ? '#0a1a0f' : 'transparent' }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', display:'flex',
                      alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                      background: failed  ? '#e05252' :
                                  done    ? '#4caf7d' :
                                  active  ? '#1E6BFF' : '#1a1a2a',
                      color: failed||done||active ? '#fff' : '#444',
                      border: active ? '2px solid #1E6BFF44' : 'none',
                    }}>
                      {failed ? '✗' : done ? '✓' : active ? '⟳' : ph.n}
                    </div>
                    <span style={{ fontSize:10, color: failed ? '#e05252' : done ? '#4caf7d' :
                                   active ? '#FFFFFF' : '#444' }}>{ph.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Current phase label */}
            {building && buildPhase.label && (
              <div style={{ padding:'6px 14px', background:'#060e1a', fontSize:11,
                color:'#4a9edd', display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span>
                {buildPhase.label}...
              </div>
            )}
          </div>
        )}

        {/* ── Build log terminal ── */}
        {buildLog.length > 0 && (
          <div style={{ border:'1px solid #1e1e2e', borderRadius:8, overflow:'hidden' }}>

            {/* Terminal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'6px 12px', background:'#0a0a14', borderBottom:'1px solid #1e1e2e' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:'50%',
                  background: buildDone==='success' ? '#4caf7d' : buildDone==='error' ? '#e05252' : '#c9a227' }}/>
                <span style={{ fontSize:11, color:'#8892A4', fontFamily:'monospace' }}>Build Output</span>
                <span style={{ fontSize:10, color:'#444' }}>{buildLog.length} lines</span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {buildDone === 'error' && (
                  <button onClick={onDiagnose} style={{ padding:'2px 10px', background:'#1a0a0a',
                    border:'1px solid #5c1a1a', borderRadius:5, color:'#e05252',
                    fontSize:10, cursor:'pointer', fontFamily:'system-ui,sans-serif' }}>
                    ⚠ Diagnose
                  </button>
                )}
                <button onClick={() => navigator.clipboard?.writeText(buildLog.join('\n'))}
                  style={{ padding:'2px 10px', background:'#0a0a14', border:'1px solid #1e2d3d',
                    borderRadius:5, color:'#8892A4', fontSize:10, cursor:'pointer',
                    fontFamily:'system-ui,sans-serif' }}>
                  Copy
                </button>
              </div>
            </div>

            {/* Log lines */}
            <div ref={logRef} style={{ background:'#030810', padding:'10px 14px',
              maxHeight:240, overflowY:'auto' as const,
              fontFamily:'monospace', fontSize:11, lineHeight:1.9 }}>
              {buildLog.map((line, i) => {
                const isError   = line.startsWith('✗') || line.toLowerCase().includes('error:') || line.toLowerCase().includes('failed')
                const isSuccess = line.startsWith('✓')
                const isStep    = line.startsWith('[Step')
                const isInfo    = line.startsWith('[Build]') || line.startsWith('[APK]') || line.startsWith('[AAB]') || line.startsWith('[IPA]')
                const isWarn    = line.startsWith('⚠') || line.toLowerCase().includes('warning:')
                return (
                  <div key={i} style={{
                    color: isError   ? '#e05252' :
                           isSuccess ? '#4caf7d' :
                           isStep    ? '#c9a227' :
                           isInfo    ? '#4a9edd' :
                           isWarn    ? '#c9a227' : '#8892A4',
                    borderLeft: isStep ? '2px solid #c9a227' : isError ? '2px solid #e05252' : 'none',
                    paddingLeft: isStep || isError ? 8 : 0,
                    marginTop: isStep ? 6 : 0,
                    fontWeight: isStep || isError ? 600 : 400,
                  }}>{line}</div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ border:'1px solid #1e1e2e', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'8px 14px', background:'#0a0a14', borderBottom:'1px solid #1e1e2e',
        fontSize:11, fontWeight:700, color, letterSpacing:'0.06em', textTransform:'uppercase' as const }}>
        {title}
      </div>
      <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:12 }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, minHeight:32 }}>
      <div style={{ width:190, flexShrink:0 }}>
        <div style={{ fontSize:12, color:'#c0bcd8', fontWeight:500 }}>{label}</div>
        {hint && <div style={{ fontSize:10, color:'#444' }}>{hint}</div>}
      </div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

function PathField({ label, value, onChange, onBrowse, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; onBrowse: () => void; placeholder: string
}) {
  return (
    <Field label={label} hint="">
      <div style={{ display:'flex', gap:6 }}>
        <input style={{ ...s.input, flex:1 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>
        <button onClick={onBrowse} style={s.browseBtn}>Browse</button>
      </div>
    </Field>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width:40, height:22, borderRadius:11, cursor:'pointer', position:'relative' as const,
      background: value ? '#1E6BFF' : '#1e1e2e', transition:'background 0.2s', border:'1px solid #3a3a4a',
    }}>
      <div style={{
        position:'absolute' as const, top:3, left: value ? 20 : 3,
        width:14, height:14, borderRadius:'50%', background:'#fff',
        transition:'left 0.2s',
      }}/>
    </div>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={s.select}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:      { display:'flex', flexDirection:'column', height:'100%', background:'#0d0d1a', overflow:'hidden' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  saveBtn:   { padding:'6px 14px', border:'1px solid', borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'system-ui,sans-serif', fontWeight:600 },
  tabRow:    { display:'flex', padding:'0 8px', gap:2, borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  tabBtn:    { display:'flex', alignItems:'center', gap:5, padding:'8px 14px', border:'none', cursor:'pointer', fontSize:11, fontFamily:'system-ui,sans-serif', background:'transparent' },
  body:      { flex:1, overflowY:'auto', padding:'16px' },
  input:     { width:'100%', padding:'6px 10px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif' },
  inputSm:   { width:120, padding:'6px 10px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif' },
  select:    { padding:'6px 10px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif', cursor:'pointer' },
  browseBtn: { padding:'6px 10px', background:'#1e1a33', border:'1px solid #3d3060', borderRadius:6, color:'#9d7fe8', fontSize:11, cursor:'pointer', fontFamily:'system-ui,sans-serif', whiteSpace:'nowrap' as const },
}
