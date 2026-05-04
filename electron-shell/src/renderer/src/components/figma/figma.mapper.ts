// ============================================================
// Figma Parser — Phase 2 (classify) + Phase 3 (map to widgets)
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import type { FigmaNode, FigmaPaint, FigmaColor, FigmaTypeStyle } from './figma.types'
import type { WidgetType } from '../../types/widget.schema'

// ── ID factory ───────────────────────────────────────────────
export function makeId() { return 'w_' + uuidv4().substring(0, 8) }

// ── Mapped widget (intermediate, not yet WidgetNode) ─────────
export interface MappedWidget {
  id:        string
  type:      WidgetType
  props:     Record<string, any>
  name?:     string
  children?: string[]       // child IDs in order
  _figmaBox?: { x: number; y: number; w: number; h: number }
}
export type WidgetMap = Record<string, MappedWidget>

// ── Color utilities ──────────────────────────────────────────

function toHex(c: FigmaColor): string {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0')
  return '#' + r + g + b
}

export function firstSolidFill(fills?: FigmaPaint[]): string | null {
  if (!fills) return null
  for (const f of fills) {
    if (f.type === 'SOLID' && f.color) return toHex(f.color)
    if ((f.type === 'GRADIENT_LINEAR' || f.type === 'GRADIENT_RADIAL') && f.gradientStops?.length) {
      // approximate gradient as first stop color
      return toHex(f.gradientStops[0].color)
    }
  }
  return null
}

// Only SOLID fills — used for scaffold background (don't approximate gradients there)
export function firstStrictSolidFill(fills?: FigmaPaint[]): string | null {
  if (!fills) return null
  const solid = fills.find(f => f.type === 'SOLID' && f.color)
  return solid?.color ? toHex(solid.color) : null
}

export function isImageFill(fills?: FigmaPaint[]): boolean {
  return !!fills?.some(f => f.type === 'IMAGE')
}

export function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// ── Geometry helpers ─────────────────────────────────────────

function cornerRadius(node: FigmaNode): number | null {
  if (node.cornerRadius && node.cornerRadius > 0) return Math.round(node.cornerRadius)
  if (node.rectangleCornerRadii) {
    const avg = (node.rectangleCornerRadii[0] + node.rectangleCornerRadii[1] +
                 node.rectangleCornerRadii[2] + node.rectangleCornerRadii[3]) / 4
    return avg > 0 ? Math.round(avg) : null
  }
  return null
}

function paddingProps(node: FigmaNode): Record<string, number> | null {
  const pt = node.paddingTop    ?? 0
  const pb = node.paddingBottom ?? 0
  const pl = node.paddingLeft   ?? 0
  const pr = node.paddingRight  ?? 0
  if (pt === 0 && pb === 0 && pl === 0 && pr === 0) return null
  if (pt === pb && pl === pr && pt === pl) return { all: pt }
  if (pt === pb && pl === pr) return { vertical: pt, horizontal: pl }
  return { top: pt, bottom: pb, left: pl, right: pr }
}

function mainAxisAlign(align?: string): string {
  switch (align) {
    case 'MAX':          return 'end'
    case 'CENTER':       return 'center'
    case 'SPACE_BETWEEN': return 'spaceBetween'
    default:             return 'start'
  }
}

function crossAxisAlign(align?: string): string {
  switch (align) {
    case 'MAX':    return 'end'
    case 'CENTER': return 'center'
    default:       return 'start'
  }
}

// ── Name-based heuristics ────────────────────────────────────
// These run BEFORE structural analysis so intentionally-named
// layers in Figma produce the correct widget type.

