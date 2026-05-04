import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import { useProjectStore } from '../../store/project.store'
import {
  useCodeStore,
  generateDartScaffold,
  generateJavaScaffold,
  generateSharedDartTemplate,
  generateSharedJavaTemplate,
} from '../../store/code.store'

interface Props { engineUrl: string }

type AiMode = 'generate' | 'autocomplete' | 'review' | 'tests'

interface AiResult {
  mode:    AiMode
  content: string
  loading: boolean
  error:   boolean
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

export default function CodeEditor({ engineUrl }: Props): JSX.Element {
  const [savedMsg,       setSavedMsg]       = useState('')
  const [addingShared,   setAddingShared]   = useState(false)
  const [newFilename,    setNewFilename]    = useState('')
  const [newFileLang,    setNewFileLang]    = useState<'dart'|'java'>('dart')
  // Rename state — which item is being renamed and its current draft value
  const [renamingId,     setRenamingId]     = useState<string | null>(null)
  const [renameVal,      setRenameVal]      = useState('')

  // AI panel state
  const [aiMode,         setAiMode]         = useState<AiMode>('generate')
  const [aiPrompt,       setAiPrompt]       = useState('')
  const [aiResult,       setAiResult]       = useState<AiResult | null>(null)
  const [abortCtrl,      setAbortCtrl]      = useState<AbortController | null>(null)

  const { project }                 = useCanvasStore()
  const { services: microservices } = useProjectStore()
  const store                       = useCodeStore()
  const editorRef                   = useRef<HTMLTextAreaElement>(null)
  const aiResultRef                 = useRef<HTMLDivElement>(null)
  const renameRef                   = useRef<HTMLInputElement>(null)

  const screens = project ? Object.values(project.screens) : []

  // ── Auto-init files ──────────────────────────────────

  useEffect(() => {
    screens.forEach(sc => {
      if (!store.screenFiles[sc.id]) store.initScreenFile(sc.id, sc.name, sc.route)
    })
  }, [screens.length])

  useEffect(() => {
    microservices.forEach(svc => {
      if (!store.serviceFiles[svc.id]) store.initServiceFile(svc.id, svc.name, svc.artifactId, svc.groupId)
    })
  }, [microservices.length])

  // Auto-scroll AI results
  useEffect(() => {
    if (aiResult?.content) {
      aiResultRef.current?.scrollTo({ top: aiResultRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [aiResult?.content])

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) setTimeout(() => renameRef.current?.focus(), 50)
  }, [renamingId])

  // ── Active file resolution ───────────────────────────

  const activeScreen  = store.activeScreenFileId  ? store.screenFiles[store.activeScreenFileId]   : null
  const activeService = store.activeServiceFileId ? store.serviceFiles[store.activeServiceFileId] : null
  const activeShared  = store.activeSharedFileId  ? store.sharedFiles.find(f => f.id === store.activeSharedFileId) : null

  const activeCode     = activeScreen?.dartCode ?? activeService?.javaCode ?? activeShared?.code ?? ''
  const activeLang     = (activeService || activeShared?.lang === 'java') ? 'java' : 'dart'
  // Issue 2 fix: use filename from store (matches screenName exactly)
  const activeFilename = activeScreen?.filename
    ?? (activeService ? activeService.serviceName + 'Impl.java' : null)
    ?? activeShared?.filename
    ?? ''

  // ── Build rich project context for AI ───────────────

  const buildProjectContext = useCallback((): string => {
    const parts: string[] = []
    if (activeScreen) {
      const screen = screens.find(s => s.id === activeScreen.screenId)
      if (screen) {
        parts.push(`FILE TYPE: Flutter screen (Dart / Riverpod)`)
        parts.push(`SCREEN NAME: ${screen.name}`)
        parts.push(`FILENAME: ${activeScreen.filename}`)
        parts.push(`ROUTE: ${screen.route}`)
        const widgetTypes = [...new Set(Object.values(screen.widgets).map(w => w.type.split('.').pop()))].join(', ')
        parts.push(`WIDGETS ON CANVAS: ${widgetTypes}`)
      }
    } else if (activeService) {
      const svc = microservices.find(s => s.id === activeService.serviceId)
      if (svc) {
        parts.push(`FILE TYPE: Spring Boot microservice (Java 21)`)
        parts.push(`SERVICE: ${svc.name} (${svc.artifactId})`)
        parts.push(`PORT: ${svc.port} | DB: ${svc.hasDatabase} | Kafka: ${svc.hasKafka} | JWT: ${svc.hasJwt}`)
      }
    } else if (activeShared) {
      parts.push(`FILE TYPE: Shared project file (${activeShared.lang})`)
      parts.push(`FILENAME: ${activeShared.filename}`)
    }
    if (project) parts.push(`PROJECT: ${project.name} (${project.packageName})`)
    const allSvcs = microservices.map(s => `${s.name}:${s.port}`).join(', ')
    if (allSvcs) parts.push(`ALL SERVICES: ${allSvcs}`)
    return parts.join('\n')
  }, [activeScreen, activeService, activeShared, screens, microservices, project])

  // ── Ctrl+S ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        setSavedMsg('✓ Saved')
        setTimeout(() => setSavedMsg(''), 2000)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Code change ──────────────────────────────────────

  const handleCodeChange = (val: string) => {
    if (store.activeScreenFileId)       store.updateScreenCode(store.activeScreenFileId, val)
    else if (store.activeServiceFileId) store.updateServiceCode(store.activeServiceFileId, val)
    else if (store.activeSharedFileId)  store.updateSharedCode(store.activeSharedFileId, val)
  }

  // ── Tab = 2 spaces ───────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const s  = ta.selectionStart
      const v  = ta.value
      const nv = v.substring(0, s) + '  ' + v.substring(ta.selectionEnd)
      ta.value = nv
      ta.selectionStart = ta.selectionEnd = s + 2
      handleCodeChange(nv)
    }
  }

