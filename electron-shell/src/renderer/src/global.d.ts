// Type declarations for the FlutterForge preload API
// exposed via contextBridge as window.flutterForge

interface FlutterForgeAPI {
  fs: {
    openProject:        ()                              => Promise<string | null>
    saveProject:        (json: string, path?: string)   => Promise<string | null>
    readFile:           (path: string)                  => Promise<string>
    writeFile:          (path: string, content: string) => Promise<void>
    listRecentProjects: ()                              => Promise<Array<{ path: string; name: string; lastModified: number }>>
    chooseOutputDir:    ()                              => Promise<string | null>
    openInExplorer:     (path: string)                  => Promise<void>
  }
  codegen: {
    generate: (request: { type: string; payload: string; outputDir: string }) =>
      Promise<{ success: boolean; files?: string[]; error?: string }>
    health:   ()                => Promise<boolean>
    onReady:  (cb: () => void)  => () => void
  }
  ai: {
    generateScreen:  (description: string, projectContext: string) => Promise<string>
    generateService: (description: string, graphContext: string)   => Promise<string>
    chat:            (messages: object[], projectContext: string)   => Promise<string>
    explainCode:     (code: string)                                 => Promise<string>
    onToken:         (cb: (token: string) => void)                  => () => void
  }
  platform: {
    os:      string
    version: string
  }
}

declare global {
  interface Window {
    flutterForge: FlutterForgeAPI
  }
}

export {}