const NAME_PATTERNS: Array<{
  test: (name: string, node: FigmaNode) => boolean
  map:  (node: FigmaNode) => Partial<MappedWidget>
}> = [
  // AppBar — named header/appbar/topbar AND narrow
  {
    test: (n, node) => /header|appbar|app.?bar|topbar|top.?nav|navbar/i.test(n) &&
                       (node.absoluteBoundingBox?.height ?? 999) <= 80,
    map: (node) => ({
      type: 'flutter.widgets.AppBar' as WidgetType,
      props: {
        title: firstTextChild(node) || node.name,
        centerTitle: true,
        backgroundColor: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : undefined,
      },
    }),
  },
  // BottomNavigationBar — named bottomnav/tabbar AND has multiple children
  {
    test: (n, node) => /bottom.?nav|tab.?bar|bottom.?tab/i.test(n) &&
                       (node.children?.length ?? 0) >= 2,
    map: (node) => ({
      type: 'flutter.widgets.BottomNavigationBar' as WidgetType,
      props: {
        items: (node.children ?? []).slice(0, 5).map(child => ({
          label: firstTextChild(child) || child.name,
          icon:  inferIconName(child.name),
        })),
        currentIndex: 0,
      },
    }),
  },
  // ElevatedButton — named btn/button/cta AND short
  {
    test: (n, node) => /btn|button|cta|submit|sign.?in.?btn|login.?btn/i.test(n) &&
                       (node.absoluteBoundingBox?.height ?? 999) <= 64 &&
                       (node.absoluteBoundingBox?.width  ?? 999) >= 60,
    map: (node) => ({
      type: 'flutter.widgets.ElevatedButton' as WidgetType,
      props: {
        text: firstTextChild(node) || node.name,
        backgroundColor: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : undefined,
      },
    }),
  },
  // TextField — named input/field/email/password/search-field
  {
    test: (n, node) => /input|field|email|password|phone|search.?field|text.?box/i.test(n) &&
                       (node.absoluteBoundingBox?.height ?? 999) <= 80,
    map: (node) => ({
      type: 'flutter.widgets.TextField' as WidgetType,
      props: {
        label: firstTextChild(node) || node.name,
        hintText: firstTextChild(node) || '',
        obscureText: /password|passwd/i.test(node.name),
        fillColor: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : undefined,
      },
    }),
  },
  // SearchBar — named searchbar/search (not search-field)
  {
    test: (n, node) => /^search$/i.test(n.trim()) ||
                       (/searchbar|search.?bar/i.test(n) && (node.absoluteBoundingBox?.height ?? 999) <= 60),
    map: (node) => ({
      type: 'flutter.widgets.SearchBar' as WidgetType,
      props: {
        hintText: firstTextChild(node) || 'Search...',
        backgroundColor: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : undefined,
      },
    }),
  },
  // Card — named card/tile/item AND has corner radius or shadow
  {
    test: (n, node) => /card|tile|list.?item|panel/i.test(n) &&
                       (cornerRadius(node) !== null || (node.effects?.some(e => e.type === 'DROP_SHADOW') ?? false)),
    map: (node) => ({
      type: 'flutter.widgets.Card' as WidgetType,
      props: {
        elevation: node.effects?.find(e => e.type === 'DROP_SHADOW')?.radius ?? 2,
        color: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : undefined,
      },
    }),
  },
  // Chip / Badge — named chip/tag/badge AND small
  {
    test: (n, node) => /chip|tag|badge|label/i.test(n) &&
                       (node.absoluteBoundingBox?.height ?? 999) <= 36,
    map: (node) => ({
      type: 'flutter.widgets.Chip' as WidgetType,
      props: {
        label: firstTextChild(node) || node.name,
        backgroundColor: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : undefined,
      },
    }),
  },
  // Divider — named divider/separator OR very thin rectangle
  {
    test: (n, node) => /divider|separator|line|hr/i.test(n) ||
                       ((node.type === 'RECTANGLE' || node.type === 'LINE') &&
                        (node.absoluteBoundingBox?.height ?? 999) <= 3 &&
                        (node.absoluteBoundingBox?.width  ?? 0)   >= 20),
    map: (node) => ({
      type: 'flutter.widgets.Divider' as WidgetType,
      props: {
        thickness: Math.max(1, node.absoluteBoundingBox?.height ?? 1),
        color: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : { hex: '#E0E0E0' },
      },
    }),
  },
  // Avatar — named avatar/profile-pic/user-pic AND small (≤120px)
  // MUST have size guard — large frames named "photo-background" must NOT become CircleAvatar
  {
    test: (n, node) => /avatar|profile.?pic|user.?pic|pfp/i.test(n) &&
                       (node.absoluteBoundingBox?.width  ?? 999) <= 120 &&
                       (node.absoluteBoundingBox?.height ?? 999) <= 120,
    map: (node) => {
      const box = node.absoluteBoundingBox
      const radius = Math.round(Math.min(box?.width ?? 40, box?.height ?? 40) / 2)
      return {
        type: 'flutter.widgets.CircleAvatar' as WidgetType,
        props: {
          radius,
          backgroundColor: firstSolidFill(node.fills) ? { hex: firstSolidFill(node.fills) } : { hex: '#1E6BFF' },
          child: '',
        },
      }
    },
  },
]