  // ── Rename ───────────────────────────────────────────

  const startRename = (id: string, current: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(id)
    setRenameVal(current)
  }

  const commitRename = () => {
    if (!renamingId || !renameVal.trim()) { setRenamingId(null); return }
    const val = renameVal.trim()
    // Screen file rename
    if (store.screenFiles[renamingId]) {
      const ext = val.endsWith('.dart') ? val : val + '.dart'
      store.renameScreenFile(renamingId, ext)
    } else {
      // Shared file rename
      store.renameSharedFile(renamingId, val)
    }
    setRenamingId(null)
  }

  // ── Reset to scaffold ────────────────────────────────

  const handleReset = () => {
    if (!confirm('Reset to default scaffold? Your edits will be lost.')) return
    if (activeScreen) {
      store.updateScreenCode(activeScreen.screenId, generateDartScaffold(activeScreen.screenName, activeScreen.route))
    } else if (activeService) {
      const svc = microservices.find(s => s.id === activeService.serviceId)
      if (svc) store.updateServiceCode(svc.id, generateJavaScaffold(svc.name, svc.artifactId, svc.groupId))
    } else if (activeShared) {
      const code = activeShared.lang === 'dart'
        ? generateSharedDartTemplate(activeShared.filename)
        : generateSharedJavaTemplate(activeShared.filename)
      store.updateSharedCode(activeShared.id, code)
    }
  }

  // ── Shared file add ──────────────────────────────────

  const handleAddShared = () => {
    if (!newFilename.trim()) return
    const ext = newFileLang === 'dart' ? '.dart' : '.java'
    const filename = newFilename.trim().endsWith(ext) ? newFilename.trim() : newFilename.trim() + ext
    store.addSharedFile(filename, newFileLang)
    setNewFilename('')
    setAddingShared(false)
  }

  // ─────────────────────────────────────────────────────
  // AI ACTIONS
  // ─────────────────────────────────────────────────────

  const stopAI = () => { abortCtrl?.abort(); setAiResult(prev => prev ? { ...prev, loading: false } : null) }

