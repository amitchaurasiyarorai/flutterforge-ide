import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
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
      preload: join(__dirname, 'preload.js'),
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

  console.log('Starting FlutterForge codegen engine...')

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
    title: 'Open FlutterForge Project',
    filters: [{ name: 'FlutterForge Project', extensions: ['ffproj', 'json'] }],
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
      title: 'Save FlutterForge Project',
      filters: [{ name: 'FlutterForge Project', extensions: ['ffproj'] }],
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
// IPC HANDLERS — Code Generation (proxied to Java engine)
// ─────────────────────────────────────────────────────────

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