// ── First text child helper ───────────────────────────────────
function firstTextChild(node: FigmaNode): string {
  if (node.type === 'TEXT') return node.characters || ''
  for (const child of (node.children ?? [])) {
    const t = firstTextChild(child)
    if (t) return t
  }
  return ''
}

// ── Icon name inference ───────────────────────────────────────
export function inferIconName(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const MAP: Record<string, string> = {
    home: 'Icons.home', house: 'Icons.home',
    search: 'Icons.search', find: 'Icons.search', magnify: 'Icons.search',
    menu: 'Icons.menu', hamburger: 'Icons.menu', nav: 'Icons.menu',
    back: 'Icons.arrow_back', arrow_back: 'Icons.arrow_back',
    forward: 'Icons.arrow_forward', next: 'Icons.arrow_forward',
    close: 'Icons.close', x: 'Icons.close', cancel: 'Icons.close',
    check: 'Icons.check', done: 'Icons.check', tick: 'Icons.check',
    add: 'Icons.add', plus: 'Icons.add', create: 'Icons.add',
    delete: 'Icons.delete', trash: 'Icons.delete', remove: 'Icons.delete',
    edit: 'Icons.edit', pencil: 'Icons.edit', pen: 'Icons.edit',
    settings: 'Icons.settings', gear: 'Icons.settings', cog: 'Icons.settings',
    profile: 'Icons.person', user: 'Icons.person', account: 'Icons.person',
    notification: 'Icons.notifications', bell: 'Icons.notifications', alert: 'Icons.notifications',
    cart: 'Icons.shopping_cart', basket: 'Icons.shopping_cart',
    heart: 'Icons.favorite', like: 'Icons.favorite', fav: 'Icons.favorite',
    share: 'Icons.share', send: 'Icons.send',
    camera: 'Icons.camera_alt', photo: 'Icons.photo',
    location: 'Icons.location_on', pin: 'Icons.location_on', map: 'Icons.map',
    phone: 'Icons.phone', call: 'Icons.phone',
    email: 'Icons.email', mail: 'Icons.email', message: 'Icons.message',
    chat: 'Icons.chat', comment: 'Icons.comment',
    calendar: 'Icons.calendar_today', date: 'Icons.calendar_today',
    clock: 'Icons.access_time', time: 'Icons.access_time',
    download: 'Icons.download', upload: 'Icons.upload',
    eye: 'Icons.visibility', view: 'Icons.visibility',
    lock: 'Icons.lock', password: 'Icons.lock',
    info: 'Icons.info', help: 'Icons.help',
    transfer: 'Icons.swap_horiz', swap: 'Icons.swap_horiz',
    wallet: 'Icons.account_balance_wallet', bank: 'Icons.account_balance',
    card: 'Icons.credit_card', payment: 'Icons.payment',
    arrow_up: 'Icons.keyboard_arrow_up', up: 'Icons.keyboard_arrow_up',
    arrow_down: 'Icons.keyboard_arrow_down', down: 'Icons.keyboard_arrow_down',
    star: 'Icons.star', rating: 'Icons.star',
    filter: 'Icons.filter_list', sort: 'Icons.sort',
  }
  for (const [key, icon] of Object.entries(MAP)) {
    if (n.includes(key)) return icon
  }
  return 'Icons.star'
}

// ── Font weight mapping ───────────────────────────────────────
function mapFontWeight(fw?: number): string {
  if (!fw) return 'w400'
  if (fw >= 900) return 'w900'
  if (fw >= 800) return 'w800'
  if (fw >= 700) return 'w700'
  if (fw >= 600) return 'w600'
  if (fw >= 500) return 'w500'
  if (fw >= 300) return 'w300'
  return 'w400'
}

// ── Font family mapping — Figma name → Google Fonts/Flutter ──
const FONT_MAP: Record<string, string> = {
  'SF Pro': 'System', 'SF Pro Display': 'System', 'SF Pro Text': 'System',
  'Helvetica Neue': 'System', 'Helvetica': 'System',
  '-apple-system': 'System', 'system-ui': 'System',
  'Roboto': 'Roboto', 'Inter': 'Inter', 'Poppins': 'Poppins',
  'Nunito': 'Nunito', 'Lato': 'Lato', 'Montserrat': 'Montserrat',
  'Open Sans': 'Open Sans', 'Raleway': 'Raleway', 'Ubuntu': 'Ubuntu',
  'Playfair Display': 'Playfair Display', 'Merriweather': 'Merriweather',
  'Source Sans Pro': 'Source Sans 3',
}

