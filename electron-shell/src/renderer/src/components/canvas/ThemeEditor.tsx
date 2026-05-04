import React, { useState, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import type { AppTheme, FlutterColor } from '../../types/widget.schema'
import { DEFAULT_THEME } from '../../types/widget.schema'

// ─────────────────────────────────────────────────────────────────────────────
// PRESET THEMES
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS: { name: string; emoji: string; theme: Partial<AppTheme> }[] = [
  {
    name: 'Material Default', emoji: '🔵',
    theme: { primaryColor:{hex:'#6200EA'}, secondaryColor:{hex:'#03DAC6'}, errorColor:{hex:'#B00020'}, backgroundColor:{hex:'#FFFBFE'}, surfaceColor:{hex:'#FFFBFE'}, fontFamily:'Roboto', brightness:'system' },
  },
  {
    name: 'Ocean Blue', emoji: '🌊',
    theme: { primaryColor:{hex:'#1E6BFF'}, secondaryColor:{hex:'#00D4AA'}, errorColor:{hex:'#FF5252'}, backgroundColor:{hex:'#060E1A'}, surfaceColor:{hex:'#0D1B2A'}, onBackgroundColor:{hex:'#E8F0FF'}, onSurfaceColor:{hex:'#E8F0FF'}, brightness:'dark' },
  },
  {
    name: 'Forest Green', emoji: '🌿',
    theme: { primaryColor:{hex:'#2E7D32'}, secondaryColor:{hex:'#FF8F00'}, errorColor:{hex:'#C62828'}, backgroundColor:{hex:'#F1F8E9'}, surfaceColor:{hex:'#FFFFFF'}, fontFamily:'Poppins', brightness:'light' },
  },
  {
    name: 'Sunset Orange', emoji: '🌅',
    theme: { primaryColor:{hex:'#E65100'}, secondaryColor:{hex:'#7B1FA2'}, errorColor:{hex:'#B71C1C'}, backgroundColor:{hex:'#FFF8F0'}, surfaceColor:{hex:'#FFFFFF'}, fontFamily:'Inter', brightness:'light' },
  },
  {
    name: 'Banking Dark', emoji: '🏦',
    theme: { primaryColor:{hex:'#1565C0'}, secondaryColor:{hex:'#00897B'}, errorColor:{hex:'#D32F2F'}, backgroundColor:{hex:'#0A0F1E'}, surfaceColor:{hex:'#0D1B2A'}, onBackgroundColor:{hex:'#FFFFFF'}, onSurfaceColor:{hex:'#E3F2FD'}, fontFamily:'Inter', brightness:'dark' },
  },
  {
    name: 'Rose Pink', emoji: '🌸',
    theme: { primaryColor:{hex:'#E91E63'}, secondaryColor:{hex:'#9C27B0'}, errorColor:{hex:'#F44336'}, backgroundColor:{hex:'#FFF0F5'}, surfaceColor:{hex:'#FFFFFF'}, fontFamily:'Nunito', brightness:'light' },
  },
]

const GOOGLE_FONTS = [
  'Roboto','Inter','Poppins','Nunito','Lato','Montserrat','Open Sans',
  'Raleway','Ubuntu','Merriweather','Playfair Display','Source Sans Pro',
  'Noto Sans','Work Sans','DM Sans','Plus Jakarta Sans','Outfit',
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hex(c: FlutterColor | undefined, fallback = '#888888'): string {
  return c?.hex || fallback
}

function contrastColor(bg: string): string {
  const r = parseInt(bg.slice(1,3),16), g = parseInt(bg.slice(3,5),16), b = parseInt(bg.slice(5,7),16)
  return (0.299*r + 0.587*g + 0.114*b) > 128 ? '#000000' : '#FFFFFF'
}

function adjustBrightness(hexColor: string, amount: number): string {
  try {
    const r = Math.min(255,Math.max(0,parseInt(hexColor.slice(1,3),16)+amount))
    const g = Math.min(255,Math.max(0,parseInt(hexColor.slice(3,5),16)+amount))
    const b = Math.min(255,Math.max(0,parseInt(hexColor.slice(5,7),16)+amount))
    return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')
  } catch { return hexColor }
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR SWATCH — single color slot with picker
// ─────────────────────────────────────────────────────────────────────────────

function ColorSwatch({ label, value, onChange, hint }: {
  label: string; value: FlutterColor; onChange: (c: FlutterColor) => void; hint?: string
}) {
  const bg = hex(value)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
      <label style={{ position:'relative', cursor:'pointer', flexShrink:0 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:bg,
          border:'2px solid rgba(255,255,255,0.1)', boxShadow:'0 2px 8px rgba(0,0,0,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:10, color:contrastColor(bg), fontWeight:700 }}>
          {bg.toUpperCase().replace('#','#').slice(0,4)}
        </div>
        <input type="color" value={bg} onChange={e => onChange({ hex: e.target.value })}
          style={{ position:'absolute', opacity:0, width:'100%', height:'100%', top:0, left:0, cursor:'pointer' }}/>
      </label>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'#d4d4d4' }}>{label}</div>
        {hint && <div style={{ fontSize:10, color:'#555', marginTop:1 }}>{hint}</div>}
        <div style={{ fontSize:10, color:'#666', fontFamily:'monospace', marginTop:1 }}>{bg.toUpperCase()}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, color, children, defaultOpen = true }: {
  title: string; color: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border:'1px solid #1e2d3d', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
      <div onClick={() => setOpen(!open)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', background:'#0a0a14', cursor:'pointer',
        borderBottom: open ? '1px solid #1e2d3d' : 'none' }}>
        <span style={{ fontSize:11, fontWeight:700, color, letterSpacing:'0.07em', textTransform:'uppercase' as const }}>{title}</span>
        <span style={{ fontSize:12, color:'#555' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding:16 }}>{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDER ROW
// ─────────────────────────────────────────────────────────────────────────────

function SliderRow({ label, value, min, max, step=1, unit='', onChange }: {
  label:string; value:number; min:number; max:number; step?:number; unit?:string; onChange:(v:number)=>void
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
      <span style={{ fontSize:12, color:'#8892A4', width:160, flexShrink:0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex:1, accentColor:'#1E6BFF' }}/>
      <span style={{ fontSize:11, color:'#4a9edd', fontFamily:'monospace', width:48, textAlign:'right' as const }}>
        {value}{unit}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE MINI PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

function MiniPreview({ theme }: { theme: AppTheme }) {
  const primary    = hex(theme.primaryColor,    '#6200EA')
  const secondary  = hex(theme.secondaryColor,  '#03DAC6')
  const surface    = hex(theme.surfaceColor,    '#FFFBFE')
  const background = hex(theme.backgroundColor, '#FFFBFE')
  const onBg       = hex(theme.onBackgroundColor,'#1C1B1F')
  const onSurface  = hex(theme.onSurfaceColor,  '#1C1B1F')
  const onPrimary  = hex(theme.onPrimaryColor,  '#FFFFFF')
  const error      = hex(theme.errorColor,      '#B00020')
  const br         = theme.borderRadiusMedium ?? 12
  const brLarge    = theme.borderRadiusLarge   ?? 28
  const ff         = theme.fontFamily || 'Roboto'
  const isDark     = theme.brightness === 'dark' || background.toLowerCase() < '#888888'

  return (
    <div style={{ border:'1px solid #1e2d3d', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      <div style={{ padding:'8px 14px', background:'#0a0a14', borderBottom:'1px solid #1e2d3d',
        fontSize:11, fontWeight:700, color:'#9d7fe8', letterSpacing:'0.07em', textTransform:'uppercase' as const }}>
        Live Preview
      </div>

      {/* Simulated phone screen */}
      <div style={{ background: background, padding:16, fontFamily:ff }}>

        {/* AppBar */}
        <div style={{ background:primary, padding:'12px 16px', borderRadius:`${br}px ${br}px 0 0`,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:12, boxShadow: theme.appBarElevation ? `0 ${theme.appBarElevation*2}px 8px rgba(0,0,0,0.3)` : 'none' }}>
          <span style={{ color:onPrimary, fontSize:16, fontWeight:theme.fontWeightBold??700 }}>My App</span>
          <div style={{ width:28, height:28, borderRadius:'50%', background:`${onPrimary}22`,
            display:'flex', alignItems:'center', justifyContent:'center', color:onPrimary, fontSize:14 }}>☰</div>
        </div>

        {/* Card */}
        <div style={{ background:surface, borderRadius:br, padding:14, marginBottom:12,
          boxShadow:`0 ${theme.cardElevation??2}px ${(theme.cardElevation??2)*3}px rgba(0,0,0,0.15)` }}>
          <div style={{ fontSize:theme.titleFontSize??22, fontWeight:theme.fontWeightBold??700,
            color:onSurface, marginBottom:4 }}>Welcome back</div>
          <div style={{ fontSize:theme.bodyFontSize??14, color:onSurface, opacity:0.7 }}>
            Your balance is up 12% this month
          </div>
        </div>

        {/* Input field */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:theme.labelFontSize??12, color:primary, fontWeight:600, marginBottom:4 }}>
            Email address
          </div>
          <div style={{ border: theme.inputBorderStyle==='underline'
              ? `none` : `1.5px solid ${primary}`,
            borderBottom: `1.5px solid ${primary}`,
            borderRadius: theme.inputBorderStyle==='underline' ? 0 : br/2,
            padding:'10px 14px', background: theme.inputBorderStyle==='filled' ? `${primary}11` : surface,
            fontSize:theme.bodyFontSize??14, color:onSurface, opacity:0.6 }}>
            you@example.com
          </div>
        </div>

        {/* Buttons row */}
        <div style={{ display:'flex', gap:10, marginBottom:12 }}>
          <div style={{ flex:1, background:primary, color:onPrimary,
            borderRadius:theme.borderRadiusFull??50, height:theme.buttonHeight??48,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:theme.labelFontSize??12, fontWeight:theme.fontWeightBold??700 }}>
            Get Started
          </div>
          <div style={{ flex:1, border:`1.5px solid ${primary}`, color:primary,
            borderRadius:theme.borderRadiusFull??50, height:theme.buttonHeight??48,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:theme.labelFontSize??12, fontWeight:600, background:'transparent' }}>
            Learn More
          </div>
        </div>

        {/* Color chips row */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
          {[
            { label:'Primary',   bg:primary,   fg:onPrimary },
            { label:'Secondary', bg:secondary, fg:contrastColor(secondary) },
            { label:'Error',     bg:error,     fg:'#FFFFFF' },
          ].map(chip => (
            <div key={chip.label} style={{ padding:'4px 12px', borderRadius:theme.borderRadiusSmall??8,
              background:chip.bg, color:chip.fg,
              fontSize:theme.labelFontSize??12, fontWeight:500 }}>
              {chip.label}
            </div>
          ))}
          <div style={{ padding:'4px 12px', borderRadius:theme.borderRadiusSmall??8,
            background:'transparent', border:`1px solid ${isDark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.2)'}`,
            color:onBg, fontSize:theme.labelFontSize??12 }}>
            Outline
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATED DART PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

function DartPreview({ theme }: { theme: AppTheme }) {
  const [open, setOpen] = useState(false)
  const primary   = hex(theme.primaryColor,   '#6200EA').replace('#','')
  const secondary = hex(theme.secondaryColor, '#03DAC6').replace('#','')
  const tertiary  = hex(theme.tertiaryColor,  '#EFB8C8').replace('#','')
  const error     = hex(theme.errorColor,     '#B00020').replace('#','')
  const ff        = theme.fontFamily || 'Roboto'
  const brM       = theme.borderRadiusMedium ?? 12
  const brL       = theme.borderRadiusLarge  ?? 28
  const brF       = theme.borderRadiusFull   ?? 50
  const bh        = theme.buttonHeight       ?? 48

  const code = `import 'package:flutter/material.dart';
${ff !== 'Roboto' ? `import 'package:google_fonts/google_fonts.dart';` : ''}

// ── AUTO-GENERATED by Appzillon-New IDE Theme Editor ──
abstract class AppTheme {
  static const Color _primary   = Color(0xFF${primary});
  static const Color _secondary = Color(0xFF${secondary});
  static const Color _tertiary  = Color(0xFF${tertiary});
  static const Color _error     = Color(0xFF${error});

  static ThemeData get lightTheme => ThemeData(
    useMaterial3: ${theme.useMaterial3},
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primary,
      secondary: _secondary,
      tertiary:  _tertiary,
      error:     _error,
      brightness: Brightness.light,
    ),
    ${ff !== 'Roboto' ? `textTheme: GoogleFonts.${ff.replace(' ','').toLowerCase()}TextTheme(),` : ''}
    cardTheme: CardTheme(
      elevation: ${theme.cardElevation ?? 2},
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(${brM})),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(double.infinity, ${bh}),
        shape: StadiumBorder(),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: ${theme.inputBorderStyle === 'underline'
        ? 'UnderlineInputBorder()'
        : `OutlineInputBorder(borderRadius: BorderRadius.circular(${brM/2}))`},
      filled: ${theme.inputBorderStyle === 'filled'},
    ),
    dialogTheme: DialogTheme(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(${brL})),
    ),
  );

  static ThemeData get darkTheme => ThemeData(
    useMaterial3: ${theme.useMaterial3},
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primary,
      secondary: _secondary,
      brightness: Brightness.dark,
    ),
    ${ff !== 'Roboto' ? `textTheme: GoogleFonts.${ff.replace(' ','').toLowerCase()}TextTheme(),` : ''}
  );

  static ThemeMode get themeMode => ${
    theme.brightness === 'light' ? 'ThemeMode.light'
    : theme.brightness === 'dark' ? 'ThemeMode.dark'
    : 'ThemeMode.system'};
}`

  return (
    <div style={{ border:'1px solid #1e2d3d', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      <div onClick={() => setOpen(!open)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', background:'#0a0a14', cursor:'pointer' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#4caf7d', letterSpacing:'0.07em', textTransform:'uppercase' as const }}>
          Generated app_theme.dart
        </span>
        <span style={{ fontSize:11, color:'#555' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </div>
      {open && (
        <div style={{ position:'relative' }}>
          <button onClick={() => navigator.clipboard?.writeText(code)}
            style={{ position:'absolute', top:8, right:8, padding:'3px 10px',
              background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:6,
              color:'#8892A4', fontSize:10, cursor:'pointer', fontFamily:'system-ui,sans-serif', zIndex:1 }}>
            Copy
          </button>
          <pre style={{ background:'#030810', padding:'14px 16px', margin:0, overflowX:'auto' as const,
            fontFamily:'monospace', fontSize:11, lineHeight:1.8, color:'#c9d1d9',
            maxHeight:320, overflowY:'auto' as const }}>
            {code}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// .AZTHEME FILE FORMAT
// A portable theme bundle — just the AppTheme JSON + metadata wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface AzThemeFile {
  _format:     'appzillon-theme'
  _version:    1
  name:        string
  exportedAt:  string
  exportedFrom: string   // project name
  theme:       AppTheme
}

export default function ThemeEditor(): JSX.Element {
  const { project, updateTheme } = useCanvasStore()
  const theme: AppTheme = project?.theme as AppTheme || DEFAULT_THEME

  const upd = useCallback((patch: Partial<AppTheme>) => updateTheme(patch), [updateTheme])

  const [toastMsg, setToastMsg]   = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg); setToastType(type)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // ── EXPORT: save current theme as .aztheme file ───────────────────────────
  const handleExport = useCallback(async () => {
    try {
      // @ts-ignore
      const dir: string | null = await window.flutterForge?.fs?.chooseOutputDir()
      if (!dir) return

      const themeName = project?.name ? `${project.name}-theme` : 'my-theme'
      const fileName  = themeName.toLowerCase().replace(/\s+/g, '-') + '.aztheme'
      const filePath  = dir + '/' + fileName

      const payload: AzThemeFile = {
        _format:      'appzillon-theme',
        _version:     1,
        name:         themeName,
        exportedAt:   new Date().toISOString(),
        exportedFrom: project?.name || 'Unknown project',
        theme,
      }

      // @ts-ignore
      await window.flutterForge?.fs?.writeFile(filePath, JSON.stringify(payload, null, 2))
      toast(`✓ Theme exported as ${fileName}`)
    } catch (e: any) {
      toast('Export failed: ' + (e?.message || 'unknown error'), 'error')
    }
  }, [theme, project])

  // ── IMPORT: load a .aztheme file and apply to current project ─────────────
  const handleImport = useCallback(async () => {
    try {
      // @ts-ignore
      const dir: string | null = await window.flutterForge?.fs?.chooseOutputDir()
      if (!dir) return

      // Show a file picker by reading a known filename — use a text input approach
      // Since we only have chooseOutputDir, we use a hidden input trick via the DOM
      const input = document.createElement('input')
      input.type   = 'file'
      input.accept = '.aztheme,.json'
      input.style.display = 'none'
      document.body.appendChild(input)

      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { document.body.removeChild(input); return }

        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const raw      = ev.target?.result as string
            const parsed   = JSON.parse(raw) as AzThemeFile

            if (parsed._format !== 'appzillon-theme') {
              toast('Not a valid .aztheme file', 'error'); return
            }
            if (!parsed.theme || typeof parsed.theme !== 'object') {
              toast('Theme data missing in file', 'error'); return
            }

            // Apply the imported theme to the current project
            updateTheme(parsed.theme)
            toast(`✓ Theme "${parsed.name}" applied from ${parsed.exportedFrom}`)
          } catch {
            toast('Could not parse theme file — invalid JSON', 'error')
          }
          document.body.removeChild(input)
        }
        reader.readAsText(file)
      }

      input.click()
    } catch (e: any) {
      toast('Import failed: ' + (e?.message || 'unknown error'), 'error')
    }
  }, [updateTheme])

  // ── COPY TO CLIPBOARD (as JSON, for pasting into other tools) ────────────
  const handleCopyJson = useCallback(() => {
    const payload: AzThemeFile = {
      _format: 'appzillon-theme', _version: 1,
      name: project?.name ? `${project.name}-theme` : 'my-theme',
      exportedAt: new Date().toISOString(),
      exportedFrom: project?.name || '',
      theme,
    }
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2))
      .then(() => toast('✓ Theme JSON copied to clipboard'))
      .catch(() => toast('Clipboard write failed', 'error'))
  }, [theme, project])

  if (!project) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'100%', color:'#444', gap:12 }}>
        <div style={{ fontSize:32 }}>🎨</div>
        <div style={{ fontSize:14 }}>Open a project to edit its theme</div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', height:'100%', background:'#0d0d1a', overflow:'hidden', position:'relative' as const }}>

      {/* ── Toast notification ── */}
      {toastMsg && (
        <div style={{
          position:'absolute' as const, top:12, left:'50%', transform:'translateX(-50%)',
          background: toastType === 'success' ? '#0a1a0f' : '#1a0a0a',
          border: `1px solid ${toastType === 'success' ? '#1a5c2e' : '#5c1a1a'}`,
          borderRadius:10, padding:'8px 18px', fontSize:12, zIndex:999,
          color: toastType === 'success' ? '#4caf7d' : '#e05252',
          whiteSpace:'nowrap' as const, pointerEvents:'none' as const,
          boxShadow:'0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {toastMsg}
        </div>
      )}

      {/* ── Left: editor ── */}
      <div style={{ flex:1, overflowY:'auto' as const, padding:20, minWidth:0 }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#e0d7ff' }}>Theme Editor</div>
            {/* ── Export / Import toolbar ── */}
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={handleImport} title="Import a .aztheme file from another project" style={themeBtn('#1e3a5f','#4a9edd')}>
                ↑ Import .aztheme
              </button>
              <button onClick={handleExport} title="Export this theme as a .aztheme file to share or reuse" style={themeBtn('#1a3a1a','#4caf7d')}>
                ↓ Export .aztheme
              </button>
              <button onClick={handleCopyJson} title="Copy theme as JSON to clipboard" style={themeBtn('#1e1a33','#9d7fe8')}>
                ⎘ Copy JSON
              </button>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#555' }}>
            Changes apply to the canvas immediately and are saved with your project.
            Export as <span style={{ color:'#4a9edd', fontFamily:'monospace' }}>.aztheme</span> to reuse across projects.
          </div>
        </div>

        {/* ── PRESET THEMES ── */}
        <Section title="Preset themes" color="#c9a227" defaultOpen={true}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => upd(p.theme)} style={{
                padding:'10px 8px', background:'#0a0a14', border:'1px solid #1e2d3d',
                borderRadius:10, cursor:'pointer', textAlign:'left' as const,
                display:'flex', alignItems:'center', gap:8, transition:'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor='#9d7fe8')}
              onMouseLeave={e => (e.currentTarget.style.borderColor='#1e2d3d')}>
                <div style={{ width:28, height:28, borderRadius:8, flexShrink:0,
                  background: p.theme.primaryColor?.hex || '#6200EA',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                  {p.emoji}
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#d4d4d4' }}>{p.name}</div>
                  <div style={{ fontSize:9, color:'#555', fontFamily:'monospace', marginTop:1 }}>
                    {p.theme.primaryColor?.hex || ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => upd(DEFAULT_THEME)} style={{
            marginTop:10, width:'100%', padding:'7px', background:'transparent',
            border:'1px dashed #2a2a3a', borderRadius:8, color:'#555',
            cursor:'pointer', fontSize:11, fontFamily:'system-ui,sans-serif' }}>
            ↺ Reset to Material 3 defaults
          </button>
        </Section>

        {/* ── COLORS ── */}
        <Section title="Color palette" color="#1E6BFF" defaultOpen={true}>
          <div style={{ fontSize:11, color:'#555', marginBottom:12 }}>
            Primary drives your brand. Secondary is for accents. On-colors are text/icons that sit on each surface.
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#8892A4', letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:8 }}>Brand</div>
              <ColorSwatch label="Primary"   value={theme.primaryColor   || {hex:'#6200EA'}} onChange={c => upd({primaryColor:c})}   hint="Main brand colour" />
              <ColorSwatch label="Secondary" value={theme.secondaryColor || {hex:'#03DAC6'}} onChange={c => upd({secondaryColor:c})} hint="Accent colour" />
              <ColorSwatch label="Tertiary"  value={theme.tertiaryColor  || {hex:'#EFB8C8'}} onChange={c => upd({tertiaryColor:c})}  hint="Extra accent" />
              <ColorSwatch label="Error"     value={theme.errorColor     || {hex:'#B00020'}} onChange={c => upd({errorColor:c})}     hint="Errors and warnings" />
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#8892A4', letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:8 }}>Surfaces</div>
              <ColorSwatch label="Background"  value={theme.backgroundColor  || {hex:'#FFFBFE'}} onChange={c => upd({backgroundColor:c})}  hint="App background" />
              <ColorSwatch label="Surface"     value={theme.surfaceColor     || {hex:'#FFFBFE'}} onChange={c => upd({surfaceColor:c})}     hint="Cards, sheets" />
              <ColorSwatch label="On Primary"  value={theme.onPrimaryColor   || {hex:'#FFFFFF'}} onChange={c => upd({onPrimaryColor:c})}   hint="Text on primary" />
              <ColorSwatch label="On Surface"  value={theme.onSurfaceColor   || {hex:'#1C1B1F'}} onChange={c => upd({onSurfaceColor:c})}   hint="Text on surface" />
              <ColorSwatch label="On Background" value={theme.onBackgroundColor || {hex:'#1C1B1F'}} onChange={c => upd({onBackgroundColor:c})} hint="Body text" />
            </div>
          </div>
        </Section>

        {/* ── TYPOGRAPHY ── */}
        <Section title="Typography" color="#9d7fe8" defaultOpen={true}>
          {/* Font family */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ fontSize:12, color:'#8892A4', width:160, flexShrink:0 }}>Font family</span>
            <select value={theme.fontFamily || 'Roboto'} onChange={e => upd({fontFamily:e.target.value})}
              style={{ flex:1, padding:'7px 10px', background:'#0a0a14', border:'1px solid #1e2d3d',
                borderRadius:8, fontSize:12, color:'#d4d4d4', outline:'none', cursor:'pointer',
                fontFamily:theme.fontFamily||'inherit' }}>
              {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily:f }}>{f}</option>)}
            </select>
            <div style={{ fontSize:13, color:'#d4d4d4', fontFamily:theme.fontFamily||'Roboto',
              padding:'4px 10px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:6 }}>
              Aa
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
            <div>
              <div style={{ fontSize:10, color:'#555', marginBottom:8 }}>Font sizes</div>
              <SliderRow label="Display" value={theme.displayFontSize??57}  min={40} max={80} unit="px" onChange={v=>upd({displayFontSize:v})}/>
              <SliderRow label="Headline" value={theme.headlineFontSize??32} min={24} max={56} unit="px" onChange={v=>upd({headlineFontSize:v})}/>
              <SliderRow label="Title"   value={theme.titleFontSize??22}    min={16} max={36} unit="px" onChange={v=>upd({titleFontSize:v})}/>
              <SliderRow label="Body"    value={theme.bodyFontSize??14}      min={12} max={20} unit="px" onChange={v=>upd({bodyFontSize:v})}/>
              <SliderRow label="Label"   value={theme.labelFontSize??12}     min={10} max={16} unit="px" onChange={v=>upd({labelFontSize:v})}/>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#555', marginBottom:8 }}>Font weights</div>
              <SliderRow label="Bold weight"   value={theme.fontWeightBold??700}   min={400} max={900} step={100} onChange={v=>upd({fontWeightBold:v})}/>
              <SliderRow label="Normal weight" value={theme.fontWeightNormal??400} min={300} max={500} step={100} onChange={v=>upd({fontWeightNormal:v})}/>
            </div>
          </div>

          {/* Type scale preview */}
          <div style={{ background:'#050510', borderRadius:8, padding:14, marginTop:8,
            fontFamily:theme.fontFamily||'Roboto' }}>
            <div style={{ fontSize:theme.displayFontSize??57,  fontWeight:theme.fontWeightBold??700,   color:hex(theme.primaryColor), lineHeight:1.1, marginBottom:4 }}>Display</div>
            <div style={{ fontSize:theme.headlineFontSize??32, fontWeight:theme.fontWeightBold??700,   color:'#FFFFFF', lineHeight:1.2, marginBottom:4 }}>Headline text</div>
            <div style={{ fontSize:theme.titleFontSize??22,    fontWeight:theme.fontWeightBold??700,   color:'#FFFFFF', lineHeight:1.3, marginBottom:4 }}>Title of a screen</div>
            <div style={{ fontSize:theme.bodyFontSize??14,     fontWeight:theme.fontWeightNormal??400, color:'#8892A4', lineHeight:1.6, marginBottom:2 }}>Body text — this is how your main content reads across all screens.</div>
            <div style={{ fontSize:theme.labelFontSize??12,    fontWeight:theme.fontWeightNormal??400, color:'#555',    lineHeight:1.5 }}>LABEL · CAPTION · HELPER TEXT</div>
          </div>
        </Section>

        {/* ── SHAPE ── */}
        <Section title="Shape &amp; components" color="#4caf7d" defaultOpen={false}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px' }}>
            <div>
              <div style={{ fontSize:10, color:'#555', marginBottom:8 }}>Border radius</div>
              <SliderRow label="Small (chips, badges)"   value={theme.borderRadiusSmall??8}   min={0} max={20} unit="px" onChange={v=>upd({borderRadiusSmall:v})}/>
              <SliderRow label="Medium (cards, inputs)"  value={theme.borderRadiusMedium??12} min={0} max={28} unit="px" onChange={v=>upd({borderRadiusMedium:v})}/>
              <SliderRow label="Large (dialogs, sheets)" value={theme.borderRadiusLarge??28}  min={0} max={40} unit="px" onChange={v=>upd({borderRadiusLarge:v})}/>
              <SliderRow label="Full (FAB, buttons)"     value={theme.borderRadiusFull??50}   min={0} max={50} unit="px" onChange={v=>upd({borderRadiusFull:v})}/>
            </div>
            <div>
              <div style={{ fontSize:10, color:'#555', marginBottom:8 }}>Component sizing</div>
              <SliderRow label="Button height"  value={theme.buttonHeight??48}    min={36} max={60} unit="px" onChange={v=>upd({buttonHeight:v})}/>
              <SliderRow label="AppBar elevation" value={theme.appBarElevation??0} min={0} max={8} unit="" onChange={v=>upd({appBarElevation:v})}/>
              <SliderRow label="Card elevation"  value={theme.cardElevation??2}   min={0} max={8} unit="" onChange={v=>upd({cardElevation:v})}/>

              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:10, color:'#555', marginBottom:8 }}>Input border style</div>
                <div style={{ display:'flex', gap:6 }}>
                  {(['outline','underline','filled'] as const).map(s => (
                    <button key={s} onClick={() => upd({inputBorderStyle:s})} style={{
                      flex:1, padding:'6px 0', background: theme.inputBorderStyle===s ? '#1e3a5f' : '#0a0a14',
                      border:`1px solid ${theme.inputBorderStyle===s ? '#1E6BFF' : '#1e2d3d'}`,
                      borderRadius:6, color: theme.inputBorderStyle===s ? '#4a9edd' : '#555',
                      fontSize:11, cursor:'pointer', fontFamily:'system-ui,sans-serif', textTransform:'capitalize' as const }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── MODE ── */}
        <Section title="Mode &amp; Material" color="#c9a227" defaultOpen={false}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <div style={{ fontSize:12, color:'#8892A4', marginBottom:8 }}>App brightness</div>
              <div style={{ display:'flex', gap:6 }}>
                {(['light','dark','system'] as const).map(b => (
                  <button key={b} onClick={() => upd({brightness:b})} style={{
                    flex:1, padding:'8px 0', background: theme.brightness===b ? '#1a3a1a' : '#0a0a14',
                    border:`1px solid ${theme.brightness===b ? '#4caf7d' : '#1e2d3d'}`,
                    borderRadius:8, color: theme.brightness===b ? '#4caf7d' : '#555',
                    fontSize:12, cursor:'pointer', fontFamily:'system-ui,sans-serif',
                    textTransform:'capitalize' as const }}>
                    {b === 'light' ? '☀ Light' : b === 'dark' ? '🌙 Dark' : '⚙ System'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:'#8892A4', marginBottom:8 }}>Material Design version</div>
              <div style={{ display:'flex', gap:6 }}>
                {[true, false].map(m3 => (
                  <button key={String(m3)} onClick={() => upd({useMaterial3:m3})} style={{
                    flex:1, padding:'8px 0', background: theme.useMaterial3===m3 ? '#1e3a5f' : '#0a0a14',
                    border:`1px solid ${theme.useMaterial3===m3 ? '#1E6BFF' : '#1e2d3d'}`,
                    borderRadius:8, color: theme.useMaterial3===m3 ? '#4a9edd' : '#555',
                    fontSize:12, cursor:'pointer', fontFamily:'system-ui,sans-serif' }}>
                    {m3 ? 'Material 3' : 'Material 2'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:10, color:'#444', marginTop:8 }}>
                Material 3 uses dynamic colour, rounded components and improved accessibility.
              </div>
            </div>
          </div>
        </Section>

        {/* Generated code preview */}
        <DartPreview theme={theme} />

      </div>

      {/* ── Right: live preview ── */}
      <div style={{ width:280, flexShrink:0, borderLeft:'1px solid #1e2d3d', overflowY:'auto' as const, padding:16 }}>
        <MiniPreview theme={theme} />

        {/* Color harmony chips */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.07em',
            textTransform:'uppercase' as const, marginBottom:8 }}>Color harmony</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {[
              { label:'Primary',    c: theme.primaryColor   },
              { label:'Secondary',  c: theme.secondaryColor },
              { label:'Tertiary',   c: theme.tertiaryColor  },
              { label:'Error',      c: theme.errorColor     },
              { label:'Background', c: theme.backgroundColor},
              { label:'Surface',    c: theme.surfaceColor   },
            ].map(({ label, c }) => (
              <div key={label} style={{ background: hex(c), borderRadius:8, height:48,
                display:'flex', alignItems:'flex-end', padding:'4px 8px',
                border:'1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize:9, color:contrastColor(hex(c)), opacity:0.8, fontWeight:600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shape preview */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.07em',
            textTransform:'uppercase' as const, marginBottom:8 }}>Shape scale</div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
            {[
              { label:'Small',  r: theme.borderRadiusSmall  ?? 8  },
              { label:'Medium', r: theme.borderRadiusMedium ?? 12 },
              { label:'Large',  r: theme.borderRadiusLarge  ?? 28 },
              { label:'Full',   r: theme.borderRadiusFull   ?? 50 },
            ].map(({ label, r }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:48, height:26, borderRadius:r,
                  background: hex(theme.primaryColor) + '33',
                  border: `1.5px solid ${hex(theme.primaryColor)}`,
                  flexShrink:0 }}/>
                <span style={{ fontSize:11, color:'#8892A4' }}>{label} — {r}px</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared button style for Export/Import/Copy toolbar ────────────────────────
function themeBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: '5px 12px', background: bg, border: `1px solid ${color}44`,
    borderRadius: 7, color, cursor: 'pointer', fontSize: 11,
    fontFamily: 'system-ui, sans-serif', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' as const,
  }
}

