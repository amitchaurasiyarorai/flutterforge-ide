import React, { useState } from 'react'
import { useCanvasStore, selectActiveScreen } from "../../store/canvas.store";
import { useIntegrationsStore } from "../../store/integrations.store";
import { generateApiCode } from "../../utils/api-codegen";

// ─────────────────────────────────────────────────────────
// BUG FIX: CodegenPanel now accepts engineUrl prop and uses
// direct fetch to the Spring Boot engine on port 9876.
// Previously it used window.flutterForge?.codegen?.generate()
// which only works when the engine JAR is spawned by Electron
// (packaged app), not in dev mode.
// ─────────────────────────────────────────────────────────

interface Props { engineUrl: string }
type GenerationType = 'flutter-app' | 'microservice' | 'service-graph'
type GenStatus = 'idle' | 'running' | 'success' | 'error'
interface GenResult { success: boolean; files?: string[]; error?: string }

export default function CodegenPanel({ engineUrl }: Props): JSX.Element {
  const { project }                   = useCanvasStore()
  const [genType,    setGenType]      = useState<GenerationType>('flutter-app')
  const [outputDir,  setOutputDir]    = useState<string>('')
  const [status,     setStatus]       = useState<GenStatus>('idle')
  const [result,     setResult]       = useState<GenResult | null>(null)
  const [progress,   setProgress]     = useState<string>('')
  const [manualInput,setManualInput]  = useState(false)

  // ── Choose output dir ─────────────────────────────────
  const chooseOutputDir = async () => {
    try {
      // @ts-ignore
      const dir = await window.flutterForge?.fs?.chooseOutputDir()
      if (dir) { setOutputDir(dir); setManualInput(false) }
      else setManualInput(true)
    } catch { setManualInput(true) }
  }

  // ── Generate — BUG FIX: direct fetch, not IPC ────────
  const runGeneration = async () => {
    if (!project)   { alert('No project loaded'); return }
    if (!outputDir) { alert('Please choose or type an output directory'); return }

    setStatus('running'); setResult(null)

    const endpointMap: Record<GenerationType, string> = {
      'flutter-app':   '/api/codegen/flutter-app',
      'microservice':  '/api/codegen/microservice',
      'service-graph': '/api/codegen/service-graph',
    }
    const endpoint = endpointMap[genType]

    try {
      setProgress('Preparing project...')
      const payload = JSON.stringify(project)

      setProgress('Calling codegen engine...')
      const res = await fetch(engineUrl + endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payload, outputDir }),
      })

      if (!res.ok) {
        const errText = await res.text()
        setStatus('error')
        setResult({ success: false, error: `HTTP ${res.status}: ${errText}` })
        setProgress('')
        return
      }

      const data = await res.json()
      if (data.success !== false) {
        setStatus('success')
        setResult({ success: true, files: data.files || data.generatedFiles || [] })
        setProgress('')
      } else {
        setStatus('error')
        setResult({ success: false, error: data.error || 'Generation failed' })
        setProgress('')
      }
    } catch (err: any) {
      setStatus('error')
      setProgress('')
      if (err.message?.includes('fetch')) {
        setResult({ success: false, error: 'Engine offline. Start the engine:\ncd codegen-engine && mvn spring-boot:run -Dspring-boot.run.profiles=ide,local' })
      } else {
        setResult({ success: false, error: String(err) })
      }
    }
  }

  const openOutputDir = async () => {
    if (!outputDir) return
    try { // @ts-ignore
      await window.flutterForge?.fs?.openInExplorer(outputDir)
    } catch { /* ignore — may not be available */ }
  }

  const screenCount   = project ? Object.keys(project.screens).length : 0
  const serviceCount  = project ? Object.keys(project.services ?? {}).length : 0

  return (
    <div style={s.panel}>

      {/* Header */}
      <div style={s.header}>
        <span style={{ fontSize:16, color:'#7c5cbf' }}>⚙</span>
        <span style={s.headerTitle}>Code Generator</span>
        <span style={s.headerBadge}>Session 2</span>
      </div>

      {/* Project summary */}
      <div style={s.summaryRow}>
        <div style={s.summaryCard}>
          <div style={s.summaryVal}>{screenCount}</div>
          <div style={s.summaryLabel}>Screens</div>
        </div>
        <div style={s.summaryCard}>
          <div style={s.summaryVal}>{serviceCount}</div>
          <div style={s.summaryLabel}>Services</div>
        </div>
        <div style={s.summaryCard}>
          <div style={s.summaryVal}>{project?.name ?? '—'}</div>
          <div style={s.summaryLabel}>Project</div>
        </div>
      </div>

      {!project && (
        <div style={s.warnBox}>No project loaded — import a .ffproj or create one via ⊡ Project</div>
      )}

      <div style={s.divider} />

      {/* Generation type */}
      <div style={s.fieldLabel}>Generation type</div>
      <div style={s.typeGrid}>
        {([
          { id:'flutter-app',   icon:'◈', label:'Flutter App',   sub:'Dart + Riverpod + GoRouter' },
          { id:'microservice',  icon:'⬡', label:'Microservice',  sub:'Spring Boot 3 + OpenAPI'    },
          { id:'service-graph', icon:'⬢', label:'Service Graph', sub:'All services + Gateway'     },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setGenType(t.id)} style={{
            ...s.typeBtn,
            background:  genType===t.id ? '#1e1a33' : '#0f0f1e',
            borderColor: genType===t.id ? '#7c5cbf' : '#2a2a3a',
          }}>
            <span style={{ fontSize:16, marginBottom:4 }}>{t.icon}</span>
            <span style={{ fontSize:12, fontWeight:600, color:genType===t.id?'#e0d7ff':'#888' }}>{t.label}</span>
            <span style={{ fontSize:10, color:'#555' }}>{t.sub}</span>
          </button>
        ))}
      </div>

      {/* Output directory */}
      <div style={{ ...s.fieldLabel, marginTop:14 }}>Output directory</div>
      {manualInput ? (
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
          <input
            autoFocus
            value={outputDir}
            onChange={e => setOutputDir(e.target.value)}
            placeholder="e.g. C:\Projects\my-flutter-app"
            style={s.manualInput}
            onKeyDown={e => e.key === 'Escape' && setManualInput(false)}
          />
          <button onClick={() => setManualInput(false)}
            style={{ padding:'8px 10px', background:'#1a5c2e', border:'1px solid #1a5c2e', borderRadius:8, color:'#4caf7d', fontSize:12, cursor:'pointer' }}>
            ✓
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', gap:6, marginBottom:6 }}>
          <div style={s.dirInput} onClick={chooseOutputDir}>
            {outputDir || <span style={{ color:'#444' }}>Click Browse or type path manually</span>}
          </div>
          <button style={s.dirBtn} onClick={chooseOutputDir}>Browse</button>
          <button style={{ ...s.dirBtn, color:'#666', borderColor:'#2a2a3a' }} onClick={() => setManualInput(true)} title="Type path manually">✎</button>
        </div>
      )}

      {outputDir && (
        <div style={{ fontSize:10, color:'#4caf7d', marginBottom:8, fontFamily:'monospace', wordBreak:'break-all' as const }}>
          → {outputDir}
        </div>
      )}

      {/* API Bindings code generation */}
      <ApiBindingsSection engineUrl={engineUrl} />

      {/* Generate button */}
      <button
        onClick={runGeneration}
        disabled={status==='running' || !project}
        style={{
          ...s.generateBtn,
          opacity:  status==='running' || !project ? 0.5 : 1,
          cursor:   status==='running' || !project ? 'not-allowed' : 'pointer',
        }}>
        {status==='running' ? '◌ Generating...' : '▶ Generate Code'}
      </button>

      {/* Progress */}
      {progress && <div style={s.progress}>{progress}</div>}

      {/* Result */}
      {result && (
        <div style={{ ...s.result, borderColor:result.success?'#1a5c2e':'#5c1a1a', background:result.success?'#0a1a0f':'#1a0a0a' }}>
          {result.success ? (
            <>
              <div style={{ color:'#4caf7d', fontWeight:600, marginBottom:8 }}>
                ✓ Generated {result.files?.length ?? 0} files
              </div>
              <div style={s.fileList}>
                {result.files?.slice(0, 10).map((f, i) => (
                  <div key={i} style={s.fileItem}>
                    <span style={{ color:'#2a5c2a' }}>•</span>
                    <span style={{ color:'#4caf7d', fontSize:11, fontFamily:'monospace' }}>
                      {f.split(/[/\\]/).slice(-2).join('/')}
                    </span>
                  </div>
                ))}
                {(result.files?.length ?? 0) > 10 && (
                  <div style={{ color:'#555', fontSize:11, marginTop:4 }}>
                    ...and {(result.files?.length ?? 0) - 10} more files
                  </div>
                )}
              </div>
              <button style={s.openBtn} onClick={openOutputDir}>Open in Explorer</button>
            </>
          ) : (
            <div style={{ color:'#e05252', fontSize:12, lineHeight:1.7, whiteSpace:'pre-wrap' as const }}>
              ✗ {result.error}
            </div>
          )}
        </div>
      )}

      {/* Engine status hint */}
      <div style={{ marginTop:'auto', paddingTop:16, fontSize:10, color:'#333', lineHeight:1.7, borderTop:'1px solid #1e1e2e' }}>
        Engine must be running on {engineUrl}<br/>
        <code style={{ color:'#555', fontSize:10 }}>mvn spring-boot:run -Dspring-boot.run.profiles=ide,local</code>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// API BINDINGS SECTION
