// ============================================================
// Figma API — fetch layer
// All REST calls go here. Renderer-side fetch — CORS allowed
// via X-Figma-Token header (no proxy needed).
// ============================================================

import type { FigmaFile, FigmaNode } from './figma.types'

const BASE = 'https://api.figma.com/v1'

export interface FrameEntry {
  id:       string
  name:     string
  page:     string
  selected: boolean
}

// ── helpers ──────────────────────────────────────────────────

export function parseFileKey(url: string): string | null {
  const m = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

async function figmaFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': token.trim() },
  })
  if (res.status === 403) throw new Error('Invalid token or no access to this file. Check your Personal Access Token.')
  if (res.status === 404) throw new Error('File not found. Check the Figma URL.')
  if (!res.ok)            throw new Error(`Figma API error: ${res.status} ${res.statusText}`)
  return res.json()
}

// ── Step 1: lightweight frame list ───────────────────────────
// depth=2 gives page → frame children. We also recurse into
// SECTION nodes (depth=2 returns them but not their frame children,
// so we do a targeted depth=3 call when sections are found).

export async function fetchFrameList(key: string, token: string): Promise<{ file: FigmaFile; frames: FrameEntry[] }> {
  const data: FigmaFile = await figmaFetch(`/files/${key}?depth=2`, token)

  const frames: FrameEntry[] = []

  for (const page of data.document.children) {
    if (page.type !== 'CANVAS') continue

    for (const child of (page.children ?? [])) {
      if (child.type === 'FRAME' || child.type === 'COMPONENT') {
        frames.push({ id: child.id, name: child.name, page: page.name, selected: true })
      }
      // SECTION wraps frames — recurse one more level
      if (child.type === 'SECTION') {
        for (const inner of (child.children ?? [])) {
          if (inner.type === 'FRAME' || inner.type === 'COMPONENT') {
            frames.push({ id: inner.id, name: inner.name, page: `${page.name} / ${child.name}`, selected: true })
          }
        }
      }
    }
  }

  return { file: data, frames }
}

// ── Step 2: full node data for selected frames ───────────────
// IMPORTANT: We always fetch the complete file without ?ids= param.
// The Figma GET /files/:key?ids= endpoint returns a DIFFERENT response
// shape: { nodes: { [id]: { document: FigmaNode } } } — NOT the standard
// FigmaFile shape { document: FigmaDocument }. Using ?ids= breaks
// findFrameNodes which walks file.document.children. Always fetch the
// full file to get the correct structure and complete node tree.

export async function fetchFullFrames(key: string, token: string, _frameIds: string[]): Promise<FigmaFile> {
  return figmaFetch(`/files/${key}`, token)
}

// ── Node finder ───────────────────────────────────────────────
// Given a full file and a list of frame IDs, extract those
// FigmaNode objects from anywhere in the document tree.
// Handles frames nested inside SECTION nodes at any depth.

export function findFrameNodes(file: FigmaFile, ids: Set<string>): FigmaNode[] {
  const found: FigmaNode[] = []

  function walk(node: FigmaNode) {
    if (ids.has(node.id)) {
      found.push(node)
      return // found it — don't recurse INTO the frame (it's the root we want)
    }
    for (const child of (node.children ?? [])) {
      walk(child)
    }
  }

  // Walk every page in the document
  for (const page of (file.document?.children ?? [])) {
    for (const topNode of (page.children ?? [])) {
      walk(topNode as FigmaNode)
    }
  }

  return found
}
