import React, { useState, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import type { WidgetNode, ScreenDefinition, AppTheme } from '../../types/widget.schema'

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE PROFILES
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceProfile {
  id:           string
  label:        string
  icon:         string
  screenW:      number   // logical px (CSS)
  screenH:      number
  frameRadius:  number
  statusH:      number
  homeH:        number
  notchType:    'island' | 'notch' | 'none'
  frameColor:   string
  bezel:        number   // px each side
}

const DEVICES: DeviceProfile[] = [
  {
    id: 'iphone15',
    label: 'iPhone 15',
    icon: '',
    screenW: 390,
    screenH: 844,
    frameRadius: 47,
    statusH: 54,
    homeH: 34,
    notchType: 'island',
    frameColor: '#1a1a1f',
    bezel: 14,
  },
  {
    id: 'web',
    label: 'Web',
    icon: '🌐',
    screenW: 1280,
    screenH: 800,
    frameRadius: 8,
    statusH: 32,
    homeH: 0,
    notchType: 'none',
    frameColor: '#1a1a2e',
    bezel: 12,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — shared with Canvas.tsx (duplicated to avoid circular imports)
// ─────────────────────────────────────────────────────────────────────────────

const CONTAINERS = ['Scaffold','Container','Row','Column','Stack','Center','Padding',
  'Expanded','Flexible','Card','ListView','GridView','SingleChildScrollView','SafeArea','SizedBox']
function isContainer(t: string) { return CONTAINERS.some(c => t.includes(c)) }

function hex(c?: { hex: string } | null, fallback = '#000000') {
  return c?.hex || fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW WIDGET RENDERER
// Read-only version — no select/delete/drag handlers
// ─────────────────────────────────────────────────────────────────────────────

interface RenderProps {
  widget:   WidgetNode
  screen:   ScreenDefinition
  theme:    AppTheme
  isDark:   boolean
  depth?:   number
}

function PreviewWidgetRenderer({ widget, screen, theme, isDark, depth = 0 }: RenderProps): JSX.Element {
  const canChildren = isContainer(widget.type)
  const children    = widget.children || []

  if (widget.type.includes('BottomNavigationBar') || widget.type.includes('NavigationBar')) {
    const p    = widget.props as any
    const bg   = p.backgroundColor?.hex || (isDark ? '#0F1E35' : '#FFFFFF')
    const sel  = p.selectedItemColor?.hex  || hex(theme.primaryColor, '#1E6BFF')
    const unsel = p.unselectedItemColor?.hex || (isDark ? '#8892A4' : '#666666')
    const items = p.items || p.destinations ||
      [{ label: 'Home' }, { label: 'Transfer' }, { label: 'Cards' }, { label: 'Loans' }, { label: 'Profile' }]
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '8px 0 4px', background: bg,
        borderTop: `1px solid ${isDark ? '#1E2D3D' : '#e0e0e0'}`, flexShrink: 0 }}>
        {items.map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '0 8px' }}>
            <span style={{ fontSize: 18, color: i === 0 ? sel : unsel }}>◈</span>
            <span style={{ fontSize: 10, color: i === 0 ? sel : unsel, fontWeight: i === 0 ? 600 : 400 }}>
              {item.label || ''}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={getPreviewContainerStyle(widget, theme, isDark)}>
      <PreviewWidgetVisual widget={widget} theme={theme} isDark={isDark} />
      {canChildren && children.map(childId => {
        const child = screen.widgets[childId]
        if (!child) return null
        return <PreviewWidgetRenderer key={childId} widget={child} screen={screen} theme={theme} isDark={isDark} depth={depth + 1} />
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW WIDGET VISUAL
// ─────────────────────────────────────────────────────────────────────────────

function PreviewWidgetVisual({ widget, theme, isDark }: { widget: WidgetNode; theme: AppTheme; isDark: boolean }): JSX.Element | null {
  const type = widget.type
  const p    = widget.props as Record<string, any>
  const st   = p.style || {}
  const clr  = st.color?.hex || p.color?.hex || p.foregroundColor?.hex
  const fs   = st.fontSize || p.fontSize || 14
  const fw   = st.fontWeight || p.fontWeight || 'normal'

  const primary   = hex(theme.primaryColor,   '#1E6BFF')
  const secondary = hex(theme.secondaryColor, '#03DAC6')
  const surface   = hex(theme.surfaceColor,   isDark ? '#0D1B2A' : '#FFFFFF')
  const onSurface = isDark ? '#E8F0FF' : '#1C1B1F'

  // ── AppBar ────────────────────────────────────────────────────────────────
  if (type.includes('AppBar')) {
    const bg = p.backgroundColor?.hex || primary
    const fg = p.foregroundColor?.hex || '#FFFFFF'
    return (
      <div style={{ background: bg, color: fg, height: 56, display: 'flex',
        alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, width: '100%' }}>
        {p.leading && <span style={{ fontSize: 20, opacity: 0.8 }}>←</span>}
        <span style={{ fontSize: 17, fontWeight: 600, flex: 1,
          textAlign: p.centerTitle ? 'center' : 'left', color: fg }}>
          {String(p.title || 'AppBar')}
        </span>
        {(p.actions || []).length > 0 && <span style={{ fontSize: 16, opacity: 0.7, color: fg }}>⋮</span>}
      </div>
    )
  }

  // ── Text ──────────────────────────────────────────────────────────────────
  if (type.includes('Text') && !type.includes('TextField') && !type.includes('TextButton')) {
    const align = (st.textAlign || p.textAlign || 'left') as any
    return (
      <span style={{ fontSize: fs, fontWeight: fw, color: clr || onSurface,
        textAlign: align, display: 'block', lineHeight: st.height || 1.5,
        whiteSpace: 'pre-wrap' }}>
        {String(p.data || '')}
      </span>
    )
  }

  // ── ElevatedButton ────────────────────────────────────────────────────────
  if (type.includes('ElevatedButton')) {
    const bg = p.style?.backgroundColor?.hex || p.backgroundColor?.hex || primary
    const fg = p.style?.foregroundColor?.hex || p.foregroundColor?.hex || '#FFFFFF'
    return (
      <div style={{ background: bg, color: fg, padding: '0 24px', borderRadius: 12,
        fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center',
        justifyContent: 'center', width: '100%', height: 52 }}>
        {String(p.text || p.label || 'Button')}
      </div>
    )
  }

  // ── FilledButton ──────────────────────────────────────────────────────────
  if (type.includes('FilledButton')) {
    const bg = p.backgroundColor?.hex || primary
    return (
      <div style={{ background: bg, color: '#fff', padding: '0 24px', borderRadius: 50,
        fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: 44 }}>
        {String(p.text || 'Button')}
      </div>
    )
  }

  // ── OutlinedButton ────────────────────────────────────────────────────────
  if (type.includes('OutlinedButton')) {
    const fg = p.style?.foregroundColor?.hex || p.foregroundColor?.hex || primary
    return (
      <div style={{ border: `1.5px solid ${fg}`, color: fg, padding: '0 24px', borderRadius: 12,
        fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center',
        justifyContent: 'center', width: '100%', height: 48, background: 'transparent' }}>
        {String(p.text || p.label || 'Button')}
      </div>
    )
  }

  // ── TextButton ────────────────────────────────────────────────────────────
  if (type.includes('TextButton'))
    return <div style={{ color: p.style?.foregroundColor?.hex || primary,
      padding: '8px 4px', fontSize: 14, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center' }}>{String(p.text || 'Button')}</div>

  // ── TextField ─────────────────────────────────────────────────────────────
  if (type.includes('TextField') || type.includes('TextFormField')) {
    const fbg     = isDark ? '#0A1628' : '#F5F5F5'
    const fborder = isDark ? '#1E3A5F' : '#BDBDBD'
    const flabel  = isDark ? '#8899AA' : '#757575'
    return (
      <div style={{ border: `1.5px solid ${fborder}`, borderRadius: 10,
        padding: '10px 14px', background: fbg, width: '100%' }}>
        {p.labelText && <div style={{ fontSize: 11, color: primary,
          fontWeight: 500, marginBottom: 4 }}>{String(p.labelText)}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {p.prefixIcon && <span style={{ color: flabel, fontSize: 14 }}>◈</span>}
          <span style={{ fontSize: 13, color: flabel }}>
            {p.obscureText ? '••••••••' : String(p.hintText || 'Enter text...')}
          </span>
        </div>
      </div>
    )
  }

  // ── ListTile ──────────────────────────────────────────────────────────────
  if (type.includes('ListTile')) {
    return (
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center',
        gap: 12, width: '100%' }}>
        {p.leading && (
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: primary + '22', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: primary, fontSize: 18 }}>◈</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: onSurface, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {String(p.title || 'Title')}
          </div>
          {p.subtitle && (
            <div style={{ fontSize: 12, color: isDark ? '#8899AA' : '#757575', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {String(p.subtitle)}
            </div>
          )}
        </div>
        {p.trailing && <span style={{ fontSize: 14, color: isDark ? '#8899AA' : '#9E9E9E', flexShrink: 0 }}>›</span>}
      </div>
    )
  }

  // ── CircleAvatar ──────────────────────────────────────────────────────────
  if (type.includes('CircleAvatar')) {
    const r  = p.radius || 24
    const bg = p.backgroundColor?.hex || primary
    return (
      <div style={{ width: r * 2, height: r * 2, borderRadius: '50%', flexShrink: 0,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#FFFFFF', fontSize: r * 0.55, fontWeight: 700 }}>
        {String(p.child || p.initials || '?')}
      </div>
    )
  }

  // ── Icon / IconButton ─────────────────────────────────────────────────────
  if (type.includes('IconButton') || (type.includes('Icon') && !type.includes('CircleAvatar'))) {
    const ic  = String(p.icon || '')
    const sz  = p.size || 24
    const icClr = p.color?.hex || (isDark ? '#8892A4' : '#616161')
    const iconMap: Record<string, string> = {
      'Icons.home': '🏠', 'Icons.send': '↗', 'Icons.credit_card': '💳',
      'Icons.person': '👤', 'Icons.person_outline': '👤',
      'Icons.account_balance': '🏦', 'Icons.notifications': '🔔',
      'Icons.settings': '⚙', 'Icons.settings_outlined': '⚙',
      'Icons.search': '🔍', 'Icons.add': '＋', 'Icons.close': '✕',
      'Icons.arrow_back': '←', 'Icons.arrow_forward': '→',
      'Icons.chevron_right': '›', 'Icons.more_vert': '⋮',
      'Icons.fingerprint': '👆', 'Icons.lock_outline': '🔒',
      'Icons.visibility': '👁', 'Icons.visibility_off': '🙈',
      'Icons.check': '✓', 'Icons.check_circle': '✅',
      'Icons.email': '✉', 'Icons.phone': '📱',
      'Icons.location_on': '📍', 'Icons.calendar_today': '📅',
      'Icons.schedule': '⏰', 'Icons.currency_rupee': '₹',
      'Icons.bolt': '⚡', 'Icons.star': '★', 'Icons.favorite': '♥',
    }
    const display = iconMap[ic] || ic.replace('Icons.', '').replace(/_/g, ' ').slice(0, 2) || '◈'
    return (
      <div style={{ color: icClr, fontSize: sz, display: 'flex', alignItems: 'center',
        justifyContent: 'center', minWidth: sz, minHeight: sz, lineHeight: 1 }}>
        {display}
      </div>
    )
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  if (type.includes('Divider'))
    return <hr style={{ border: 'none',
      borderTop: `${p.thickness || 1}px solid ${p.color?.hex || (isDark ? '#1E2D3D' : '#E0E0E0')}`,
      margin: '4px 0', width: '100%' }} />

  // ── Image ─────────────────────────────────────────────────────────────────
  if (type.includes('Image'))
    return (
      <div style={{ background: isDark ? '#0D1B2A' : '#F5F5F5', borderRadius: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: p.height || 120, width: p.width || '100%',
        color: '#4A6A8A', gap: 6, border: `1px dashed ${isDark ? '#1E3A5F' : '#BDBDBD'}` }}>
        <span style={{ fontSize: 28 }}>🖼</span>
        <span style={{ fontSize: 11, color: isDark ? '#4A6A8A' : '#9E9E9E' }}>
          {p.src ? String(p.src).slice(0, 20) + '…' : 'Image'}
        </span>
      </div>
    )

  // ── Checkbox ──────────────────────────────────────────────────────────────
  if (type.includes('Checkbox')) {
    const cc = p.activeColor?.hex || primary
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
        <div style={{ width: 22, height: 22, border: `2px solid ${cc}`, borderRadius: 4,
          background: p.value ? cc : 'transparent', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
          {p.value ? '✓' : ''}
        </div>
        {p.label && <span style={{ fontSize: 14, color: onSurface }}>{String(p.label)}</span>}
      </div>
    )
  }

  // ── Switch ────────────────────────────────────────────────────────────────
  if (type.includes('Switch')) {
    const sc = p.activeColor?.hex || secondary
    return (
      <div style={{ width: 50, height: 28, borderRadius: 14,
        background: p.value ? sc : (isDark ? '#2A3A5A' : '#E0E0E0'),
        display: 'flex', alignItems: 'center', padding: '0 3px',
        justifyContent: p.value ? 'flex-end' : 'flex-start' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
      </div>
    )
  }

  // ── SearchBar ─────────────────────────────────────────────────────────────
  if (type.includes('SearchBar'))
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: isDark ? '#1a1a2e' : '#F5F5F5',
        borderRadius: 28, border: `1px solid ${isDark ? '#2a2a3a' : '#E0E0E0'}`, width: '100%' }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <span style={{ fontSize: 13, color: isDark ? '#555' : '#9E9E9E' }}>
          {String(p.hintText || 'Search...')}
        </span>
      </div>
    )

  // ── Badge ─────────────────────────────────────────────────────────────────
  if (type.includes('Badge'))
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 20, height: 20, borderRadius: 10,
        background: p.backgroundColor?.hex || '#E05252', color: '#fff',
        fontSize: 10, fontWeight: 700, padding: '0 5px' }}>
        {String(p.label || '1')}
      </div>
    )

  // ── Chip ──────────────────────────────────────────────────────────────────
  if (type.includes('Chip'))
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 20,
        background: p.selected ? primary + '22' : (isDark ? '#1a1a2e' : '#F0F0F0'),
        border: `1px solid ${p.selected ? primary : (isDark ? '#2a2a3a' : '#E0E0E0')}`,
        fontSize: 12, color: p.selected ? primary : onSurface }}>
        {String(p.label || 'Chip')}
      </div>
    )

  // ── LinearProgressIndicator ───────────────────────────────────────────────
  if (type.includes('LinearProgressIndicator')) {
    const pct = typeof p.value === 'number' ? p.value * 100 : 60
    return (
      <div style={{ width: '100%', height: 4, borderRadius: 2,
        background: isDark ? '#1E2D3D' : '#E0E0E0' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2,
          background: p.color?.hex || primary }} />
      </div>
    )
  }

  // ── Native plugins ────────────────────────────────────────────────────────
  if (type.includes('native.')) {
    const map: Record<string, [string, string]> = {
      'native.Camera':              ['📷', 'Camera'],
      'native.AudioPlayer':         ['🔊', 'Audio'],
      'native.VideoPlayer':         ['▶',  'Video'],
      'native.FilePicker':          ['📁', 'Files'],
      'native.QrScanner':           ['▦',  'QR'],
      'native.BiometricAuth':       ['👆', 'Biometric'],
      'native.PushNotifications':   ['🔔', 'Push'],
      'native.Location':            ['📍', 'GPS'],
      'native.Bluetooth':           ['⬡',  'BT'],
      'native.Share':               ['↗',  'Share'],
    }
    const [icon, name] = map[type] || ['◈', type.split('.').pop() || '']
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: isDark ? '#0D1B2A' : '#F5F5F5',
        borderRadius: 10, border: `1px solid ${isDark ? '#1E3A5F' : '#E0E0E0'}` }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: onSurface }}>{name}</div>
          <div style={{ fontSize: 10, color: isDark ? '#8899AA' : '#9E9E9E' }}>Native Plugin</div>
        </div>
      </div>
    )
  }

  // ── Silent containers — CSS handles them ─────────────────────────────────
  const SILENT = ['Scaffold', 'Container', 'Row', 'Column', 'Stack', 'Center', 'Padding',
    'Expanded', 'Flexible', 'Wrap', 'SafeArea', 'SizedBox', 'ListView', 'GridView',
    'SingleChildScrollView', 'Card', 'FutureBuilder', 'StreamBuilder',
    'GestureDetector', 'AnimatedContainer', 'ClipRRect', 'Opacity', 'Spacer',
    'TabBar', 'TabBarView', 'PageView', 'Material', 'InkWell']
  if (SILENT.some(s => type.includes(s))) return null

  // ── Fallback ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '6px 10px', color: isDark ? '#8892A4' : '#9E9E9E', fontSize: 11,
      background: isDark ? '#0A1420' : '#FAFAFA',
      borderRadius: 6, border: `1px dashed ${isDark ? '#1E3A5F' : '#E0E0E0'}`,
      display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10 }}>◈</span>{type.split('.').pop()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTAINER STYLE — theme-aware version of getContainerStyle from Canvas.tsx
// ─────────────────────────────────────────────────────────────────────────────

function getPreviewContainerStyle(widget: WidgetNode, theme: AppTheme, isDark: boolean): React.CSSProperties {
  const p    = widget.props as Record<string, any>
  const type = widget.type
  const dec  = p.decoration || {}
  const css: React.CSSProperties = {}

  const surface = hex(theme.surfaceColor, isDark ? '#060E1A' : '#FFFFFF')

  if (dec.color?.hex)       css.backgroundColor = dec.color.hex
  else if (p.color?.hex && (type.includes('Container') || type.includes('Card')))
                             css.backgroundColor = p.color.hex
  else if (p.backgroundColor?.hex) css.backgroundColor = p.backgroundColor.hex

  if (dec.borderRadius?.all !== undefined) { css.borderRadius = dec.borderRadius.all; css.overflow = 'hidden' }
  else if (p.borderRadius?.all !== undefined) { css.borderRadius = p.borderRadius.all; css.overflow = 'hidden' }

  if (dec.border) css.border = `${dec.border.width || 1}px solid ${dec.border.color?.hex || '#1E3A5F'}`
  const sh = dec.boxShadow?.[0]
  if (sh) css.boxShadow = `${sh.offsetX || 0}px ${sh.offsetY || 4}px ${sh.blurRadius || 8}px ${sh.color?.hex || '#00000044'}`
  else if (p.elevation && p.elevation > 0)
    css.boxShadow = `0 ${p.elevation}px ${p.elevation * 3}px rgba(0,0,0,${isDark ? 0.4 : 0.15})`

  if (p.padding) {
    const pad = p.padding
    if      (pad.all !== undefined) css.padding = pad.all
    else if (pad.horizontal !== undefined || pad.vertical !== undefined)
      css.padding = `${pad.vertical || 0}px ${pad.horizontal || 0}px`
    else css.padding = `${pad.top || 0}px ${pad.right || 0}px ${pad.bottom || 0}px ${pad.left || 0}px`
  }

  if (p.margin) {
    const m = p.margin
    if      (m.all !== undefined) css.margin = m.all
    else if (m.horizontal !== undefined || m.vertical !== undefined)
      css.margin = `${m.vertical || 0}px ${m.horizontal || 0}px`
    else {
      if (m.top    !== undefined) css.marginTop    = m.top
      if (m.bottom !== undefined) css.marginBottom = m.bottom
      if (m.left   !== undefined) css.marginLeft   = m.left
      if (m.right  !== undefined) css.marginRight  = m.right
    }
  }

  if (p.width)  css.width  = p.width === 400 ? '100%' : p.width
  if (p.height) css.height = p.height

  if (type.includes('Scaffold')) {
    css.display = 'flex'; css.flexDirection = 'column'; css.minHeight = '100%'
    if (!css.backgroundColor) css.backgroundColor = surface
  }
  if (type.includes('Column')) {
    css.display = 'flex'; css.flexDirection = 'column'
    const ma = p.mainAxisAlignment || 'start'
    css.justifyContent = { center: 'center', end: 'flex-end', spaceBetween: 'space-between',
      spaceEvenly: 'space-evenly', spaceAround: 'space-around' }[ma] || 'flex-start'
    const ca = p.crossAxisAlignment || 'stretch'
    css.alignItems = { center: 'center', end: 'flex-end', start: 'flex-start' }[ca] || 'stretch'
  }
  if (type.includes('Row')) {
    css.display = 'flex'; css.flexDirection = 'row'
    const ma = p.mainAxisAlignment || 'start'
    css.justifyContent = { center: 'center', end: 'flex-end', spaceBetween: 'space-between',
      spaceEvenly: 'space-evenly', spaceAround: 'space-around' }[ma] || 'flex-start'
    const ca = p.crossAxisAlignment || 'center'
    css.alignItems = { start: 'flex-start', end: 'flex-end', stretch: 'stretch' }[ca] || 'center'
    css.gap = p.spacing || 0
  }
  if (type.includes('Stack'))    { css.position = 'relative'; css.display = 'block' }
  if (type.includes('Center'))   { css.display = 'flex'; css.alignItems = 'center'; css.justifyContent = 'center'; css.flex = 1; css.flexDirection = 'column' }
  if (type.includes('Expanded') || type.includes('Flexible')) css.flex = p.flex || 1
  if (type.includes('SizedBox')) { if (p.width) css.width = p.width; if (p.height) css.height = p.height; css.flexShrink = 0 }
  if (type.includes('ListView'))  { css.display = 'flex'; css.flexDirection = 'column'; css.flex = p.shrinkWrap ? undefined : 1; css.overflowY = 'auto'; css.gap = p.itemSpacing || 0 }
  if (type.includes('GridView'))  { css.display = 'grid'; css.gridTemplateColumns = `repeat(${p.crossAxisCount || 2}, 1fr)`; css.gap = p.crossAxisSpacing || 8 }
  if (type.includes('SingleChildScrollView')) { css.flex = 1; css.overflowY = 'auto'; css.display = 'flex'; css.flexDirection = 'column' }
  if (type.includes('Card')) {
    if (!css.backgroundColor) css.backgroundColor = isDark ? '#0D1B2A' : '#FFFFFF'
    if (!css.borderRadius) { css.borderRadius = p.shape?.all ?? 16; css.overflow = 'hidden' }
  }

  return css
}

// ─────────────────────────────────────────────────────────────────────────────
// PHONE FRAME COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function IPhone15Frame({ children, isDark, screenBg }: {
  children: React.ReactNode; isDark: boolean; screenBg: string
}) {
  const bezel = 14
  const fw    = 390 + bezel * 2   // 418
  const fh    = 844 + bezel * 2 + 34 + 10  // frame height

  return (
    <div style={{ position: 'relative', width: fw, height: fh, flexShrink: 0 }}>
      {/* Outer frame */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 50,
        background: 'linear-gradient(145deg, #2a2a2f 0%, #1a1a1f 50%, #0f0f14 100%)',
        boxShadow: '0 0 0 1px #3a3a3f, 0 30px 80px rgba(0,0,0,0.9), inset 0 0 0 1px #0a0a0f' }} />
      {/* Screen area */}
      <div style={{ position: 'absolute', top: bezel, left: bezel,
        width: 390, height: 844 + 34, borderRadius: 38,
        overflow: 'hidden', background: screenBg }}>
        {/* Status bar */}
        <div style={{ height: 54, display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', padding: '0 28px 8px',
          background: screenBg, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700,
            color: isDark ? '#FFFFFF' : '#000000' }}>9:41</span>
          {/* Dynamic Island */}
          <div style={{ position: 'absolute', top: 10, left: '50%',
            transform: 'translateX(-50%)', width: 120, height: 34,
            background: '#000000', borderRadius: 20 }} />
          <div style={{ display: 'flex', gap: 6, fontSize: 12,
            color: isDark ? '#FFFFFF' : '#000000', alignItems: 'center' }}>
            <span style={{ fontSize: 11 }}>▲▲▲</span>
            <span style={{ fontSize: 10 }}>●</span>
            <span style={{ fontSize: 10 }}>■■</span>
          </div>
        </div>
        {/* Screen content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          height: 844 - 54 - 34, overflowY: 'auto' }}>
          {children}
        </div>
        {/* Home indicator */}
        <div style={{ height: 34, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: screenBg, flexShrink: 0 }}>
          <div style={{ width: 134, height: 5, borderRadius: 3,
            background: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }} />
        </div>
      </div>
      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -3, top: 120, width: 4, height: 36,
        borderRadius: '3px 0 0 3px', background: '#2a2a2f', boxShadow: '-1px 0 0 #0a0a0f' }} />
      <div style={{ position: 'absolute', left: -3, top: 170, width: 4, height: 64,
        borderRadius: '3px 0 0 3px', background: '#2a2a2f', boxShadow: '-1px 0 0 #0a0a0f' }} />
      <div style={{ position: 'absolute', left: -3, top: 248, width: 4, height: 64,
        borderRadius: '3px 0 0 3px', background: '#2a2a2f', boxShadow: '-1px 0 0 #0a0a0f' }} />
      <div style={{ position: 'absolute', right: -3, top: 160, width: 4, height: 80,
        borderRadius: '0 3px 3px 0', background: '#2a2a2f', boxShadow: '1px 0 0 #0a0a0f' }} />
    </div>
  )
}