function mapFontFamily(family?: string): string | undefined {
  if (!family) return undefined
  return FONT_MAP[family] || undefined   // unknown = don't emit, use theme default
}

// ── Core mapNode ─────────────────────────────────────────────

export function mapNode(
  node:    FigmaNode,
  widgets: WidgetMap,
  depth:   number = 0
): string | null {
  if (node.visible === false) return null
  if (depth > 8) return null  // hard recursion limit

  const id  = makeId()
  const box = node.absoluteBoundingBox
  const w   = box?.width  ?? 0
  const h   = box?.height ?? 0

  // ── TEXT ────────────────────────────────────────────────────
  if (node.type === 'TEXT') {
    const st   = node.style || {}
    const fill = firstSolidFill(node.fills)
    widgets[id] = {
      id, type: 'flutter.widgets.Text', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w: box.width, h: box.height } : undefined,
      props: {
        data: node.characters || '',
        style: {
          fontSize:      st.fontSize ?? 14,
          fontWeight:    mapFontWeight(st.fontWeight),
          color:         fill ? { hex: fill } : { hex: '#000000' },
          fontFamily:    mapFontFamily(st.fontFamily),
          textAlign:     (st.textAlignHorizontal ?? 'LEFT').toLowerCase(),
          letterSpacing: st.letterSpacing ?? 0,
          height:        st.lineHeightPx ? +(st.lineHeightPx / (st.fontSize ?? 14)).toFixed(2) : undefined,
          decoration:    st.textDecoration === 'UNDERLINE' ? 'underline' :
                         st.textDecoration === 'STRIKETHROUGH' ? 'lineThrough' : undefined,
        },
      },
    }
    return id
  }

  // ── ELLIPSE → CircleAvatar (only if small enough to be an avatar) ─────────
  // Large ellipses (decorative backgrounds, hero images) → Container instead
  if (node.type === 'ELLIPSE') {
    if (w <= 200 && h <= 200) {
      const fill   = firstSolidFill(node.fills)
      const radius = Math.round(Math.min(w, h) / 2)
      widgets[id] = {
        id, type: 'flutter.widgets.CircleAvatar', name: node.name,
        _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
        props: {
          radius,
          backgroundColor: fill ? { hex: fill } : { hex: '#1E6BFF' },
          child: firstTextChild(node),
        },
      }
    } else {
      // Large ellipse — treat as a decorative Container
      const fill = firstSolidFill(node.fills)
      widgets[id] = {
        id, type: 'flutter.widgets.Container', name: node.name,
        _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
        props: {
          width: w || undefined, height: h || undefined,
          decoration: { color: fill ? { hex: fill } : undefined, borderRadius: { all: Math.round(Math.min(w, h) / 2) } },
        },
      }
    }
    return id
  }

  // ── VECTOR / BOOLEAN_OPERATION / STAR / POLYGON → Icon ──────
  if (['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON'].includes(node.type)) {
    const fill = firstSolidFill(node.fills) || firstSolidFill(node.strokes)
    const sz   = Math.round(Math.min(w || 24, h || 24))
    widgets[id] = {
      id, type: 'flutter.widgets.Icon', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w: sz, h: sz } : undefined,
      props: {
        icon:  inferIconName(node.name),
        size:  Math.max(8, Math.min(sz, 48)),
        color: fill ? { hex: fill } : { hex: '#888888' },
      },
    }
    return id
  }

  // ── IMAGE fill → Image widget ────────────────────────────────
  if (isImageFill(node.fills) && !node.children?.length) {
    widgets[id] = {
      id, type: 'flutter.widgets.Image', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
      props: {
        src:    `https://via.placeholder.com/${Math.round(w)}x${Math.round(h)}`,
        width:  w || undefined,
        height: h || undefined,
        fit:    'cover',
      },
    }
    return id
  }

  // ── Name-based heuristic match (before structural) ──────────
  const nameMatch = NAME_PATTERNS.find(p => p.test(node.name, node))
  if (nameMatch) {
    const partial = nameMatch.map(node)
    // Still map children for containers (Card, etc.) — not for leaf widgets
    const leafTypes: WidgetType[] = [
      'flutter.widgets.AppBar',
      'flutter.widgets.BottomNavigationBar',
      'flutter.widgets.ElevatedButton',
      'flutter.widgets.TextField',
      'flutter.widgets.SearchBar',
      'flutter.widgets.Chip',
      'flutter.widgets.Divider',
      'flutter.widgets.CircleAvatar',
    ]
    const isLeaf = leafTypes.includes(partial.type as WidgetType)
    const kids = isLeaf ? [] : mapChildren(node.children, widgets, depth + 1)
    widgets[id] = {
      id,
      type:     partial.type!,
      name:     node.name,
      props:    partial.props!,
      children: kids.length ? kids : undefined,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
    }
    return id
  }

  // ── FRAME / GROUP / COMPONENT / COMPONENT_SET ────────────────
  if (['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type)) {
    return mapContainer(node, id, widgets, depth)
  }

  // ── RECTANGLE (non-thin, no image) → Container ──────────────
  {
    const bg = firstSolidFill(node.fills)
    const cr = cornerRadius(node)
    widgets[id] = {
      id, type: 'flutter.widgets.Container', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
      props: {
        width:  w || undefined,
        height: h || undefined,
        decoration: (bg || cr) ? {
          color:        bg ? { hex: bg } : undefined,
          borderRadius: cr ? { all: cr } : undefined,
        } : undefined,
      },
    }
    return id
  }
}

