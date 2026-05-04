// ============================================================
// FigmaImporter — main UI component
// Orchestrates all 5 import phases with step-by-step UX.
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../../store/canvas.store'

import { parseFileKey, fetchFrameList, fetchFullFrames, findFrameNodes } from './figma.api'
import type { FrameEntry } from './figma.api'
import { mapChildren } from './figma.mapper'
import type { WidgetMap } from './figma.mapper'
import { resolveScreen, extractTheme, toScreenName, toRoute } from './figma.resolver'
import { injectScreen, injectTheme, buildFidelityReport } from './figma.inject'
import type { FidelityReport } from './figma.inject'
import type { FigmaFile } from './figma.types'

// ── Types ────────────────────────────────────────────────────

type Phase = 'idle' | 'loading_frames' | 'selecting' | 'importing' | 'done' | 'error'

// ── Small UI helpers ─────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: '#0a0a14', border: '1px solid #1e2d3d',
  borderRadius: 8, color: '#d4d4d4',
  fontSize: 12, outline: 'none', fontFamily: 'monospace',
  boxSizing: 'border-box',
}

const sBtn: React.CSSProperties = {
  padding: '2px 10px', background: '#0a0a14',
  border: '1px solid #1e2d3d', borderRadius: 5,
  color: '#555', cursor: 'pointer', fontSize: 10,
  fontFamily: 'system-ui, sans-serif',
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #1e2d3d', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '7px 14px', background: '#0a0a14', borderBottom: '1px solid #1e2d3d' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
          {title}
        </span>
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  )
}

