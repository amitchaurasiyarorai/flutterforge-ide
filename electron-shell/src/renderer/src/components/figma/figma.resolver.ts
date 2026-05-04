// ============================================================
// Figma Resolver — Phase 4
// Post-process the mapped widget tree to fix structural issues:
//   1. Lift AppBar out of body → Scaffold.appBar
//   2. Lift BottomNavigationBar → Scaffold.bottomNavigationBar
//   3. Wrap body in SingleChildScrollView if tall
//   4. Theme color extraction
// ============================================================

import type { WidgetMap, MappedWidget } from './figma.mapper'
import { makeId, firstSolidFill, firstStrictSolidFill, luminance } from './figma.mapper'
import type { FigmaNode } from './figma.types'

// ── Screen-level resolver ─────────────────────────────────────
// Called after mapChildren on a top-level frame.
// Returns { scaffoldId, widgetMap } ready for canvas store injection.

export interface ResolvedScreen {
  rootWidgetId: string
  widgets:      WidgetMap
}

export function resolveScreen(
  frame:      FigmaNode,
  childIds:   string[],
  widgets:    WidgetMap
): ResolvedScreen {
  const bg = firstStrictSolidFill(frame.fills)

  const scaffoldId = makeId()
  let   appBarId:   string | undefined
  let   bottomNavId: string | undefined
  let   fabId:       string | undefined
  const bodyChildren: string[] = []

  for (const cid of childIds) {
    const w = widgets[cid]
    if (!w) continue

    if (w.type === 'flutter.widgets.AppBar') {
      appBarId = cid
    } else if (w.type === 'flutter.widgets.BottomNavigationBar' ||
               w.type === 'flutter.widgets.NavigationBar') {
      bottomNavId = cid
    } else if (w.type === 'flutter.widgets.FloatingActionButton') {
      fabId = cid
    } else {
      bodyChildren.push(cid)
    }
  }

  // Wrap body in a Column (or SingleChildScrollView for tall frames)
  const frameHeight  = frame.absoluteBoundingBox?.height ?? 0
  const isScrollable = frameHeight > 900 || frame.name.toLowerCase().includes('scroll')

  let bodyId: string

  if (bodyChildren.length === 0) {
    // Empty body — just a Center placeholder
    bodyId = makeId()
    widgets[bodyId] = { id: bodyId, type: 'flutter.widgets.Center', props: {} }

  } else if (bodyChildren.length === 1 && !isScrollable) {
    // Single child — use it directly
    bodyId = bodyChildren[0]

  } else if (isScrollable) {
    // Wrap in SingleChildScrollView > Column
    const colId = makeId()
    widgets[colId] = {
      id: colId,
      type: 'flutter.widgets.Column',
      props: { mainAxisAlignment: 'start', crossAxisAlignment: 'stretch', mainAxisSize: 'min' },
      children: bodyChildren,
    }
    bodyId = makeId()
    widgets[bodyId] = {
      id: bodyId,
      type: 'flutter.widgets.SingleChildScrollView',
      props: { scrollDirection: 'vertical' },
      children: [colId],
    }

  } else {
    // Multiple children — Column
    const layoutType = detectBodyLayout(bodyChildren, widgets)
    bodyId = makeId()
    widgets[bodyId] = {
      id: bodyId,
      type: layoutType,
      props: { mainAxisAlignment: 'start', crossAxisAlignment: 'stretch', mainAxisSize: 'min' },
      children: bodyChildren,
    }
  }

  // Build Scaffold props
  const scaffoldProps: Record<string, any> = {}
  if (bg) scaffoldProps.backgroundColor = { hex: bg }
  if (appBarId)    scaffoldProps.appBarId    = appBarId     // resolved by DartWidgetCodegen
  if (bottomNavId) scaffoldProps.bottomNavId = bottomNavId
  if (fabId)       scaffoldProps.fabId       = fabId

  // Scaffold children array (appBar first, then body, then bottomNav)
  const scaffoldChildren: string[] = []
  if (appBarId)    scaffoldChildren.push(appBarId)
  scaffoldChildren.push(bodyId)
  if (bottomNavId) scaffoldChildren.push(bottomNavId)
  if (fabId)       scaffoldChildren.push(fabId)

  widgets[scaffoldId] = {
    id:       scaffoldId,
    type:     'flutter.widgets.Scaffold',
    props:    scaffoldProps,
    children: scaffoldChildren,
  }

  return { rootWidgetId: scaffoldId, widgets }
}

