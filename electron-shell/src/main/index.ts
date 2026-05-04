import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron'
import { join, resolve } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

interface CodegenRequest {
  type: 'flutter-app' | 'microservice' | 'service-graph'
  payload: string   // JSON string
  outputDir: string
}

interface CodegenResponse {
  success: boolean
  files?: string[]
  error?: string
}

interface ProjectFile {
  path: string
  name: string
  lastModified: number
}

// ─────────────────────────────────────────────────────────
// WINDOW MANAGEMENT
// ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let codegenProcess: ChildProcess | null = null

const CODEGEN_JAR = resolve(
  app.getAppPath(),
  'resources',
  'codegen-engine.jar'
)
const CODEGEN_PORT = 9876

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: join(__dirname, '../../resources/icon.png'),
  })

  // Load Vite dev server in dev, built files in prod
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (process.env.NODE_ENV === 'development') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─────────────────────────────────────────────────────────
// CODEGEN ENGINE — Java Spring Boot sidecar
// ─────────────────────────────────────────────────────────

async function startCodegenEngine(): Promise<void> {
  if (!existsSync(CODEGEN_JAR)) {
    console.warn('Codegen JAR not found at', CODEGEN_JAR, '— AI codegen will be unavailable')
    return
  }

  console.log('Starting Appzillon-New codegen engine...')

  codegenProcess = spawn('java', [
    '-jar', CODEGEN_JAR,
    '--server.port=' + CODEGEN_PORT,
    '--spring.profiles.active=ide',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  codegenProcess.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim()
    console.log('[CodegenEngine]', line)
    // Signal renderer when engine is ready
    if (line.includes('Started FlutterForgeApplication')) {
      mainWindow?.webContents.send('codegen:ready')
    }
  })

  codegenProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[CodegenEngine ERROR]', data.toString().trim())
  })

  codegenProcess.on('exit', (code) => {
    console.log('[CodegenEngine] Exited with code', code)
    codegenProcess = null
  })
}

function stopCodegenEngine(): void {
  if (codegenProcess) {
    codegenProcess.kill('SIGTERM')
    codegenProcess = null
  }
}

// ─────────────────────────────────────────────────────────
// IPC HANDLERS — File system
// ─────────────────────────────────────────────────────────

// Open project JSON from filesystem
ipcMain.handle('fs:openProject', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Open Appzillon-New Project',
    filters: [{ name: 'Appzillon-New Project', extensions: ['ffproj', 'json'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const content = await readFile(result.filePaths[0], 'utf-8')
  return content
})

// Save project JSON to filesystem
ipcMain.handle('fs:saveProject', async (_, projectJson: string, filePath?: string): Promise<string | null> => {
  let targetPath = filePath

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Appzillon-New Project',
      filters: [{ name: 'Appzillon-New Project', extensions: ['ffproj'] }],
      defaultPath: 'my-project.ffproj',
    })
    if (result.canceled || !result.filePath) return null
    targetPath = result.filePath
  }

  await writeFile(targetPath, projectJson, 'utf-8')
  return targetPath
})

// Read project JSON from known path (auto-save)
ipcMain.handle('fs:readFile', async (_, filePath: string): Promise<string> => {
  return readFile(filePath, 'utf-8')
})

// Write file (for auto-save)
ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string): Promise<void> => {
  await mkdir(resolve(filePath, '..'), { recursive: true })
  await writeFile(filePath, content, 'utf-8')
})

// Write binary file from base64 data URL (e.g. "data:image/png;base64,iVBOR...")
// Used to persist app icon and splash image to the .appzillon project folder.
ipcMain.handle('fs:writeFileBase64', async (_, filePath: string, dataUrl: string): Promise<void> => {
  await mkdir(resolve(filePath, '..'), { recursive: true })
  // Strip the "data:<mime>;base64," prefix, decode to raw bytes
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  await writeFile(filePath, Buffer.from(base64, 'base64'))
})

// Read binary file and return as base64 data URL
// Used to restore icon/splash when reopening a project.
ipcMain.handle('fs:readFileBase64', async (_, filePath: string, mimeType = 'image/png'): Promise<string> => {
  const buf = await readFile(filePath)
  return `data:${mimeType};base64,` + buf.toString('base64')
})

