import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuidv4 } from 'uuid'

// ─────────────────────────────────────────────────────────
// SERVICE GRAPH STORE
// Persists the Services tab state so it's included in
// import/export and survives page reloads.
// ─────────────────────────────────────────────────────────

export interface ServiceEntry {
  id:         string
  name:       string
  artifactId: string
  groupId:    string
  version:    string
  port:       number
  color:      string
  javaVersion:      string
  springBootVersion: string
  apiBasePath:      string
  hasDatabase:  boolean
  hasKafka:     boolean
  hasJwt:       boolean
  description:  string
}

export interface GatewayEntry {
  port:        number
  groupId:     string
  artifactId:  string
  version:     string
  jwtEnabled:  boolean
  corsOrigins: string[]
}

export interface ServiceGraphState {
  // Gateway
  gateway: GatewayEntry

  // Services
  services:    ServiceEntry[]
  selectedId:  string | null

  // Output
  lastOutputDir: string

  // Actions - gateway
  updateGateway: (updates: Partial<GatewayEntry>) => void

  // Actions - services
  addService:    (name: string, port: number) => void
  updateService: (id: string, updates: Partial<ServiceEntry>) => void
  removeService: (id: string) => void
  selectService: (id: string | null) => void

  // Actions - bulk (for import)
  setGraphState: (gateway: GatewayEntry, services: ServiceEntry[]) => void
  setOutputDir:  (dir: string) => void
  resetToDefault: () => void
}

const COLORS = [
  '#7c5cbf','#4a9edd','#2da44e','#e09b2d',
  '#e05252','#4caf7d','#9d7fe8','#63b3ed',
]

const DEFAULT_GATEWAY: GatewayEntry = {
  port:        8080,
  groupId:     '',
  artifactId:  'api-gateway',
  version:     '1.0.0',
  jwtEnabled:  true,
  corsOrigins: ['*'],
}

const DEFAULT_SERVICES: ServiceEntry[] = []

export const useProjectStore = create<ServiceGraphState>()(
  immer((set) => ({
      gateway:       { ...DEFAULT_GATEWAY },
      services:      DEFAULT_SERVICES,
      selectedId:    null,
      lastOutputDir: '',

      updateGateway: (updates) => set((state) => {
        Object.assign(state.gateway, updates)
      }),

      addService: (name, port) => set((state) => {
        const id         = 'svc_' + uuidv4().substring(0, 8)
        const artifactId = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
        state.services.push({
          id, name, artifactId,
          groupId:          state.services[0]?.groupId || '',
          version:          '1.0.0',
          port,
          color:            COLORS[state.services.length % COLORS.length],
          javaVersion:      '21',
          springBootVersion:'3.2',
          apiBasePath:      '/api/v1',
          hasDatabase:      true,
          hasKafka:         false,
          hasJwt:           true,
          description:      '',
        })
        state.selectedId = id
      }),

      updateService: (id, updates) => set((state) => {
        const idx = state.services.findIndex(s => s.id === id)
        if (idx !== -1) Object.assign(state.services[idx], updates)
      }),

      removeService: (id) => set((state) => {
        state.services = state.services.filter(s => s.id !== id)
        if (state.selectedId === id) {
          state.selectedId = state.services[0]?.id || null
        }
      }),

      selectService: (id) => set((state) => {
        state.selectedId = id
      }),

      setGraphState: (gateway, services) => set((state) => {
        state.gateway  = gateway
        state.services = services
        state.selectedId = services[0]?.id || null
      }),

      setOutputDir: (dir) => set((state) => {
        state.lastOutputDir = dir
      }),

      resetToDefault: () => set((state) => {
        state.gateway    = { ...DEFAULT_GATEWAY }
        state.services   = DEFAULT_SERVICES
        state.selectedId = null
      }),
  }))
)
