import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// UI Store — global IDE UI state that any component can read/write
// Avoids prop-drilling for things like "switch to Code tab from PropertiesPanel"
// ─────────────────────────────────────────────────────────────────────────────

export type IDETab =
  | 'canvas' | 'theme' | 'preview' | 'figma' | 'assets'
  | 'datafiles' | 'interfaces'
  | 'code' | 'codegen'
  | 'navigation'
  | 'config'

interface UIState {
  activeTab: IDETab
  setActiveTab: (tab: IDETab) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'canvas',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