// List recent projects from user data dir
ipcMain.handle('fs:listRecentProjects', async (): Promise<ProjectFile[]> => {
  const projectsDir = join(app.getPath('userData'), 'projects')
  if (!existsSync(projectsDir)) return []

  const files = await readdir(projectsDir)
  const results: ProjectFile[] = []

  for (const file of files.filter(f => f.endsWith('.ffproj'))) {
    const fullPath = join(projectsDir, file)
    const stats = await stat(fullPath)
    results.push({ path: fullPath, name: file.replace('.ffproj', ''), lastModified: stats.mtimeMs })
  }

  return results.sort((a, b) => b.lastModified - a.lastModified).slice(0, 10)
})

// Choose output directory for code generation
ipcMain.handle('fs:chooseOutputDir', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Choose Output Directory',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// Open directory in OS file explorer
ipcMain.handle('fs:openInExplorer', async (_, dirPath: string): Promise<void> => {
  await shell.openPath(dirPath)
})

// ─────────────────────────────────────────────────────────
// IPC HANDLERS — Component Library (IDE-level, userData)
//
//  userData/appzillon-components/
//    BankCard.azcomp
//    LoginForm.azcomp
//    ...
// ─────────────────────────────────────────────────────────

function getComponentsDir(): string {
  return join(app.getPath('userData'), 'appzillon-components')
}

// Save (or overwrite) a single .azcomp file
ipcMain.handle('components:save', async (_, name: string, json: string): Promise<void> => {
  const dir = getComponentsDir()
  await mkdir(dir, { recursive: true })
  const safe = name.replace(/[^a-zA-Z0-9_\-]/g, '_')
  await writeFile(join(dir, safe + '.azcomp'), json, 'utf-8')
})

// List all .azcomp files — returns array of { name, json }
ipcMain.handle('components:list', async (): Promise<{ name: string; json: string }[]> => {
  const dir = getComponentsDir()
  if (!existsSync(dir)) return []
  const files = (await readdir(dir)).filter(f => f.endsWith('.azcomp'))
  const results: { name: string; json: string }[] = []
  for (const file of files) {
    try {
      const json = await readFile(join(dir, file), 'utf-8')
      results.push({ name: file.replace('.azcomp', ''), json })
    } catch { /* skip corrupt files */ }
  }
  return results
})

// Delete a single .azcomp file by name
ipcMain.handle('components:delete', async (_, name: string): Promise<void> => {
  const safe = name.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const filePath = join(getComponentsDir(), safe + '.azcomp')
  if (existsSync(filePath)) {
    const { unlink } = await import('fs/promises')
    await unlink(filePath)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC HANDLERS — Secrets (IDE-level, OS-encrypted via safeStorage)
//
//  Stores arbitrary key/value secrets using Electron safeStorage.
//  On Windows: DPAPI. On macOS: Keychain. On Linux: Secret Service / libsecret.
//  Falls back to plain userData file if safeStorage is unavailable.
//
//  userData/appzillon-secrets/
//    figma_token.enc   ← encrypted binary
//    ...
// ─────────────────────────────────────────────────────────────────────────────

function getSecretsDir(): string {
  return join(app.getPath('userData'), 'appzillon-secrets')
}

function secretPath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_\-]/g, '_')
  return join(getSecretsDir(), safe + '.enc')
}

// Save a secret — encrypted if safeStorage is available, else plain
ipcMain.handle('secrets:set', async (_, key: string, value: string): Promise<void> => {
  await mkdir(getSecretsDir(), { recursive: true })
  if (safeStorage.isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(value)
    await writeFile(secretPath(key), buf)
  } else {
    // Fallback: base64 obfuscation (not encrypted, but not plain text)
    await writeFile(secretPath(key), Buffer.from(value, 'utf-8').toString('base64'), 'utf-8')
  }
})

// Read a secret — returns null if not found
ipcMain.handle('secrets:get', async (_, key: string): Promise<string | null> => {
  const p = secretPath(key)
  if (!existsSync(p)) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = await readFile(p)
      return safeStorage.decryptString(buf)
    } else {
      const b64 = await readFile(p, 'utf-8')
      return Buffer.from(b64, 'base64').toString('utf-8')
    }
  } catch { return null }
})