function WebFrame({ children, isDark, screenBg }: {
  children: React.ReactNode; isDark: boolean; screenBg: string
}) {
  return (
    <div style={{ width: 900, flexShrink: 0, border: `1px solid ${isDark ? '#2a2a3a' : '#E0E0E0'}`,
      borderRadius: 10, overflow: 'hidden',
      boxShadow: `0 8px 32px rgba(0,0,0,${isDark ? 0.6 : 0.15})` }}>
      {/* Browser chrome */}
      <div style={{ height: 40, background: isDark ? '#1a1a2e' : '#F5F5F5',
        borderBottom: `1px solid ${isDark ? '#2a2a3a' : '#E0E0E0'}`,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57', '#FFBD2E', '#28C840'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, height: 24, background: isDark ? '#0d0d1a' : '#FFFFFF',
          borderRadius: 6, border: `1px solid ${isDark ? '#2a2a3a' : '#E0E0E0'}`,
          display: 'flex', alignItems: 'center', padding: '0 10px',
          fontSize: 11, color: isDark ? '#555' : '#9E9E9E', maxWidth: 360, margin: '0 auto' }}>
          🔒 localhost:8080
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['←', '→', '⟳'].map((btn, i) => (
            <div key={i} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13,
              color: isDark ? '#555' : '#9E9E9E' }}>{btn}</div>
          ))}
        </div>
      </div>
      {/* Page content */}
      <div style={{ height: 560, overflowY: 'auto', background: screenBg }}>
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 16, color: '#444' }}>
      <div style={{ fontSize: 56, opacity: 0.4 }}>📱</div>
      <div style={{ fontSize: 16, color: '#555', fontWeight: 600 }}>No project open</div>
      <div style={{ fontSize: 12, color: '#444', textAlign: 'center', maxWidth: 260 }}>
        Open a project and add screens to see a live preview here
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN SELECTOR TAB BAR
// ─────────────────────────────────────────────────────────────────────────────