function StepDot({ num, label, done, active }: { num: number; label: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        background: done ? '#1a3a1a' : active ? '#1e1a33' : '#0a0a14',
        border: `1.5px solid ${done ? '#4caf7d' : active ? '#9d7fe8' : '#222'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        color: done ? '#4caf7d' : active ? '#c8a8ff' : '#444',
        transition: 'all 0.2s',
      }}>
        {done ? '✓' : num}
      </div>
      <span style={{ fontSize: 12, color: done ? '#4caf7d' : active ? '#c8a8ff' : '#555', transition: 'color 0.2s' }}>
        {label}
      </span>
    </div>
  )
}

function LogLine({ line }: { line: string }) {
  const isOk  = line.startsWith('✓') || line.includes('Done')
  const isErr = line.startsWith('✗') || line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')
  return (
    <div style={{
      color: isOk ? '#4caf7d' : isErr ? '#e05252' : '#777',
      fontSize: 12, lineHeight: 1.8, fontFamily: 'monospace',
    }}>
      {isOk ? '✓ ' : isErr ? '✗ ' : '› '}{line}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function FigmaImporter(): JSX.Element {
  const { project } = useCanvasStore()

  const [token,        setToken]        = useState(() => localStorage.getItem('figma_token') || '')
  const [showToken,    setShowToken]    = useState(false)
  const [fileUrl,      setFileUrl]      = useState('')
  const [phase,        setPhase]        = useState<Phase>('idle')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [frames,       setFrames]       = useState<FrameEntry[]>([])
  const [loadedFile,   setLoadedFile]   = useState<FigmaFile | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [importTheme,  setImportTheme]  = useState(true)
  const [report,       setReport]       = useState<FidelityReport | null>(null)
  const [log,          setLog]          = useState<string[]>([])

  const logEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev, msg])
  }, [])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // Persist token
  useEffect(() => {
    if (token) localStorage.setItem('figma_token', token)
  }, [token])

  // ── Phase 1: Load frame list ────────────────────────────────
  const handleLoadFrames = useCallback(async () => {
    setErrorMsg(''); setLog([]); setReport(null); setFrames([]); setLoadedFile(null)

    const key = parseFileKey(fileUrl.trim())
    if (!key)         { setErrorMsg('Invalid Figma URL — paste the full file URL from your browser.'); return }
    if (!token.trim()) { setErrorMsg('Personal Access Token is required.'); return }
    if (!project)      { setErrorMsg('Open a project first before importing.'); return }

    setPhase('loading_frames')
    addLog('Connecting to Figma API...')

    try {
      const { file, frames: found } = await fetchFrameList(key, token)
      if (found.length === 0) throw new Error('No frames found. Make sure your Figma file has top-level frames.')

      addLog(`✓ Connected: "${file.name}"`)
      addLog(`Found ${found.length} frame${found.length !== 1 ? 's' : ''} across ${
        [...new Set(found.map(f => f.page))].length
      } page${[...new Set(found.map(f => f.page))].length !== 1 ? 's' : ''}`)

      setLoadedFile(file)
      setFrames(found)
      setPhase('selecting')
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to connect to Figma')
      setPhase('error')
    }
  }, [token, fileUrl, project, addLog])

  // ── Phase 2–5: Import selected frames ───────────────────────
  const handleImport = useCallback(async () => {
    const key = parseFileKey(fileUrl.trim())
    if (!key || !project || !loadedFile) return

    const selected = frames.filter(f => f.selected)
    if (selected.length === 0) { setErrorMsg('Select at least one frame to import.'); return }

    setImporting(true); setPhase('importing'); setErrorMsg('')
    addLog(`Fetching full node data for ${selected.length} frame${selected.length !== 1 ? 's' : ''}...`)

    try {
      // ── Phase 1 continued: fetch full file ──────────────────
      const fullFile = await fetchFullFrames(key, token, selected.map(f => f.id))
      const selectedIds = new Set(selected.map(f => f.id))
      const frameNodes = findFrameNodes(fullFile, selectedIds)

      if (frameNodes.length === 0) throw new Error(
        `Could not locate ${selected.length} selected frame(s) in the file. ` +
        `This can happen if frames are inside SECTION nodes. ` +
        `Try selecting all frames from the list and reimporting.`
      )

      addLog(`✓ Fetched ${frameNodes.length} frame${frameNodes.length !== 1 ? 's' : ''}`)
      addLog(`Total nodes in file will be parsed recursively...`)

      // ── Phase 4: theme extraction ────────────────────────────
      const warnings: string[] = []
      let theme = null

      if (importTheme) {
        addLog('Extracting color palette and fonts...')
        theme = extractTheme(frameNodes)
        injectTheme(theme)
        addLog(`✓ Theme: primary ${theme.primaryColor} · bg ${theme.backgroundColor} (${theme.brightness})`)
        if (theme.fontFamily) addLog(`✓ Font detected: ${theme.fontFamily}`)
      }

      // ── Phase 2+3: parse + map each frame ───────────────────
      addLog('Mapping Figma nodes → Flutter widgets...')
      setPhase('importing')

      const injected = []
      const allWidgetMaps: WidgetMap[] = []

      for (const frame of frameNodes) {
        const screenName = toScreenName(frame.name)
        const route      = toRoute(screenName)
        addLog(`  Mapping "${frame.name}" → ${screenName}`)

        // Phase 2+3: mapNode for all children
        const widgetMap: WidgetMap = {}
        const childIds = mapChildren(frame.children, widgetMap, 0)

        if (Object.keys(widgetMap).length > 600) {
          warnings.push(`"${frame.name}" is very complex (${Object.keys(widgetMap).length} nodes) — some deep layers may be simplified.`)
        }

        // Phase 4: resolve (AppBar lift, BottomNav lift, Scaffold build)
        const resolved = resolveScreen(frame, childIds, widgetMap)

        // Phase 5: inject into store
        const result = injectScreen(screenName, route, resolved)
        injected.push(result)
        allWidgetMaps.push(resolved.widgets)

        addLog(`  ✓ ${screenName} — ${Object.keys(resolved.widgets).length} widgets (${childIds.length} top-level children)`)
      }

      // Build fidelity report
      const rep = buildFidelityReport(injected, allWidgetMaps, theme, warnings)
      setReport(rep)
      addLog(`Done! ${rep.screensImported} screen${rep.screensImported !== 1 ? 's' : ''}, ${rep.widgetsTotal} widgets total.`)
      setPhase('done')

    } catch (e: any) {
      setErrorMsg(e.message || 'Import failed')
      setPhase('error')
      addLog(`✗ ${e.message || 'Import failed'}`)
    } finally {
      setImporting(false)
    }
  }, [token, fileUrl, project, loadedFile, frames, importTheme, addLog])

  const toggleFrame   = (id: string) => setFrames(prev => prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f))
  const toggleAll     = (v: boolean) => setFrames(prev => prev.map(f => ({ ...f, selected: v })))
  const selectedCount = frames.filter(f => f.selected).length

  const reset = () => {
    setPhase('idle'); setErrorMsg(''); setLog([]); setReport(null)
    setFrames([]); setLoadedFile(null)
  }

  const isStep1Done = !!token.trim()
  const isStep2Done = !!fileUrl.trim()
  const isStep3Done = frames.length > 0
  const isStep4Done = phase === 'done'

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', background: '#0d0d1a', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Left panel — config ─────────────────────────────── */}
      <div style={{ width: 360, flexShrink: 0, borderRight: '1px solid #1a1a2e', overflowY: 'auto', padding: '20px 20px 80px' }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e0d7ff', marginBottom: 4 }}>Figma Import</div>
          <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6 }}>
            Import Figma frames as canvas screens. Layout, colors, and fonts are auto-mapped to Flutter widgets.
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <StepDot num={1} label="Paste your Figma Personal Access Token" done={isStep1Done} active={!isStep1Done} />
          <StepDot num={2} label="Paste the Figma file URL"               done={isStep2Done} active={isStep1Done && !isStep2Done} />
          <StepDot num={3} label="Load frames and choose which to import" done={isStep3Done} active={isStep1Done && isStep2Done && !isStep3Done} />
          <StepDot num={4} label="Click Import"                           done={isStep4Done} active={isStep3Done && !isStep4Done} />
        </div>

        {/* Token */}
        <Section title="Personal Access Token" color="#4a9edd">
          <div style={{ fontSize: 11, color: '#444', marginBottom: 8, lineHeight: 1.5 }}>
            Figma → Account → Settings → Personal access tokens → Generate new token (needs File Content read access).
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="figd_xxxxxxxxxxxx"
              style={inp}
            />
            <button
              onClick={() => setShowToken(s => !s)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11 }}>
              {showToken ? 'hide' : 'show'}
            </button>
          </div>
          {token && <div style={{ fontSize: 10, color: '#4caf7d', marginTop: 4 }}>✓ Token saved</div>}
        </Section>

        {/* File URL */}
        <Section title="Figma File URL" color="#9d7fe8">
          <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>
            Paste the full URL — e.g. https://www.figma.com/design/ABC123/My-App
          </div>
          <input
            type="text"
            value={fileUrl}
            onChange={e => setFileUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoadFrames()}
            placeholder="https://www.figma.com/file/..."
            style={inp}
          />
        </Section>

        {/* Options */}
        <Section title="Options" color="#4caf7d">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div onClick={() => setImportTheme(v => !v)} style={{
              width: 36, height: 20, borderRadius: 10, flexShrink: 0,
              background: importTheme ? '#1a3a1a' : '#1a1a2e',
              border: `1px solid ${importTheme ? '#4caf7d' : '#2a2a3a'}`,
              display: 'flex', alignItems: 'center', padding: '0 3px',
              justifyContent: importTheme ? 'flex-end' : 'flex-start',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: importTheme ? '#4caf7d' : '#444' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#d4d4d4' }}>Extract colors + fonts → Theme Editor</div>
              <div style={{ fontSize: 10, color: '#444' }}>Sets Primary, Background, Surface, brightness, font</div>
            </div>
          </label>
        </Section>

        {/* Load frames button */}
        {!loadedFile && (
          <button
            onClick={handleLoadFrames}
            disabled={!token.trim() || !fileUrl.trim() || phase === 'loading_frames'}
            style={{
              width: '100%', padding: '11px 0', marginBottom: 8,
              background: (!token.trim() || !fileUrl.trim()) ? '#0a0a14' : '#1e1a33',
              border: `1px solid ${(!token.trim() || !fileUrl.trim()) ? '#1a1a2e' : '#7c5cbf'}`,
              borderRadius: 10, cursor: (!token.trim() || !fileUrl.trim()) ? 'not-allowed' : 'pointer',
              color: (!token.trim() || !fileUrl.trim()) ? '#333' : '#c8a8ff',
              fontSize: 13, fontWeight: 600,
            }}>
            {phase === 'loading_frames' ? '◌ Loading...' : '↓ Load Frames from Figma'}
          </button>
        )}

        {/* Frame selector */}
        {frames.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9d7fe8', letterSpacing: '0.06em' }}>
                FRAMES — {loadedFile?.name}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggleAll(true)}  style={sBtn}>All</button>
                <button onClick={() => toggleAll(false)} style={sBtn}>None</button>
              </div>
            </div>

            {/* Group by page */}
            {[...new Set(frames.map(f => f.page))].map(page => (
              <div key={page} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.05em', marginBottom: 4, paddingLeft: 2 }}>
                  {page}
                </div>
                <div style={{ border: '1px solid #1a1a2e', borderRadius: 8, overflow: 'hidden' }}>
                  {frames.filter(f => f.page === page).map((f, i, arr) => (
                    <div key={f.id} onClick={() => toggleFrame(f.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', cursor: 'pointer',
                      background: f.selected ? '#0f0f1e' : 'transparent',
                      borderBottom: i < arr.length - 1 ? '1px solid #1a1a2e' : 'none',
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        background: f.selected ? '#7c5cbf' : 'transparent',
                        border: `1px solid ${f.selected ? '#7c5cbf' : '#2a2a3a'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#fff',
                      }}>
                        {f.selected ? '✓' : ''}
                      </div>
                      <span style={{
                        fontSize: 12, color: f.selected ? '#e0d7ff' : '#555',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              style={{
                width: '100%', marginTop: 4, padding: '11px 0',
                background: (selectedCount === 0 || importing) ? '#0a0a14' : '#1a3a1a',
                border: `1px solid ${(selectedCount === 0 || importing) ? '#1a1a2e' : '#4caf7d'}`,
                borderRadius: 10,
                color: (selectedCount === 0 || importing) ? '#333' : '#4caf7d',
                cursor: (selectedCount === 0 || importing) ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600,
              }}>
              {importing ? '◌ Importing...' : `↑ Import ${selectedCount} Screen${selectedCount !== 1 ? 's' : ''}`}
            </button>

            <button onClick={reset} style={{ width: '100%', marginTop: 6, padding: '7px 0',
              background: 'transparent', border: '1px solid #1a1a2e', borderRadius: 8,
              color: '#444', cursor: 'pointer', fontSize: 11 }}>
              ✕ Start over
            </button>
          </div>
        )}

        {errorMsg && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#180808',
            border: '1px solid #5c1a1a', borderRadius: 8, fontSize: 12, color: '#e05252', lineHeight: 1.6 }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── Right panel — log + results ──────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {phase === 'done' && report ? (
          /* Success view */
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            <div style={{ padding: '14px 18px', background: '#0a1a0f', border: '1px solid #1a5c2e',
              borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>✓</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#4caf7d' }}>Import complete</div>
                <div style={{ fontSize: 12, color: '#2a7a4a' }}>
                  {report.screensImported} screen{report.screensImported !== 1 ? 's' : ''} added — switch to Canvas tab to inspect
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Screens',  value: report.screensImported },
                { label: 'Widgets',  value: report.widgetsTotal },
                { label: 'Theme',    value: report.themeUpdated ? 'Updated' : 'Skipped' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#0a0a14', border: '1px solid #1a1a2e', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e0d7ff' }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Widget breakdown */}
            <div style={{ border: '1px solid #1a1a2e', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '8px 14px', background: '#0a0a14', borderBottom: '1px solid #1a1a2e',
                fontSize: 11, fontWeight: 700, color: '#9d7fe8', letterSpacing: '0.06em' }}>
                WIDGET BREAKDOWN
              </div>
              <div style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(report.widgetBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} style={{ padding: '3px 10px', background: '#0f0f1e', border: '1px solid #1a1a2e',
                      borderRadius: 20, fontSize: 11, color: '#777' }}>
                      {type} <span style={{ color: '#9d7fe8', fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Figma → Flutter mapping applied */}
            <div style={{ border: '1px solid #1a1a2e', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '8px 14px', background: '#0a0a14', borderBottom: '1px solid #1a1a2e',
                fontSize: 11, fontWeight: 700, color: '#4a9edd', letterSpacing: '0.06em' }}>
                FIGMA → FLUTTER MAPPING
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  ['FRAME (top-level)', 'Screen + Scaffold'],
                  ['AUTO-LAYOUT VERTICAL', 'Column (+ SizedBox gaps)'],
                  ['AUTO-LAYOUT HORIZONTAL', 'Row (+ SizedBox gaps)'],
                  ['No auto-layout, children overlap', 'Stack'],
                  ['No auto-layout, children ordered', 'Column or Row (inferred)'],
                  ['Header frame / named "appbar"', 'AppBar (lifted to Scaffold.appBar)'],
                  ['Bottom nav frame', 'BottomNavigationBar (lifted)'],
                  ['TEXT node', 'Text (font, size, weight, color, align)'],
                  ['Named "btn" / "button"', 'ElevatedButton'],
                  ['Named "input" / "field"', 'TextField'],
                  ['ELLIPSE / named "avatar"', 'CircleAvatar'],
                  ['VECTOR / BOOLEAN_OP', 'Icon (name inferred from layer name)'],
                  ['Image fill', 'Image (placeholder URL)'],
                  ['Thin rect (≤3px)', 'Divider'],
                  ['DROP_SHADOW effect', 'Card with elevation'],
                ].map(([from, to]) => (
                  <div key={from} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
                    <span style={{ color: '#4a9edd', fontFamily: 'monospace', minWidth: 240, flexShrink: 0 }}>{from}</span>
                    <span style={{ color: '#888' }}>→</span>
                    <span style={{ color: '#d4d4d4' }}>{to}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Font + Theme info */}
            {report.fontDetected && (
              <div style={{ padding: '10px 14px', background: '#0a0a14', border: '1px solid #1a1a2e',
                borderRadius: 8, fontSize: 12, color: '#9d7fe8', marginBottom: 12 }}>
                Font detected: <strong>{report.fontDetected}</strong> — applied to Theme Editor typography
              </div>
            )}

            {/* Warnings */}
            {report.warnings.length > 0 && (
              <div style={{ padding: '10px 14px', background: '#1a1400', border: '1px solid #5c4200',
                borderRadius: 8, fontSize: 12, color: '#c9a227', lineHeight: 1.7, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Notes</div>
                {report.warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

            {/* Next steps */}
            <div style={{ border: '1px solid #1a1a2e', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: '#0a0a14', borderBottom: '1px solid #1a1a2e',
                fontSize: 11, fontWeight: 700, color: '#c9a227', letterSpacing: '0.06em' }}>
                NEXT STEPS
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Canvas',     'Review imported screens — click widgets to inspect and edit props'],
                  ['Properties', 'Update placeholder image URLs to real asset paths'],
                  ['Theme',      report.themeUpdated ? 'Colors extracted — review and fine-tune palette' : 'Set your theme manually in the Theme Editor'],
                  ['Preview',    'Check screens on iPhone 15 and Web frames'],
                  ['Build',      'Project → Config → Build to generate an APK'],
                ].map(([tab, desc]) => (
                  <div key={tab} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, background: '#1e1a33', border: '1px solid #3d3060',
                      borderRadius: 4, padding: '2px 7px', color: '#9d7fe8', flexShrink: 0, fontWeight: 700 }}>
                      {tab}
                    </span>
                    <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : (
          /* Log view */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {log.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', gap: 14 }}>
                  <div style={{ fontSize: 48, opacity: 0.2 }}>⬡</div>
                  <div style={{ fontSize: 14, color: '#333' }}>No import running yet</div>
                  <div style={{ fontSize: 12, color: '#2a2a3a', textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
                    Enter your token and Figma URL, load frames, then click Import
                  </div>
                </div>
              ) : (
                <>
                  {log.map((line, i) => <LogLine key={i} line={line} />)}
                  {importing && (
                    <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>◌ Working...</div>
                  )}
                  <div ref={logEndRef} />
                </>
              )}
            </div>

            {/* Token how-to guide (shown before first log line) */}
            {log.length === 0 && (
              <div style={{ padding: 16, borderTop: '1px solid #1a1a2e', background: '#0a0a14' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4a9edd', letterSpacing: '0.06em', marginBottom: 10 }}>
                  HOW TO GET A FIGMA PERSONAL ACCESS TOKEN
                </div>
                {[
                  '1. Open Figma in your browser',
                  '2. Click your profile picture → Settings',
                  '3. Scroll to "Personal access tokens"',
                  '4. Click "Generate new token" → name it (e.g. Appzillon IDE)',
                  '5. Copy and paste it into the field on the left',
                ].map((line, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#444', marginBottom: 3 }}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