// Delete a secret
ipcMain.handle('secrets:delete', async (_, key: string): Promise<void> => {
  const p = secretPath(key)
  if (existsSync(p)) {
    const { unlink } = await import('fs/promises')
    await unlink(p)
  }
})

// ─────────────────────────────────────────────────────────
// IPC HANDLERS — Code Generation (proxied to Java engine)
// ─────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────
// FOLDER-BASED PROJECT — NEW STRUCTURE
//
//  my-app.appzillon/
//    app.json                  ← project meta, theme, platforms
//    screens/
//      LoginScreen/
//        screen.json           ← widget tree
//        login_screen.dart     ← business logic
//      DashboardScreen/
//        screen.json
//        dashboard_screen.dart
//    shared/
//      app_constants.dart
//      collection_helpers.dart
//    services/
//      auth-service.json
//    assets/
//      icon/icon.png
//      splash/splash.png
//      images/logo.png
//    config/
//      android.json
//      ios.json
//      environments.json
//    data/
//      KendraResponse.json
//      loan_types.json
// ─────────────────────────────────────────────────────────

ipcMain.handle('project:chooseFolder', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Open Appzillon Project Folder',
    properties: ['openDirectory'],
    buttonLabel: 'Open Project',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('project:chooseSaveFolder', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Choose where to save the project',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Save Here',
  })
  return result.canceled ? null : result.filePaths[0]
})

// Read a full .appzillon project folder
ipcMain.handle('project:openFolder', async (_, folderPath: string) => {
  try {
    const appJsonPath = join(folderPath, 'app.json')
    if (!existsSync(appJsonPath)) return { error: 'Not a valid .appzillon project (missing app.json)' }

    const appJson = JSON.parse(await readFile(appJsonPath, 'utf-8'))

    // Read screens - each subfolder has screen.json + .dart
    const screens: Record<string, { screenJson: any; dartCode?: string }> = {}
    const screensDir = join(folderPath, 'screens')
    if (existsSync(screensDir)) {
      const screenFolders = await readdir(screensDir, { withFileTypes: true })
      for (const entry of screenFolders.filter(e => e.isDirectory())) {
        const screenDir = join(screensDir, entry.name)
        const screenJsonPath = join(screenDir, 'screen.json')
        if (existsSync(screenJsonPath)) {
          const screenJson = JSON.parse(await readFile(screenJsonPath, 'utf-8'))
          // Find .dart file
          const files = await readdir(screenDir)
          const dartFile = files.find(f => f.endsWith('.dart'))
          const dartCode = dartFile ? await readFile(join(screenDir, dartFile), 'utf-8') : undefined
          screens[entry.name] = { screenJson, dartCode }
        }
      }
    }

    // Read shared dart files
    const sharedFiles: { filename: string; content: string }[] = []
    const sharedDir = join(folderPath, 'shared')
    if (existsSync(sharedDir)) {
      const files = await readdir(sharedDir)
      for (const f of files.filter(f => f.endsWith('.dart') || f.endsWith('.java'))) {
        sharedFiles.push({ filename: f, content: await readFile(join(sharedDir, f), 'utf-8') })
      }
    }

    // Read services
    const services: { filename: string; content: string }[] = []
    const servicesDir = join(folderPath, 'services')
    if (existsSync(servicesDir)) {
      const files = await readdir(servicesDir)
      for (const f of files) {
        services.push({ filename: f, content: await readFile(join(servicesDir, f), 'utf-8') })
      }
    }

    // Read assets (binary → base64)
    const assets: { relativePath: string; dataUrl: string }[] = []
    const assetsDir = join(folderPath, 'assets')
    if (existsSync(assetsDir)) {
      await collectBinaryFiles(assetsDir, assetsDir, assets)
    }

    // Read config
    const config: Record<string, any> = {}
    const configDir = join(folderPath, 'config')
    if (existsSync(configDir)) {
      const files = await readdir(configDir)
      for (const f of files.filter(f => f.endsWith('.json'))) {
        config[f.replace('.json','')] = JSON.parse(await readFile(join(configDir, f), 'utf-8'))
      }
    }

    // Read data files
    const dataFiles: { filename: string; content: any }[] = []
    const dataDir = join(folderPath, 'data')
    if (existsSync(dataDir)) {
      const files = await readdir(dataDir)
      for (const f of files.filter(f => f.endsWith('.json') || f.endsWith('.dart'))) {
        const raw = await readFile(join(dataDir, f), 'utf-8')
        dataFiles.push({ filename: f, content: f.endsWith('.json') ? JSON.parse(raw) : raw })
      }
    }

    return { appJson, screens, sharedFiles, services, assets, config, dataFiles, folderPath }
  } catch (e: any) {
    console.error('project:openFolder error:', e)
    return { error: e.message }
  }
})