  const runGenerate = async () => {
    if (!aiPrompt.trim() || !activeCode) return
    const ctrl = new AbortController()
    setAbortCtrl(ctrl)
    setAiResult({ mode: 'generate', content: '', loading: true, error: false })
    try {
      const res = await fetch(engineUrl + '/api/ai/generate-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt, lang: activeLang, fileContext: activeCode.slice(0, 2000), projectContext: buildProjectContext() }),
        signal: ctrl.signal,
      })
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let full = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          if (data.startsWith('[ERROR]')) { setAiResult({ mode:'generate', content:data.slice(8), loading:false, error:true }); return }
          full += data.replace(/\\n/g,'\n').replace(/\\r/g,'')
          setAiResult({ mode:'generate', content:full, loading:false, error:false })
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setAiResult({ mode:'generate', content:'Error: '+err.message, loading:false, error:true })
    }
  }

  const runAutocomplete = async () => {
    if (!activeCode) return
    setAiResult({ mode:'autocomplete', content:'', loading:true, error:false })
    const ta = editorRef.current; const cursor = ta?.selectionStart ?? activeCode.length
    const codeUpTo = activeCode.slice(Math.max(0, cursor - 1500), cursor)
    const filePurpose = activeScreen ? `${activeScreen.screenName} screen controller` : activeService ? `${activeService.serviceName} Spring Boot service` : `Shared ${activeLang} file`
    try {
      const res = await fetch(engineUrl + '/api/ai/autocomplete-code', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ currentCode: codeUpTo, lang: activeLang, fileContext: filePurpose }),
      })
      const data = await res.json()
      setAiResult({ mode:'autocomplete', content:data.completion||data.error||'', loading:false, error:!!data.error })
    } catch (err: any) { setAiResult({ mode:'autocomplete', content:'Error: '+err.message, loading:false, error:true }) }
  }

  const runReview = async () => {
    if (!activeCode) return
    setAiResult({ mode:'review', content:'', loading:true, error:false })
    try {
      const res  = await fetch(engineUrl + '/api/ai/review', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: activeCode }) })
      const data = await res.json()
      let content = ''
      if (data.score !== undefined) {
        content = `Score: ${data.score}/100\n\n${data.summary||''}`
        if (data.issues?.length) content += '\n\n─── Issues ───\n' + data.issues.map((i: any) => `[${i.severity?.toUpperCase()}] ${i.message}\n  Fix: ${i.fix}`).join('\n\n')
      } else { content = data.result || data.error || JSON.stringify(data, null, 2) }
      setAiResult({ mode:'review', content, loading:false, error:false })
    } catch (err: any) { setAiResult({ mode:'review', content:'Error: '+err.message, loading:false, error:true }) }
  }

  const runGenerateTests = async () => {
    if (!activeCode) return
    setAiResult({ mode:'tests', content:'', loading:true, error:false })
    const nm = activeScreen?.screenName ?? activeService?.serviceName ?? 'Class'
    try {
      const res  = await fetch(engineUrl + '/api/ai/generate-tests', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: activeCode, screenName: nm }) })
      const data = await res.json()
      setAiResult({ mode:'tests', content:data.tests||data.error||'', loading:false, error:!!data.error })
    } catch (err: any) { setAiResult({ mode:'tests', content:'Error: '+err.message, loading:false, error:true }) }
  }

  const insertIntoEditor = () => {
    if (!aiResult?.content || !activeCode) return
    const ta = editorRef.current; const cursor = ta?.selectionStart ?? activeCode.length
    handleCodeChange(activeCode.slice(0, cursor) + '\n\n' + aiResult.content + '\n' + activeCode.slice(cursor))
    setAiResult(null); setSavedMsg('✓ Inserted'); setTimeout(() => setSavedMsg(''), 2000)
  }
  const replaceEditor = () => {
    if (!aiResult?.content) return
    handleCodeChange(aiResult.content); setAiResult(null); setSavedMsg('✓ Replaced'); setTimeout(() => setSavedMsg(''), 2000)
  }
  const copyToClipboard = () => {
    if (!aiResult?.content) return
    navigator.clipboard.writeText(aiResult.content); setSavedMsg('✓ Copied'); setTimeout(() => setSavedMsg(''), 2000)
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────

  const hasFile = !!(activeScreen || activeService || activeShared)

  return (
    <div style={s.root}>

      {/* ── File Navigator ──────────────────────────────── */}
      <div style={s.nav}>

        {/* Dart screens */}
        <div style={s.navSection}>
          <div style={s.navHeader}>
            <span style={dot('#4a9edd')} /><span style={s.navLabel}>DART — SCREENS</span>
          </div>
          {screens.length === 0
            ? <div style={s.navHint}>Add screens in Canvas tab</div>
            : screens.map(sc => {
                const file     = store.screenFiles[sc.id]
                const isActive = store.activeScreenFileId === sc.id
                const isRenaming = renamingId === sc.id
                return (
                  <div key={sc.id}
                    onClick={() => { if (!file) store.initScreenFile(sc.id, sc.name, sc.route); else store.setActiveScreenFile(sc.id) }}
                    style={navItem(isActive, '#4a9edd')}
                  >
                    <span style={{ color:'#4a9edd', fontSize:11 }}>◈</span>
                    <div style={{ flex:1, overflow:'hidden' }}>
                      {isRenaming ? (
                        <input ref={renameRef} value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={e => { if (e.key==='Enter') commitRename(); if (e.key==='Escape') setRenamingId(null) }}
                          onClick={e => e.stopPropagation()}
                          style={s.renameInput} />
                      ) : (
                        <>
                          {/* Double-click filename to rename */}
                          <div
                            style={s.navName}
                            onDoubleClick={e => file && startRename(sc.id, file.filename, e as any)}
                            title="Double-click to rename">
                            {file?.filename ?? toSnakeCase(sc.name) + '.dart'}
                          </div>
                          <div style={s.navSub}>{sc.route}</div>
                        </>
                      )}
                    </div>
                    {/* Rename: double-click filename OR click ✎ button */}
                    {!isRenaming && file && (
                      <button
                        onClick={e => startRename(sc.id, file.filename, e)}
                        style={{ ...s.renameBtn, opacity: isActive ? 1 : 0.4 }}
                        title="Rename file (or double-click filename)">
                        ✎
                      </button>
                    )}
                  </div>
                )
              })
          }
        </div>

        {/* Java services */}
        <div style={s.navSection}>
          <div style={s.navHeader}>
            <span style={dot('#e09b2d')} /><span style={s.navLabel}>JAVA — SERVICES</span>
          </div>
          {microservices.length === 0
            ? <div style={s.navHint}>Add services in Services tab</div>
            : microservices.map(svc => {
                const isActive = store.activeServiceFileId === svc.id
                return (
                  <div key={svc.id}
                    onClick={() => { if (!store.serviceFiles[svc.id]) store.initServiceFile(svc.id, svc.name, svc.artifactId, svc.groupId); else store.setActiveServiceFile(svc.id) }}
                    style={navItem(isActive, '#e09b2d')}
                  >
                    <span style={{ color:'#e09b2d', fontSize:11 }}>⬡</span>
                    <div style={{ flex:1, overflow:'hidden' }}>
                      <div style={s.navName}>{svc.name}Impl.java</div>
                      <div style={s.navSub}>{svc.artifactId}</div>
                    </div>
                    {store.serviceFiles[svc.id] && <span style={s.dot} />}
                  </div>
                )
              })
          }
        </div>

        {/* Shared files */}
        <div style={{ ...s.navSection, flex:1 }}>
          <div style={s.navHeader}>
            <span style={dot('#4caf7d')} /><span style={s.navLabel}>SHARED FILES</span>
            <button onClick={() => setAddingShared(a => !a)} style={s.addBtn}>+</button>
          </div>

          {addingShared && (
            <div style={s.addForm}>
              <input autoFocus value={newFilename}
                onChange={e => setNewFilename(e.target.value)}
                onKeyDown={e => e.key==='Enter' && handleAddShared()}
                placeholder="e.g. api_client" style={s.addInput} />
              <div style={{ display:'flex', gap:4, marginTop:4 }}>
                {(['dart','java'] as const).map(l => (
                  <button key={l} onClick={() => setNewFileLang(l)} style={{
                    ...s.langBtn, background:newFileLang===l?(l==='dart'?'#0a1a2a':'#1a1500'):'transparent',
                    color:newFileLang===l?(l==='dart'?'#4a9edd':'#e09b2d'):'#555', borderColor:newFileLang===l?(l==='dart'?'#1a3a5a':'#7a5c00'):'#2a2a3a',
                  }}>{l}</button>
                ))}
                <button onClick={handleAddShared} style={s.confirmBtn}>Add</button>
              </div>
            </div>
          )}

          {store.sharedFiles.length === 0 && !addingShared && (
            <div style={s.navHint}>Add project-wide shared files</div>
          )}

          {store.sharedFiles.map(f => {
            const isActive   = store.activeSharedFileId === f.id
            const isRenaming = renamingId === f.id
            return (
              <div key={f.id} onClick={() => store.setActiveSharedFile(f.id)} style={navItem(isActive, '#4caf7d')}>
                <span style={{ color:'#4caf7d', fontSize:11 }}>⊙</span>
                <div style={{ flex:1, overflow:'hidden' }}>
                  {isRenaming ? (
                    <input ref={renameRef} value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key==='Enter') commitRename(); if (e.key==='Escape') setRenamingId(null) }}
                      onClick={e => e.stopPropagation()}
                      style={s.renameInput} />
                  ) : (
                    <>
                      <div style={s.navName}>{f.filename}</div>
                      <div style={s.navSub}>{f.lang}</div>
                    </>
                  )}
                </div>
                {/* Issue 1 fix: rename + delete buttons */}
                {!isRenaming && (
                  <button
                    onClick={e => startRename(f.id, f.filename, e)}
                    style={{ ...s.renameBtn, opacity: isActive ? 1 : 0.4 }}
                    title="Rename file">
                    ✎
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); store.deleteSharedFile(f.id) }} style={s.delBtn}>×</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Editor ───────────────────────────────────────── */}
      <div style={s.editorArea}>
        <div style={s.toolbar}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, padding:'2px 9px', borderRadius:10, fontWeight:600,
              background:activeLang==='dart'?'#0a1a2a':'#1a1500', color:activeLang==='dart'?'#4a9edd':'#e09b2d',
              border:`1px solid ${activeLang==='dart'?'#1a3a5a':'#7a5c00'}` }}>
              {activeLang==='dart'?'◈ Dart':'⬡ Java'}
            </span>
            {activeFilename && <span style={{ fontSize:12, color:'#666', fontFamily:'monospace' }}>{activeFilename}</span>}
            {activeScreen  && <span style={linkedBadge('#4a9edd')}>↔ {activeScreen.screenName}</span>}
            {activeService && <span style={linkedBadge('#e09b2d')}>↔ {activeService.serviceName}</span>}
            {activeShared  && <span style={linkedBadge('#4caf7d')}>⊙ Shared</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {savedMsg && <span style={{ fontSize:10, color:'#4caf7d' }}>{savedMsg}</span>}
            <button onClick={handleReset} disabled={!hasFile} style={{ ...s.toolBtn, color:'#e05252', opacity:hasFile?1:0.4 }}>↺ Reset</button>
            <span style={{ fontSize:10, color:'#333' }}>Ctrl+S</span>
          </div>
        </div>

        {hasFile ? (
          <div style={s.codeArea}>
            <div style={s.lineNumbers}>
              {activeCode.split('\n').map((_,i) => <div key={i} style={s.lineNum}>{i+1}</div>)}
            </div>
            <textarea ref={editorRef} value={activeCode}
              onChange={e => handleCodeChange(e.target.value)} onKeyDown={handleKeyDown}
              style={s.textarea} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" />
          </div>
        ) : (
          <div style={s.emptyState}>
            <div style={{ fontSize:36, color:'#2a2a3a', marginBottom:12 }}>{'{}'}</div>
            <div style={{ fontSize:14, color:'#555', fontWeight:600, marginBottom:8 }}>No file selected</div>
            <div style={{ fontSize:12, color:'#444', lineHeight:1.8, textAlign:'center' as const }}>Select a screen or service from the left panel</div>
          </div>
        )}
      </div>

      {/* ── AI Copilot Panel ─────────────────────────────── */}
      <div style={s.aiPanel}>
        <div style={s.aiHeader}>
          <span style={{ color:'#7c5cbf', fontSize:14 }}>◆</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#e0d7ff' }}>AI Copilot</span>
          <span style={{ fontSize:10, color:'#555', marginLeft:4 }}>claude</span>
        </div>

        <div style={s.contextBadge}>
          <span style={{ fontSize:9, color:'#555' }}>Context:</span>
          <span style={{ fontSize:10, color:hasFile?'#4caf7d':'#555', marginLeft:4 }}>
            {hasFile
              ? (activeScreen ? `${activeScreen.screenName} · ${activeScreen.filename}` : activeService ? activeService.serviceName : activeShared?.filename)
              : 'No file open'}
          </span>
        </div>

        <div style={s.aiModes}>
          {([
            { id:'generate',    icon:'✦', label:'Generate' },
            { id:'autocomplete',icon:'⊕', label:'Complete'  },
            { id:'review',      icon:'✓', label:'Review'    },
            { id:'tests',       icon:'⚙', label:'Tests'     },
          ] as const).map(m => (
            <button key={m.id} onClick={() => { setAiMode(m.id); setAiResult(null) }} style={{
              ...s.modeBtn,
              background:  aiMode===m.id ? '#1e1a33' : 'transparent',
              borderColor: aiMode===m.id ? '#7c5cbf' : '#1e1e2e',
              color:       aiMode===m.id ? '#e0d7ff' : '#555',
            }}>
              <span style={{ fontSize:12 }}>{m.icon}</span>
              <span style={{ fontSize:10 }}>{m.label}</span>
            </button>
          ))}
        </div>

        {aiMode==='generate' && (
          <div style={s.aiInput}>
            <div style={s.aiInputLabel}>What should I {activeLang==='dart'?'add to this controller':'implement in this service'}?</div>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && e.ctrlKey) runGenerate() }}
              placeholder={activeLang==='dart' ? 'e.g. "add a login method calling the auth API"' : 'e.g. "add findByEmail and activate/deactivate methods"'}
              rows={4} style={s.promptTextarea} disabled={!hasFile} />
            <button onClick={runGenerate} disabled={!aiPrompt.trim()||!hasFile||!!aiResult?.loading}
              style={{ ...s.runBtn, opacity:aiPrompt.trim()&&hasFile?1:0.4 }}>
              {aiResult?.loading&&aiMode==='generate'?'◌ Generating...':'▶ Generate Code'}
            </button>
            <div style={{ fontSize:9, color:'#333', marginTop:4, textAlign:'center' as const }}>Ctrl+Enter to run</div>
          </div>
        )}
        {aiMode==='autocomplete' && (
          <div style={s.aiInput}>
            <div style={s.aiInputLabel}>Suggest next code block</div>
            <div style={{ fontSize:11, color:'#555', lineHeight:1.7, marginBottom:10 }}>Place cursor in editor where you want the completion, then click Suggest.</div>
            <button onClick={runAutocomplete} disabled={!hasFile||!!aiResult?.loading} style={{ ...s.runBtn, opacity:hasFile?1:0.4 }}>
              {aiResult?.loading&&aiMode==='autocomplete'?'◌ Thinking...':'⊕ Suggest Next Block'}
            </button>
          </div>
        )}
        {aiMode==='review' && (
          <div style={s.aiInput}>
            <div style={s.aiInputLabel}>Review for bugs and issues</div>
            <div style={{ fontSize:11, color:'#555', lineHeight:1.7, marginBottom:10 }}>Checks null safety, error handling, performance issues, missing validations.</div>
            <button onClick={runReview} disabled={!hasFile||!!aiResult?.loading} style={{ ...s.runBtn, opacity:hasFile?1:0.4 }}>
              {aiResult?.loading&&aiMode==='review'?'◌ Reviewing...':'✓ Review Code'}
            </button>
          </div>
        )}
        {aiMode==='tests' && (
          <div style={s.aiInput}>
            <div style={s.aiInputLabel}>Generate unit tests</div>
            <div style={{ fontSize:11, color:'#555', lineHeight:1.7, marginBottom:10 }}>
              {activeLang==='dart' ? 'Flutter widget tests with Riverpod mocks.' : 'Spring Boot @WebMvcTest + Mockito.'}
            </div>
            <button onClick={runGenerateTests} disabled={!hasFile||!!aiResult?.loading} style={{ ...s.runBtn, opacity:hasFile?1:0.4 }}>
              {aiResult?.loading&&aiMode==='tests'?'◌ Generating...':'⚙ Generate Tests'}
            </button>
          </div>
        )}

        {aiResult && (
          <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', borderTop:'1px solid #1e1e2e' }}>
            <div style={s.resultToolbar}>
              <span style={{ fontSize:10, color:aiResult.error?'#e05252':'#4caf7d' }}>
                {aiResult.loading?'◌ Streaming...':aiResult.error?'✗ Error':'✓ Ready'}
              </span>
              <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
                {!aiResult.error&&!aiResult.loading&&(
                  <>
                    <button onClick={insertIntoEditor} style={s.actionBtn}>↓ Insert</button>
                    <button onClick={replaceEditor}    style={s.actionBtn}>⇄ Replace</button>
                    <button onClick={copyToClipboard}  style={s.actionBtn}>⎘ Copy</button>
                  </>
                )}
                {aiResult.loading && <button onClick={stopAI} style={{ ...s.actionBtn, color:'#e05252' }}>⊠ Stop</button>}
                <button onClick={() => setAiResult(null)} style={{ ...s.actionBtn, color:'#555' }}>×</button>
              </div>
            </div>
            <div ref={aiResultRef} style={s.resultContent}>
              <pre style={s.resultPre}>{aiResult.content||(aiResult.loading?'Thinking...':'')}</pre>
              {aiResult.loading && <span style={{ color:'#7c5cbf', fontSize:14 }}>▌</span>}
            </div>
          </div>
        )}

        {!aiResult && (
          <div style={s.aiEmptyState}>
            <div style={{ fontSize:24, color:'#2a2a3a', marginBottom:8 }}>◆</div>
            <div style={{ fontSize:11, color:'#444', lineHeight:1.8, textAlign:'center' as const }}>
              {hasFile ? 'Context loaded.\nChoose a mode above and run AI.' : 'Open a file first,\nthen use AI features.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// STYLE HELPERS
// ─────────────────────────────────────────────────────────

function toSnakeCase(s: string) {
  return s.replace(/([A-Z])/g,'_$1').toLowerCase().replace(/^_/,'').replace(/[^a-z0-9_]/g,'_')
}

const dot = (color: string): React.CSSProperties => ({
  width:7, height:7, borderRadius:'50%', background:color, flexShrink:0, display:'inline-block'
})

const navItem = (active: boolean, color: string): React.CSSProperties => ({
  display:'flex', alignItems:'center', gap:7, padding:'5px 10px', cursor:'pointer',
  background:  active ? '#1a1a33' : 'transparent',
  borderLeft:  active ? `2px solid ${color}` : '2px solid transparent',
  color:       active ? '#e0d7ff' : '#666',
})

const linkedBadge = (color: string): React.CSSProperties => ({
  fontSize:10, padding:'1px 8px', borderRadius:10,
  background:'#0f0f1e', color, border:`1px solid ${color}44`,
})

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:           { display:'flex', height:'100%', overflow:'hidden', background:'#0d0d1a', fontFamily:'system-ui,sans-serif' },
  nav:            { width:190, flexShrink:0, background:'#0a0a16', borderRight:'1px solid #1e1e2e', display:'flex', flexDirection:'column', overflow:'hidden' },
  navSection:     { borderBottom:'1px solid #1e1e2e', paddingBottom:6 },
  navHeader:      { display:'flex', alignItems:'center', gap:6, padding:'8px 10px 4px' },
  navLabel:       { fontSize:9, fontWeight:700, color:'#444', letterSpacing:'0.08em', flex:1 },
  navHint:        { padding:'4px 12px 6px', fontSize:10, color:'#333', lineHeight:1.6 },
  navName:        { fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, fontFamily:'monospace' },
  navSub:         { fontSize:9, color:'#444', marginTop:1 },
  dot:            { width:5, height:5, borderRadius:'50%', background:'#4caf7d', flexShrink:0 },
  addBtn:         { width:16, height:16, background:'#1e1a33', border:'1px solid #3d3060', borderRadius:3, color:'#9d7fe8', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 },
  delBtn:         { background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:13, padding:'0 2px', lineHeight:1 },
  renameBtn:      { background:'none', border:'1px solid #3d3060', borderRadius:3, color:'#9d7fe8', cursor:'pointer', fontSize:11, padding:'1px 5px', lineHeight:1.2, flexShrink:0 },
  renameInput:    { width:'100%', padding:'1px 4px', background:'#0a0a14', border:'1px solid #7c5cbf', borderRadius:3, fontSize:11, color:'#e0d7ff', outline:'none', fontFamily:'monospace' },
  addForm:        { padding:'6px 10px', background:'#0f0f1e', margin:'0 4px', borderRadius:6, border:'1px solid #1e1e2e' },
  addInput:       { width:'100%', padding:'4px 6px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:4, fontSize:11, color:'#d4d4d4', outline:'none', fontFamily:'monospace' },
  langBtn:        { padding:'2px 8px', border:'1px solid', borderRadius:4, cursor:'pointer', fontSize:10, fontFamily:'system-ui,sans-serif' },
  confirmBtn:     { flex:1, padding:'2px 8px', background:'#1e1a33', border:'1px solid #3d3060', borderRadius:4, color:'#9d7fe8', cursor:'pointer', fontSize:10, fontFamily:'system-ui,sans-serif' },
  editorArea:     { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  toolbar:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 12px', background:'#080813', borderBottom:'1px solid #1e1e2e', flexShrink:0, gap:8 },
  toolBtn:        { padding:'3px 9px', background:'#13132a', border:'1px solid #2a2a3a', borderRadius:5, color:'#9d7fe8', cursor:'pointer', fontSize:11, fontFamily:'system-ui,sans-serif' },
  codeArea:       { flex:1, display:'flex', overflow:'hidden' },
  lineNumbers:    { width:40, flexShrink:0, background:'#0a0a14', borderRight:'1px solid #1e1e2e', overflowY:'hidden', paddingTop:12 },
  lineNum:        { height:20, lineHeight:'20px', textAlign:'right' as const, paddingRight:8, fontSize:11, color:'#333', fontFamily:'monospace', userSelect:'none' as const },
  textarea:       { flex:1, padding:'12px 14px', background:'#0d0d1a', border:'none', outline:'none', resize:'none' as const, fontSize:12, color:'#d4d4d4', fontFamily:'"Consolas","Monaco","Courier New",monospace', lineHeight:'20px', overflowY:'auto' as const },
  emptyState:     { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, color:'#444' },
  aiPanel:        { width:280, flexShrink:0, background:'#0a0a16', borderLeft:'1px solid #1e1e2e', display:'flex', flexDirection:'column', overflow:'hidden' },
  aiHeader:       { display:'flex', alignItems:'center', gap:8, padding:'11px 12px 8px', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  contextBadge:   { padding:'5px 12px', background:'#0f0f1e', borderBottom:'1px solid #1e1e2e', flexShrink:0, display:'flex', alignItems:'center' },
  aiModes:        { display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, padding:8, borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  modeBtn:        { display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'6px 4px', borderRadius:7, border:'1px solid', cursor:'pointer', fontSize:11, fontFamily:'system-ui,sans-serif' },
  aiInput:        { padding:'10px 12px', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  aiInputLabel:   { fontSize:10, fontWeight:700, color:'#555', marginBottom:8, letterSpacing:'0.04em' },
  promptTextarea: { width:'100%', padding:'8px 10px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:7, fontSize:11, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif', resize:'none' as const, lineHeight:1.6, marginBottom:8 },
  runBtn:         { width:'100%', padding:'9px', background:'#7c5cbf', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  resultToolbar:  { display:'flex', alignItems:'center', padding:'5px 10px', background:'#080813', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  actionBtn:      { padding:'2px 8px', background:'#13132a', border:'1px solid #2a2a3a', borderRadius:4, color:'#9d7fe8', cursor:'pointer', fontSize:10, fontFamily:'system-ui,sans-serif' },
  resultContent:  { flex:1, overflowY:'auto' as const, padding:'8px 10px' },
  resultPre:      { fontSize:11, color:'#ccc', fontFamily:'"Consolas","Monaco",monospace', lineHeight:1.7, whiteSpace:'pre-wrap' as const, wordBreak:'break-word' as const },
  aiEmptyState:   { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 },
}