// ── Container mapping ─────────────────────────────────────────

function mapContainer(
  node:    FigmaNode,
  id:      string,
  widgets: WidgetMap,
  depth:   number
): string {
  const box = node.absoluteBoundingBox
  const w   = box?.width  ?? 0
  const h   = box?.height ?? 0
  const bg  = firstSolidFill(node.fills)
  const cr  = cornerRadius(node)
  const pad = paddingProps(node)

  const kids = mapChildren(node.children, widgets, depth + 1)

  // Leaf container (no visible children)
  if (kids.length === 0) {
    widgets[id] = {
      id, type: 'flutter.widgets.Container', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
      props: {
        width: w || undefined, height: h || undefined,
        decoration: (bg || cr) ? {
          color:        bg ? { hex: bg } : undefined,
          borderRadius: cr ? { all: cr } : undefined,
        } : undefined,
      },
    }
    return id
  }

  const ma = mainAxisAlign(node.primaryAxisAlignItems)
  const ca = crossAxisAlign(node.counterAxisAlignItems)

  // ── Auto-layout VERTICAL → Column ────────────────────────────
  if (node.layoutMode === 'VERTICAL') {
    const spacing  = node.itemSpacing ?? 0
    const needsWrap = bg || cr || pad || w

    if (!needsWrap) {
      // Pure Column — no wrapper needed
      widgets[id] = {
        id, type: 'flutter.widgets.Column', name: node.name,
        _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
        props: { mainAxisAlignment: ma, crossAxisAlignment: ca, mainAxisSize: 'min' },
        children: injectSpacers(kids, spacing, 'vertical', widgets),
      }
      return id
    }

    const colId = makeId()
    widgets[colId] = {
      id: colId, type: 'flutter.widgets.Column', name: node.name,
      props: { mainAxisAlignment: ma, crossAxisAlignment: ca, mainAxisSize: 'min' },
      children: injectSpacers(kids, spacing, 'vertical', widgets),
    }
    widgets[id] = {
      id, type: 'flutter.widgets.Container', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
      props: {
        width: w || undefined,
        decoration: (bg || cr) ? { color: bg ? { hex: bg } : undefined, borderRadius: cr ? { all: cr } : undefined } : undefined,
        padding: pad ?? undefined,
      },
      children: [colId],
    }
    return id
  }

  // ── Auto-layout HORIZONTAL → Row ─────────────────────────────
  if (node.layoutMode === 'HORIZONTAL') {
    const spacing  = node.itemSpacing ?? 0
    const needsWrap = bg || cr || pad

    if (!needsWrap) {
      widgets[id] = {
        id, type: 'flutter.widgets.Row', name: node.name,
        _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
        props: { mainAxisAlignment: ma, crossAxisAlignment: ca },
        children: injectSpacers(kids, spacing, 'horizontal', widgets),
      }
      return id
    }

    const rowId = makeId()
    widgets[rowId] = {
      id: rowId, type: 'flutter.widgets.Row', name: node.name,
      props: { mainAxisAlignment: ma, crossAxisAlignment: ca },
      children: injectSpacers(kids, spacing, 'horizontal', widgets),
    }
    widgets[id] = {
      id, type: 'flutter.widgets.Container', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
      props: {
        width: w || undefined,
        decoration: (bg || cr) ? { color: bg ? { hex: bg } : undefined, borderRadius: cr ? { all: cr } : undefined } : undefined,
        padding: pad ?? undefined,
      },
      children: [rowId],
    }
    return id
  }

  // ── No auto-layout: detect overlap vs ordered layout ─────────
  const childBoxes = kids.map(cid => widgets[cid]?._figmaBox)
  const hasOverlap = detectOverlap(childBoxes)

  if (hasOverlap) {
    // Stack for overlapping children
    const stackId = (bg || cr) ? makeId() : id
    widgets[stackId] = {
      id: stackId, type: 'flutter.widgets.Stack', name: node.name,
      props: {},
      children: kids,
    }
    if (stackId !== id) {
      widgets[id] = {
        id, type: 'flutter.widgets.Container', name: node.name,
        _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
        props: {
          width: w || undefined, height: h || undefined,
          decoration: { color: bg ? { hex: bg } : undefined, borderRadius: cr ? { all: cr } : undefined },
        },
        children: [stackId],
      }
    } else {
      ;(widgets[id] as any)._figmaBox = box ? { x: box.x, y: box.y, w, h } : undefined
    }
    return id
  }

  // No overlap, no auto-layout — infer Column/Row from child positions
  const isVertical = inferVertical(childBoxes)
  const layoutId = (bg || cr || pad) ? makeId() : id
  widgets[layoutId] = {
    id: layoutId,
    type: (isVertical ? 'flutter.widgets.Column' : 'flutter.widgets.Row') as WidgetType,
    name: node.name,
    props: { mainAxisAlignment: 'start', crossAxisAlignment: 'start', mainAxisSize: 'min' },
    children: kids,
  }
  if (layoutId !== id) {
    widgets[id] = {
      id, type: 'flutter.widgets.Container', name: node.name,
      _figmaBox: box ? { x: box.x, y: box.y, w, h } : undefined,
      props: {
        width: w || undefined,
        decoration: (bg || cr) ? { color: bg ? { hex: bg } : undefined, borderRadius: cr ? { all: cr } : undefined } : undefined,
        padding: pad ?? undefined,
      },
      children: [layoutId],
    }
  } else {
    ;(widgets[id] as any)._figmaBox = box ? { x: box.x, y: box.y, w, h } : undefined
  }
  return id
}