// Save entire project to folder structure
ipcMain.handle('project:saveFolder', async (_, req: {
  folderPath: string
  appJson: any
  screens: { screenName: string; screenJson: any; dartCode?: string; dartFilename?: string }[]
  sharedFiles: { filename: string; content: string }[]
  services: { filename: string; content: string }[]
  assets: { relativePath: string; dataUrl: string }[]
  config: { filename: string; content: any }[]
  dataFiles: { filename: string; content: string }[]
}) => {
  try {
    const { folderPath, appJson, screens, sharedFiles, services, assets, config, dataFiles } = req

    // Create folder structure
    const dirs = ['screens', 'shared', 'services', 'assets/icon', 'assets/splash', 'assets/images', 'assets/fonts', 'config', 'data']
    for (const d of dirs) await mkdir(join(folderPath, d), { recursive: true })

    // app.json
    await writeFile(join(folderPath, 'app.json'), JSON.stringify(appJson, null, 2), 'utf-8')

    // Screens - each in own subfolder
    for (const screen of screens) {
      const screenDir = join(folderPath, 'screens', screen.screenName)
      await mkdir(screenDir, { recursive: true })
      await writeFile(join(screenDir, 'screen.json'), JSON.stringify(screen.screenJson, null, 2), 'utf-8')
      if (screen.dartCode && screen.dartFilename) {
        await writeFile(join(screenDir, screen.dartFilename), screen.dartCode, 'utf-8')
      }
    }

    // Shared files
    for (const f of sharedFiles) {
      await writeFile(join(folderPath, 'shared', f.filename), f.content, 'utf-8')
    }

    // Services
    for (const f of services) {
      await writeFile(join(folderPath, 'services', f.filename), f.content, 'utf-8')
    }

    // Assets (base64 → binary)
    for (const asset of assets) {
      const fullPath = join(folderPath, 'assets', asset.relativePath)
      await mkdir(resolve(fullPath, '..'), { recursive: true })
      const base64 = asset.dataUrl.replace(/^data:[^;]+;base64,/, '')
      await writeFile(fullPath, Buffer.from(base64, 'base64'))
    }

    // Config files
    for (const f of config) {
      const content = typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2)
      await writeFile(join(folderPath, 'config', f.filename), content, 'utf-8')
    }

    // Data files
    for (const f of dataFiles) {
      await writeFile(join(folderPath, 'data', f.filename), f.content, 'utf-8')
    }

    return { success: true, folderPath }
  } catch (e: any) {
    console.error('project:saveFolder error:', e)
    return { success: false, error: e.message }
  }
})