// ─────────────────────────────────────────────────────

function ApiBindingsSection({ engineUrl }: { engineUrl: string }) {
  const activeScreen  = useCanvasStore(selectActiveScreen)
  const { interfaces, dataFiles } = useIntegrationsStore()
  const [status,  setStatus]  = React.useState<'idle'|'running'|'done'|'error'>('idle')
  const [files,   setFiles]   = React.useState<{ name: string; code: string }[]>([])
  const [preview, setPreview] = React.useState<string | null>(null)
  const [error,   setError]   = React.useState('')

  const boundWidgets = activeScreen
    ? Object.values(activeScreen.widgets || {}).filter((w: any) => w.apiBinding?.interfaceId).length
    : 0

  const handleGenerate = async () => {
    if (!activeScreen) return
    setStatus('running'); setError(''); setFiles([])
    try {
      const codeMap = generateApiCode(activeScreen as any, interfaces, dataFiles)
      if (codeMap.size === 0) {
        setError('No bindings found on this screen. Bind some fields in the Properties panel first.')
        setStatus('error'); return
      }
      const fileList = Array.from(codeMap.entries()).map(([name, code]) => ({ name, code }))
      setFiles(fileList)
      setStatus('done')

      // Also write files to project if path available
      const fp = (window as any).flutterForge
      // We just preview in IDE — actual files written during full build
    } catch (e: any) {
      setError(e.message || 'Generation failed'); setStatus('error')
    }
  }

  return (
    <div style={{ padding:'14px', borderBottom:'1px solid #1e1e2e' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#4caf7d' }}>API Bindings</div>
          <div style={{ fontSize:10, color:'#555', marginTop:2 }}>
            {boundWidgets > 0
              ? `${boundWidgets} widget${boundWidgets>1?'s':''} bound on ${activeScreen?.name}`
              : 'No bindings on current screen'}
          </div>
        </div>
        <button onClick={handleGenerate} disabled={status==='running' || boundWidgets===0}
          style={{ padding:'6px 14px', background: boundWidgets>0 ? '#1a3a1a' : '#111',
            border:'1px solid', borderColor: boundWidgets>0 ? '#4caf7d' : '#1e2d3d',
            borderRadius:7, color: boundWidgets>0 ? '#4caf7d' : '#444',
            fontSize:11, cursor: boundWidgets>0 ? 'pointer' : 'not-allowed',
            fontFamily:'system-ui,sans-serif', fontWeight:600 }}>
          {status==='running' ? '◌ Generating...' : '⟳ Generate Bindings'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize:11, color:'#e05252', background:'#1a0808', border:'1px solid #5c1a1a',
          borderRadius:6, padding:'7px 10px', marginBottom:8 }}>{error}</div>
      )}

      {files.length > 0 && (
        <div>
          <div style={{ fontSize:10, color:'#555', marginBottom:6 }}>
            Generated {files.length} file{files.length>1?'s':''}:
          </div>
          {files.map(f => (
            <div key={f.name}
              onClick={() => setPreview(preview === f.name ? null : f.name)}
              style={{ padding:'5px 8px', background:'#0a0a14', border:'1px solid #1e2d3d',
                borderRadius:5, fontSize:10, color:'#4caf7d', fontFamily:'monospace',
                cursor:'pointer', marginBottom:4, display:'flex', justifyContent:'space-between' }}>
              <span>{f.name}</span>
              <span style={{ color:'#555' }}>{preview === f.name ? '▲' : '▼'}</span>
            </div>
          ))}
          {preview && (() => {
            const f = files.find(x => x.name === preview)
            return f ? (
              <pre style={{ background:'#050510', border:'1px solid #1e2d3d', borderRadius:6,
                padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'#c9d1d9',
                overflowX:'auto', whiteSpace:'pre', maxHeight:200, overflowY:'auto',
                marginTop:4, lineHeight:1.7 }}>{f.code}</pre>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  panel:        { display:'flex', flexDirection:'column', height:'100%', overflowY:'auto', padding:16, gap:8, background:'#0d0d1a' },
  header:       { display:'flex', alignItems:'center', gap:8, marginBottom:4 },
  headerTitle:  { fontSize:15, fontWeight:700, color:'#e0d7ff', flex:1 },
  headerBadge:  { fontSize:10, padding:'2px 7px', borderRadius:20, background:'#1e1a33', border:'1px solid #3d3060', color:'#9d7fe8' },
  summaryRow:   { display:'flex', gap:8 },
  summaryCard:  { flex:1, padding:'10px 8px', background:'#13132a', border:'1px solid #2a2a3a', borderRadius:8, textAlign:'center' as const },
  summaryVal:   { fontSize:18, fontWeight:700, color:'#e0d7ff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const },
  summaryLabel: { fontSize:10, color:'#555', marginTop:2 },
  warnBox:      { padding:'8px 12px', background:'#1a1500', border:'1px solid #7a5c00', borderRadius:8, fontSize:12, color:'#c9a227' },
  divider:      { height:1, background:'#1e1e2e', margin:'4px 0' },
  fieldLabel:   { fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.07em', textTransform:'uppercase' as const, marginBottom:6 },
  typeGrid:     { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 },
  typeBtn:      { display:'flex', flexDirection:'column' as const, alignItems:'center', padding:'10px 6px', borderRadius:8, border:'1px solid', cursor:'pointer', gap:2, background:'#0f0f1e' },
  manualInput:  { flex:1, padding:'9px 12px', background:'#0a0a14', border:'1px solid #7c5cbf', borderRadius:8, fontSize:12, color:'#e0d7ff', outline:'none', fontFamily:'monospace' },
  dirInput:     { flex:1, padding:'8px 10px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:6, fontSize:11, color:'#888', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const },
  dirBtn:       { padding:'7px 10px', background:'#13132a', border:'1px solid #3d3060', borderRadius:6, color:'#9d7fe8', fontSize:11, cursor:'pointer' },
  generateBtn:  { padding:'13px', background:'#7c5cbf', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  progress:     { fontSize:11, color:'#666', textAlign:'center' as const, padding:'4px 0' },
  result:       { padding:12, borderRadius:8, border:'1px solid', marginTop:4 },
  fileList:     { display:'flex', flexDirection:'column' as const, gap:3, marginBottom:8 },
  fileItem:     { display:'flex', gap:6, alignItems:'center' },
  openBtn:      { padding:'6px 12px', background:'#1a3a2a', border:'1px solid #1a5c2e', borderRadius:6, color:'#4caf7d', fontSize:11, cursor:'pointer' },
}
