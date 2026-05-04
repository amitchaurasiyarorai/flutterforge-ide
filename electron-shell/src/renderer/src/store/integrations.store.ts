import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  DataFile, InterfaceDefinition, IntegrationsState,
  SchemaField, RequestParam, InterfaceHooks,
  ResponseType, HttpMethod, AuthType, TriggerType, CacheStrategy,
} from '../types/api-integration.types'
import { DEFAULT_HOOKS, makeDataFileId, makeInterfaceId, makeFieldId } from '../types/api-integration.types'

// ─────────────────────────────────────────────────────────────────────────────
// Store interface
// ─────────────────────────────────────────────────────────────────────────────

interface IntegrationsStore extends IntegrationsState {
  // Data Files CRUD
  addDataFile:       (name: string) => string
  updateDataFile:    (id: string, patch: Partial<DataFile>) => void
  deleteDataFile:    (id: string) => void
  addField:          (dataFileId: string, parentPath?: string) => void
  updateField:       (dataFileId: string, fieldId: string, patch: Partial<SchemaField>) => void
  deleteField:       (dataFileId: string, fieldId: string) => void

  // Interfaces CRUD
  addInterface:      (name: string) => string
  updateInterface:   (id: string, patch: Partial<InterfaceDefinition>) => void
  deleteInterface:   (id: string) => void
  updateHooks:       (id: string, hooks: Partial<InterfaceHooks>) => void
  addParam:          (interfaceId: string) => void
  updateParam:       (interfaceId: string, paramId: string, patch: Partial<RequestParam>) => void
  deleteParam:       (interfaceId: string, paramId: string) => void
  setTestResult:     (interfaceId: string, result: InterfaceDefinition['lastTestResult']) => void

  // Persistence
  loadFromProject:   (data: IntegrationsState) => void
  getExportData:     () => IntegrationsState
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find and update a field recursively
// ─────────────────────────────────────────────────────────────────────────────

function patchFieldRecursive(fields: SchemaField[], fieldId: string, patch: Partial<SchemaField>): boolean {
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].id === fieldId) {
      Object.assign(fields[i], patch)
      return true
    }
    if (fields[i].fields && patchFieldRecursive(fields[i].fields!, fieldId, patch)) return true
  }
  return false
}

function deleteFieldRecursive(fields: SchemaField[], fieldId: string): boolean {
  const idx = fields.findIndex(f => f.id === fieldId)
  if (idx !== -1) { fields.splice(idx, 1); return true }
  for (const f of fields) {
    if (f.fields && deleteFieldRecursive(f.fields, fieldId)) return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useIntegrationsStore = create<IntegrationsStore>()(
  immer((set, get) => ({
    dataFiles:  [],
    interfaces: [],

    // ── Data Files ────────────────────────────────────────────────────────────

    addDataFile: (name) => {
      const id = makeDataFileId()
      const now = new Date().toISOString()
      set(s => {
        s.dataFiles.push({
          id, name, description: '',
          responseType: 'FLAT_OBJECT',
          fields: [],
          mockJson: '{}',
          createdAt: now, updatedAt: now,
        })
      })
      return id
    },

    updateDataFile: (id, patch) => set(s => {
      const df = s.dataFiles.find(d => d.id === id)
      if (df) { Object.assign(df, patch); df.updatedAt = new Date().toISOString() }
    }),

    deleteDataFile: (id) => set(s => {
      s.dataFiles = s.dataFiles.filter(d => d.id !== id)
    }),

    addField: (dataFileId, _parentPath) => set(s => {
      const df = s.dataFiles.find(d => d.id === dataFileId)
      if (!df) return
      const field: SchemaField = {
        id: makeFieldId(), name: 'newField', type: 'String',
        required: false, mockValue: 'sample value',
      }
      df.fields.push(field)
      df.updatedAt = new Date().toISOString()
    }),

    updateField: (dataFileId, fieldId, patch) => set(s => {
      const df = s.dataFiles.find(d => d.id === dataFileId)
      if (df) {
        patchFieldRecursive(df.fields, fieldId, patch)
        df.updatedAt = new Date().toISOString()
      }
    }),

    deleteField: (dataFileId, fieldId) => set(s => {
      const df = s.dataFiles.find(d => d.id === dataFileId)
      if (df) {
        deleteFieldRecursive(df.fields, fieldId)
        df.updatedAt = new Date().toISOString()
      }
    }),

    // ── Interfaces ───────────────────────────────────────────────────────────

    addInterface: (name) => {
      const id = makeInterfaceId()
      const now = new Date().toISOString()
      set(s => {
        s.interfaces.push({
          id, name, description: '',
          method: 'GET', urlPath: '/api/', authType: 'bearer',
          params: [], responseSchemaId: '',
          triggerType: 'onScreenLoad', cacheStrategy: 'none',
          hooks: { ...DEFAULT_HOOKS },
          createdAt: now, updatedAt: now,
        })
      })
      return id
    },

    updateInterface: (id, patch) => set(s => {
      const ifc = s.interfaces.find(i => i.id === id)
      if (ifc) { Object.assign(ifc, patch); ifc.updatedAt = new Date().toISOString() }
    }),

    deleteInterface: (id) => set(s => {
      s.interfaces = s.interfaces.filter(i => i.id !== id)
    }),

    updateHooks: (id, hooks) => set(s => {
      const ifc = s.interfaces.find(i => i.id === id)
      if (ifc) { Object.assign(ifc.hooks, hooks); ifc.updatedAt = new Date().toISOString() }
    }),

    addParam: (interfaceId) => set(s => {
      const ifc = s.interfaces.find(i => i.id === interfaceId)
      if (ifc) ifc.params.push({
        id: makeFieldId(), name: 'param', type: 'String',
        location: 'query', required: false, mockValue: '',
      })
    }),

    updateParam: (interfaceId, paramId, patch) => set(s => {
      const ifc = s.interfaces.find(i => i.id === interfaceId)
      if (ifc) {
        const p = ifc.params.find(p => p.id === paramId)
        if (p) Object.assign(p, patch)
      }
    }),

    deleteParam: (interfaceId, paramId) => set(s => {
      const ifc = s.interfaces.find(i => i.id === interfaceId)
      if (ifc) ifc.params = ifc.params.filter(p => p.id !== paramId)
    }),

    setTestResult: (interfaceId, result) => set(s => {
      const ifc = s.interfaces.find(i => i.id === interfaceId)
      if (ifc) ifc.lastTestResult = result
    }),

    // ── Persistence ───────────────────────────────────────────────────────────

    loadFromProject: (data) => set(s => {
      s.dataFiles  = data.dataFiles  || []
      s.interfaces = data.interfaces || []
    }),

    getExportData: () => ({
      dataFiles:  get().dataFiles,
      interfaces: get().interfaces,
    }),
  }))
)