// Auto-save a single screen (called on every change when project is open)
ipcMain.handle('project:saveScreen', async (_, req: {
  folderPath: string
  screenName: string
  screenJson: any
  dartCode?: string
  dartFilename?: string
}) => {
  try {
    const screenDir = join(req.folderPath, 'screens', req.screenName)
    await mkdir(screenDir, { recursive: true })
    await writeFile(join(screenDir, 'screen.json'), JSON.stringify(req.screenJson, null, 2), 'utf-8')
    if (req.dartCode && req.dartFilename) {
      await writeFile(join(screenDir, req.dartFilename), req.dartCode, 'utf-8')
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

// Auto-save app.json (called when theme/meta changes)
ipcMain.handle('project:saveAppJson', async (_, folderPath: string, appJson: any) => {
  try {
    await writeFile(join(folderPath, 'app.json'), JSON.stringify(appJson, null, 2), 'utf-8')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

async function collectBinaryFiles(
  baseDir: string, currentDir: string,
  results: { relativePath: string; dataUrl: string }[]
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await collectBinaryFiles(baseDir, fullPath, results)
    } else if (/\.(png|jpg|jpeg|svg|webp|gif|ttf|otf|woff|woff2)$/i.test(entry.name)) {
      const relativePath = fullPath.substring(baseDir.length + 1).replace(/\\/g, '/')
      const ext = entry.name.split('.').pop()?.toLowerCase() || 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png'
      const buf = await readFile(fullPath)
      results.push({ relativePath, dataUrl: `data:${mime};base64,${buf.toString('base64')}` })
    }
  }
}

ipcMain.handle('codegen:generate', async (_, request: CodegenRequest): Promise<CodegenResponse> => {
  if (!codegenProcess) {
    return { success: false, error: 'Codegen engine not running. Restart the IDE.' }
  }

  const endpointMap: Record<string, string> = {
    'flutter-app':    '/api/codegen/flutter-app',
    'microservice':   '/api/codegen/microservice',
    'service-graph':  '/api/codegen/service-graph',
  }

  const endpoint = endpointMap[request.type]
  if (!endpoint) {
    return { success: false, error: 'Unknown generation type: ' + request.type }
  }

  try {
    const response = await fetch(`http://localhost:${CODEGEN_PORT}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: request.payload, outputDir: request.outputDir }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { success: false, error: err }
    }

    const result = await response.json() as { files: string[] }
    return { success: true, files: result.files }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Check codegen engine health
ipcMain.handle('codegen:health', async (): Promise<boolean> => {
  try {
    const res = await fetch(`http://localhost:${CODEGEN_PORT}/actuator/health`)
    return res.ok
  } catch {
    return false
  }
})

// ─────────────────────────────────────────────────────────
// IPC HANDLERS — AI (streamed via codegen engine SSE)
// ─────────────────────────────────────────────────────────

ipcMain.handle('ai:generateScreen', async (event, description: string, projectContext: string): Promise<string> => {
  try {
    const response = await fetch(`http://localhost:${CODEGEN_PORT}/api/ai/generate-screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, projectContext }),
    })

    if (!response.ok) throw new Error(await response.text())

    // For streaming, use SSE — send tokens to renderer as they arrive
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        // Forward streaming tokens to renderer
        event.sender.send('ai:token', chunk)
      }
    }

    return fullText
  } catch (error) {
    throw new Error('AI generation failed: ' + String(error))
  }
})

ipcMain.handle('ai:generateService', async (event, description: string, graphContext: string): Promise<string> => {
  try {
    const response = await fetch(`http://localhost:${CODEGEN_PORT}/api/ai/generate-service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, graphContext }),
    })
    if (!response.ok) throw new Error(await response.text())

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        event.sender.send('ai:token', chunk)
      }
    }
    return fullText
  } catch (error) {
    throw new Error('Service generation failed: ' + String(error))
  }
})

ipcMain.handle('ai:chat', async (event, messages: object[], projectContext: string): Promise<string> => {
  try {
    const response = await fetch(`http://localhost:${CODEGEN_PORT}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, projectContext }),
    })
    if (!response.ok) throw new Error(await response.text())

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullText += chunk
        event.sender.send('ai:token', chunk)
      }
    }
    return fullText
  } catch (error) {
    throw new Error('Chat failed: ' + String(error))
  }
})

ipcMain.handle('ai:explainCode', async (_, code: string): Promise<string> => {
  const response = await fetch(`http://localhost:${CODEGEN_PORT}/api/ai/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json() as { explanation: string }
  return data.explanation
})

// ─────────────────────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await startCodegenEngine()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  stopCodegenEngine()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopCodegenEngine()
})