function detectBodyLayout(
  ids:     string[],
  widgets: WidgetMap
): 'flutter.widgets.Column' | 'flutter.widgets.Row' | 'flutter.widgets.Stack' {
  const boxes = ids.map(id => widgets[id]?._figmaBox)
  const valid = boxes.filter((b): b is NonNullable<typeof b> => !!b)
  if (valid.length < 2) return 'flutter.widgets.Column'

  // Overlap check
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i], b = valid[j]
      if (a.x < b.x + b.w && a.x + a.w > b.x &&
          a.y < b.y + b.h && a.y + a.h > b.y) {
        return 'flutter.widgets.Stack'
      }
    }
  }

  // Spread direction
  let ySpread = 0, xSpread = 0
  for (let i = 1; i < valid.length; i++) {
    ySpread += Math.abs(valid[i].y - valid[i - 1].y)
    xSpread += Math.abs(valid[i].x - valid[i - 1].x)
  }
  return ySpread >= xSpread ? 'flutter.widgets.Column' : 'flutter.widgets.Row'
}

// ── Theme extraction ─────────────────────────────────────────

export interface ExtractedTheme {
  primaryColor:      string
  secondaryColor:    string
  backgroundColor:   string
  surfaceColor:      string
  onBackgroundColor: string
  onSurfaceColor:    string
  onPrimaryColor:    string
  brightness:        'light' | 'dark'
  fontFamily?:       string
}

export function extractTheme(frames: FigmaNode[]): ExtractedTheme {
  const colorFreq: Record<string, number> = {}

  function collectColors(node: FigmaNode) {
    const fill = firstSolidFill(node.fills)
    if (fill && fill !== '#000000' && fill !== '#ffffff' && fill !== '#FFFFFF') {
      colorFreq[fill] = (colorFreq[fill] || 0) + 1
    }
    for (const child of (node.children ?? [])) collectColors(child)
  }
  frames.forEach(collectColors)

  // Background = first frame's background
  const rawBg = firstStrictSolidFill(frames[0]?.fills) || '#FFFFFF'
  const background = rawBg
  const isDark     = luminance(background) < 0.4

  const sorted  = Object.entries(colorFreq).sort((a, b) => b[1] - a[1])
  const accents = sorted.filter(([c]) =>
    c !== background && c.toLowerCase() !== '#ffffff' && c !== '#000000' &&
    Math.abs(luminance(c) - luminance(background)) > 0.15
  )

  const primary   = accents[0]?.[0] || (isDark ? '#1565C0' : '#6200EA')
  const secondary = accents[1]?.[0] || (isDark ? '#00897B' : '#03DAC6')
  const surface   = isDark ? lighten(background, 12) : '#FFFFFF'

  // Font detection — find most-used font family in TEXT nodes
  const fontFreq: Record<string, number> = {}
  function collectFonts(node: FigmaNode) {
    if (node.type === 'TEXT' && node.style?.fontFamily) {
      const f = node.style.fontFamily
      fontFreq[f] = (fontFreq[f] || 0) + 1
    }
    for (const child of (node.children ?? [])) collectFonts(child)
  }
  frames.forEach(collectFonts)

  const FLUTTER_FONTS: Record<string, string> = {
    'Inter': 'Inter', 'Poppins': 'Poppins', 'Roboto': 'Roboto',
    'Nunito': 'Nunito', 'Lato': 'Lato', 'Montserrat': 'Montserrat',
    'Open Sans': 'Open Sans', 'Raleway': 'Raleway',
    'Playfair Display': 'Playfair Display', 'Merriweather': 'Merriweather',
  }
  const dominantFont = Object.entries(fontFreq).sort((a, b) => b[1] - a[1])[0]?.[0]
  const fontFamily = dominantFont ? (FLUTTER_FONTS[dominantFont] || undefined) : undefined

  return {
    primaryColor:      primary,
    secondaryColor:    secondary,
    backgroundColor:   background,
    surfaceColor:      surface,
    onBackgroundColor: isDark ? '#E3F2FD' : '#1C1B1F',
    onSurfaceColor:    isDark ? '#E3F2FD' : '#1C1B1F',
    onPrimaryColor:    '#FFFFFF',
    brightness:        isDark ? 'dark' : 'light',
    fontFamily,
  }
}

function lighten(hex: string, amt: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

// ── Screen name helpers ───────────────────────────────────────

export function toScreenName(figmaName: string): string {
  const cleaned = figmaName
    .replace(/[^a-zA-Z0-9 _-]/g, ' ')
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')

  if (!cleaned) return 'ImportedScreen'
  return cleaned.endsWith('Screen') ? cleaned : cleaned + 'Screen'
}

export function toRoute(screenName: string): string {
  return '/' + screenName
    .replace('Screen', '')
    .replace(/([A-Z])/g, (m, l, i) => (i > 0 ? '-' : '') + l.toLowerCase())
    .replace(/^-/, '')
}
