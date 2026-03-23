/**
 * useIPC — typed hook for the FlutterForge preload API.
 * Provides safe access to fs, codegen, and AI functions
 * with fallback stubs when running outside Electron.
 */
export function useIPC() {
  const api = typeof window !== 'undefined'
    ? window.flutterForge
    : null

  const isElectron = !!api

  return { api, isElectron }
}

/** Shorthand hooks */
export function useFS()      { return useIPC().api?.fs }
export function useCodegen() { return useIPC().api?.codegen }
export function useAI()      { return useIPC().api?.ai }
