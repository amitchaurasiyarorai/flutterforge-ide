// ============================================================
// Figma Injector — Phase 5
// Write resolved screens + theme into canvas.store (Zustand).
// Also converts MappedWidget → WidgetNode (removes _figmaBox).
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import { useCanvasStore } from '../../store/canvas.store'
import type { WidgetMap } from './figma.mapper'
import type { ExtractedTheme, ResolvedScreen } from './figma.resolver'
import type { WidgetType } from '../../types/widget.schema'

// ── WidgetNode shape (matches canvas.store) ───────────────────

interface WidgetNode {
  id:        string
  type:      WidgetType
  props:     Record<string, any>
  name?:     string
  children?: string[]
  events?:   any
}

// ── Strip _figmaBox before writing to store ───────────────────

function toWidgetNode(w: any): WidgetNode {
  const { _figmaBox, ...clean } = w
  return clean as WidgetNode
}

// ── Inject a single screen ────────────────────────────────────

export interface InjectedScreen {
  screenId:   string
  screenName: string
  route:      string
}

export function injectScreen(
  screenName:    string,
  route:         string,
  resolved:      ResolvedScreen,
  overwriteExisting: boolean = false
): InjectedScreen {
  const store = useCanvasStore.getState()

  // Duplicate check
  if (!overwriteExisting) {
    const existing = Object.values(store.project?.screens ?? {}).find(s => s.name === screenName)
    if (existing) {
      // rename with a suffix to avoid collision
      screenName = screenName.replace('Screen', '') + '_Imported' + 'Screen'
      route      = route + '-imported'
    }
  }

  const screenId = 'screen_' + uuidv4().substring(0, 8)

  // Convert all MappedWidget → WidgetNode (strip _figmaBox)
  const cleanWidgets: Record<string, WidgetNode> = {}
  for (const [id, w] of Object.entries(resolved.widgets)) {
    cleanWidgets[id] = toWidgetNode(w)
  }

  useCanvasStore.setState(state => {
    if (!state.project) return
    state.project.screens[screenId] = {
      id:           screenId,
      name:         screenName,
      route,
      title:        screenName.replace('Screen', ''),
      rootWidgetId: resolved.rootWidgetId,
      widgets:      cleanWidgets as any,
    }
    state.activeScreenId = screenId
    state.isDirty = true
  })

  return { screenId, screenName, route }
}

// ── Inject extracted theme ────────────────────────────────────

export function injectTheme(theme: ExtractedTheme) {
  const { updateTheme } = useCanvasStore.getState()
  updateTheme({
    primaryColor:       { hex: theme.primaryColor },
    secondaryColor:     { hex: theme.secondaryColor },
    backgroundColor:    { hex: theme.backgroundColor },
    surfaceColor:       { hex: theme.surfaceColor },
    onBackgroundColor:  { hex: theme.onBackgroundColor },
    onSurfaceColor:     { hex: theme.onSurfaceColor },
    onPrimaryColor:     { hex: theme.onPrimaryColor },
    brightness:         theme.brightness,
    ...(theme.fontFamily ? { fontFamily: theme.fontFamily } : {}),
  })
}

// ── Fidelity report ───────────────────────────────────────────

export interface FidelityReport {
  screensImported:   number
  widgetsTotal:      number
  widgetBreakdown:   Record<string, number>
  themeUpdated:      boolean
  fontDetected?:     string
  warnings:          string[]
}

export function buildFidelityReport(
  screens:       InjectedScreen[],
  allWidgets:    WidgetMap[],
  theme:         ExtractedTheme | null,
  warnings:      string[]
): FidelityReport {
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const wMap of allWidgets) {
    for (const w of Object.values(wMap)) {
      const short = (w.type as string).replace('flutter.widgets.', '')
      breakdown[short] = (breakdown[short] || 0) + 1
      total++
    }
  }

  return {
    screensImported:  screens.length,
    widgetsTotal:     total,
    widgetBreakdown:  breakdown,
    themeUpdated:     theme !== null,
    fontDetected:     theme?.fontFamily,
    warnings,
  }
}