// ── Child mapper ─────────────────────────────────────────────
export function mapChildren(
  children: FigmaNode[] | undefined,
  widgets:  WidgetMap,
  depth:    number
): string[] {
  if (!children) return []
  return children
    .map(child => mapNode(child, widgets, depth))
    .filter((id): id is string => id !== null)
}

// ── Spacer injection ─────────────────────────────────────────
function injectSpacers(
  kids:      string[],
  spacing:   number,
  direction: 'vertical' | 'horizontal',
  widgets:   WidgetMap
): string[] {
  if (spacing <= 0 || kids.length <= 1) return kids
  const result: string[] = []
  for (let i = 0; i < kids.length; i++) {
    result.push(kids[i])
    if (i < kids.length - 1) {
      const sid = makeId()
      widgets[sid] = {
        id: sid, type: 'flutter.widgets.SizedBox',
        props: direction === 'vertical' ? { height: spacing } : { width: spacing },
      }
      result.push(sid)
    }
  }
  return result
}

// ── Overlap detection ─────────────────────────────────────────
function detectOverlap(
  boxes: Array<{ x: number; y: number; w: number; h: number } | undefined>
): boolean {
  const valid = boxes.filter((b): b is NonNullable<typeof b> => !!b)
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i], b = valid[j]
      if (a.x < b.x + b.w && a.x + a.w > b.x &&
          a.y < b.y + b.h && a.y + a.h > b.y) {
        return true
      }
    }
  }
  return false
}

// ── Layout direction inference ────────────────────────────────
function inferVertical(
  boxes: Array<{ x: number; y: number; w: number; h: number } | undefined>
): boolean {
  const valid = boxes.filter((b): b is NonNullable<typeof b> => !!b)
  if (valid.length < 2) return true
  let ySpread = 0, xSpread = 0
  for (let i = 1; i < valid.length; i++) {
    ySpread += Math.abs(valid[i].y - valid[i - 1].y)
    xSpread += Math.abs(valid[i].x - valid[i - 1].x)
  }
  return ySpread >= xSpread
}
