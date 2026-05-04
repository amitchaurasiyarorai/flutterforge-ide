import { contextBridge, ipcRenderer } from 'electron'

/**
 * FlutterForge — Electron Preload
 *
 * Exposes a safe, typed API to the React renderer via contextBridge.
 * The renderer never accesses Node.js/Electron APIs directly.
 */

// ── File System API ──────────────────────────────────────
const fsApi = {
  openProject:        ()                              => ipcRenderer.invoke('fs:openProject'),
  saveProject:        (json: string, path?: string)   => ipcRenderer.invoke('fs:saveProject', json, path),
  readFile:           (path: string)                  => ipcRenderer.invoke('fs:readFile', path),
  writeFile:          (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  listRecentProjects: ()                              => ipcRenderer.invoke('fs:listRecentProjects'),
  chooseOutputDir:    ()                              => ipcRenderer.invoke('fs:chooseOutputDir'),
  openInExplorer:     (path: string)                  => ipcRenderer.invoke('fs:openInExplorer', path),
}

// ── Folder-based project API (.appzillon format) ─────────
const projectApi = {
  chooseFolder:     ()                  => ipcRenderer.invoke('project:chooseFolder'),
  chooseSaveFolder: ()                  => ipcRenderer.invoke('project:chooseSaveFolder'),
  openFolder:       (folderPath: string) => ipcRenderer.invoke('project:openFolder', folderPath),
  saveFolder:       (req: any)           => ipcRenderer.invoke('project:saveFolder', req),
  saveScreen:       (req: any)           => ipcRenderer.invoke('project:saveScreen', req),
  saveAppJson:      (folderPath: string, appJson: any) => ipcRenderer.invoke('project:saveAppJson', folderPath, appJson),
}

// ── Codegen API ──────────────────────────────────────────
const codegenApi = {
  generate: (request: { type: string; payload: string; outputDir: string }) =>
    ipcRenderer.invoke('codegen:generate', request),
  health: () => ipcRenderer.invoke('codegen:health'),
  onReady: (callback: () => void) => {
    ipcRenderer.on('codegen:ready', callback)
    return () => ipcRenderer.removeListener('codegen:ready', callback)
  },
}

// ── AI API ───────────────────────────────────────────────
const aiApi = {
  generateScreen:  (description: string, projectContext: string) =>
    ipcRenderer.invoke('ai:generateScreen', description, projectContext),
  generateService: (description: string, graphContext: string) =>
    ipcRenderer.invoke('ai:generateService', description, graphContext),
  chat:            (messages: object[], projectContext: string) =>
    ipcRenderer.invoke('ai:chat', messages, projectContext),
  explainCode:     (code: string) =>
    ipcRenderer.invoke('ai:explainCode', code),

  // Streaming token subscription
  onToken: (callback: (token: string) => void) => {
    ipcRenderer.on('ai:token', (_event, token) => callback(token))
    return () => ipcRenderer.removeAllListeners('ai:token')
  },
}

// ── Component Library API ────────────────────────────────
const componentsApi = {
  save:   (name: string, json: string)  => ipcRenderer.invoke('components:save', name, json),
  list:   ()                            => ipcRenderer.invoke('components:list'),
  delete: (name: string)                => ipcRenderer.invoke('components:delete', name),
}

// ── Secrets API (OS-encrypted via safeStorage) ───────────
const secretsApi = {
  set:    (key: string, value: string) => ipcRenderer.invoke('secrets:set', key, value),
  get:    (key: string)                => ipcRenderer.invoke('secrets:get', key),
  delete: (key: string)                => ipcRenderer.invoke('secrets:delete', key),
}

// ── Platform Info ────────────────────────────────────────
const platformApi = {
  os:      process.platform,
  version: process.versions.electron,
}

// ── Expose to renderer ───────────────────────────────────
contextBridge.exposeInMainWorld('flutterForge', {
  fs:         fsApi,
  project:    projectApi,
  codegen:    codegenApi,
  ai:         aiApi,
  components: componentsApi,
  secrets:    secretsApi,
  platform:   platformApi,
})

// ── TypeScript type declaration (for renderer) ───────────
export type FlutterForgeAPI = {
  fs:         typeof fsApi
  project:    typeof projectApi
  codegen:    typeof codegenApi
  ai:         typeof aiApi
  components: typeof componentsApi
  secrets:    typeof secretsApi
  platform:   typeof platformApi
}