function ScreenTabs({ screens, activeId, onSelect }: {
  screens: { id: string; name: string }[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '6px 12px 0',
      borderBottom: '1px solid #1e1e2e', flexShrink: 0, background: '#0a0a14' }}>
      {screens.map(sc => {
        const active = sc.id === activeId
        return (
          <button key={sc.id} onClick={() => onSelect(sc.id)} style={{
            padding: '5px 14px', borderRadius: '6px 6px 0 0',
            border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            whiteSpace: 'nowrap', flexShrink: 0,
            background: active ? '#0d0d1a' : 'transparent',
            color:      active ? '#9d7fe8' : '#555',
            borderBottom: active ? '2px solid #9d7fe8' : '2px solid transparent',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {sc.name}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function PhonePreview(): JSX.Element {
  const { project, activeScreenId, setActiveScreen } = useCanvasStore()

  const [deviceId,      setDeviceId]     = useState<string>('iphone15')
  const [previewDark,   setPreviewDark]  = useState<boolean | null>(null)  // null = follow theme
  const [previewScale,  setPreviewScale] = useState(0.6)

  const device = DEVICES.find(d => d.id === deviceId) || DEVICES[0]
  const screens = project ? Object.values(project.screens) : []
  const screen  = project && activeScreenId ? project.screens[activeScreenId] : null
  const theme   = project?.theme || {} as AppTheme

  // Resolve dark mode: explicit toggle > theme brightness > default dark
  const effectiveDark = previewDark !== null
    ? previewDark
    : (theme.brightness === 'dark' || theme.brightness === undefined)

  const screenBg = screen?.widgets[screen?.rootWidgetId ?? '']?.props
    ? ((screen.widgets[screen.rootWidgetId!].props as any)?.backgroundColor?.hex
        || (effectiveDark ? '#060E1A' : '#FFFFFF'))
    : (effectiveDark ? '#060E1A' : '#FFFFFF')

  const rootWidget = screen ? screen.widgets[screen.rootWidgetId ?? ''] : null

  // Scale presets
  const scalePresets = deviceId === 'web'
    ? [0.4, 0.5, 0.6, 0.75]
    : [0.45, 0.55, 0.65, 0.75]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      background: '#080813', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: '#0a0a14',
        borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>

        {/* Device selector */}
        <div style={{ display: 'flex', gap: 1, background: '#13132a',
          borderRadius: 8, border: '1px solid #2a2a3a', padding: 2 }}>
          {DEVICES.map(d => (
            <button key={d.id} onClick={() => setDeviceId(d.id)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: deviceId === d.id ? '#1e1a33' : 'transparent',
              color:      deviceId === d.id ? '#9d7fe8' : '#555',
              fontFamily: 'system-ui, sans-serif',
            }}>
              {d.icon && <span style={{ marginRight: 4 }}>{d.icon}</span>}
              {d.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#2a2a3a' }} />

        {/* Dark / Light toggle */}
        <div style={{ display: 'flex', gap: 1, background: '#13132a',
          borderRadius: 8, border: '1px solid #2a2a3a', padding: 2 }}>
          {[
            { label: '☀ Light', val: false },
            { label: '● Auto',  val: null  },
            { label: '☾ Dark',  val: true  },
          ].map(opt => (
            <button key={String(opt.val)} onClick={() => setPreviewDark(opt.val as any)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: previewDark === opt.val ? '#1e1a33' : 'transparent',
              color:      previewDark === opt.val ? '#c9a227' : '#555',
              fontFamily: 'system-ui, sans-serif',
            }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#2a2a3a' }} />

        {/* Scale */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setPreviewScale(s => Math.max(0.3, +(s - 0.05).toFixed(2)))}
            style={btnStyle}>−</button>
          <select value={previewScale}
            onChange={e => setPreviewScale(+e.target.value)}
            style={{ background: '#13132a', border: '1px solid #2a2a3a', borderRadius: 4,
              color: '#888', fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}>
            {scalePresets.map(s => (
              <option key={s} value={s}>{Math.round(s * 100)}%</option>
            ))}
          </select>
          <button onClick={() => setPreviewScale(s => Math.min(1, +(s + 0.05).toFixed(2)))}
            style={btnStyle}>+</button>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#444' }}>
          {device.screenW} × {device.screenH}
        </div>
      </div>

      {/* ── Screen tabs ──────────────────────────────────────────────────── */}
      {screens.length > 0 && (
        <ScreenTabs
          screens={screens.map(s => ({ id: s.id, name: s.name }))}
          activeId={activeScreenId}
          onSelect={setActiveScreen}
        />
      )}

      {/* ── Canvas area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 32px 48px', background: '#080813' }}>

        {!project ? (
          <EmptyPreview />
        ) : !screen ? (
          <EmptyPreview />
        ) : (
          <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center', flexShrink: 0 }}>
            {deviceId === 'iphone15' && (
              <IPhone15Frame isDark={effectiveDark} screenBg={screenBg}>
                {rootWidget ? (
                  <PreviewWidgetRenderer
                    widget={rootWidget}
                    screen={screen}
                    theme={theme}
                    isDark={effectiveDark}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100%', color: '#444', fontSize: 13 }}>
                    Empty screen — drag widgets from the Canvas tab
                  </div>
                )}
              </IPhone15Frame>
            )}

            {deviceId === 'web' && (
              <WebFrame isDark={effectiveDark} screenBg={screenBg}>
                {rootWidget ? (
                  <PreviewWidgetRenderer
                    widget={rootWidget}
                    screen={screen}
                    theme={theme}
                    isDark={effectiveDark}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: '100%', color: '#444', fontSize: 13 }}>
                    Empty screen — drag widgets from the Canvas tab
                  </div>
                )}
              </WebFrame>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '3px 12px', fontSize: 9, color: '#333',
        textAlign: 'center', background: '#0a0a14', borderTop: '1px solid #1e1e2e',
        flexShrink: 0 }}>
        Live preview — updates instantly as you edit the canvas
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 22, height: 22, background: '#13132a', border: '1px solid #2a2a3a',
  borderRadius: 4, color: '#888', cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, sans-serif',
}
