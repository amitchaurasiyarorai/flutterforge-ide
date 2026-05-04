import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import { useProjectStore } from '../../store/project.store'

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  type:      CopilotMode
  streaming: boolean
  error:     boolean
  timestamp: Date
  imagePreview?: string  // base64 data URL for display
}

type CopilotMode = 'chat' | 'screen' | 'screenshot' | 'service' | 'explain' | 'review' | 'tests'
interface Props { engineUrl: string }

interface AttachedImage {
  base64: string        // raw base64 without data: prefix
  mediaType: string     // e.g. "image/png"
  dataUrl: string       // full data URL for preview
  name: string          // filename
}

// ─────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────

export default function AICopilot({ engineUrl }: Props): JSX.Element {
  const [messages,        setMessages]        = useState<Message[]>([WELCOME_MSG])
  const [input,           setInput]           = useState('')
  const [mode,            setMode]            = useState<CopilotMode>('chat')
  const [streaming,       setStreaming]       = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [attachedImage,   setAttachedImage]   = useState<AttachedImage | null>(null)

  const scrollRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const abortRef     = useRef<AbortController | null>(null)
  const messagesRef  = useRef<Message[]>([WELCOME_MSG])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Keep a ref to engineUrl so closures always have the latest value
  const engineUrlRef = useRef(engineUrl)
  useEffect(() => { engineUrlRef.current = engineUrl }, [engineUrl])

  const { project, setScreenFromAI, activeScreenId } = useCanvasStore()
  const { services: microservices, addService }       = useProjectStore()

  // Keep messagesRef in sync + auto-scroll
  useEffect(() => {
    messagesRef.current = messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const buildProjectContext = useCallback((): string => {
    if (!project) return 'No project loaded'
    const screenNames = Object.values(project.screens).map(s => s.name).join(', ')
    const svcNames    = Object.values(project.services || {}).map(s => s.name).join(', ')
    return JSON.stringify({
      projectName: project.name,
      packageName: project.packageName,
      screens:     screenNames || 'none',
      services:    svcNames    || 'none',
      theme:       project.theme,
    }, null, 2)
  }, [project])

  // ─── Message helpers ─────────────────────────────────

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>): string => {
    const id = 'msg_' + Date.now() + Math.random().toString(36).slice(2)
    setMessages(prev => [...prev, { ...msg, id, timestamp: new Date() }])
    return id
  }, [])

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }, [])

  // ─── SSE streaming ───────────────────────────────────
  // FIX: uses engineUrlRef.current so it's always fresh

  const streamSSE = useCallback(async (
    endpoint: string,
    body: object,
    onToken: (token: string) => void,
    onDone:  (full:  string) => void
  ) => {
    const res = await fetch(engineUrlRef.current + endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  abortRef.current?.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errText}`)
    }

    const reader  = res.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''
    let buf  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })

      // Split on double newline = SSE event boundary
      const events = buf.split('\n\n')
      buf = events.pop() ?? ''

      for (const event of events) {
        for (const line of event.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (!data) continue
          if (data === '[DONE]')          { onDone(full); return }
          if (data.startsWith('[ERROR]'))  throw new Error(data.slice(7).trim())
          if (data === '[PING]')           continue
          const token = data.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
          full += token
          onToken(token)
        }
      }
    }
    onDone(full)
  }, [])   // no deps — uses refs

  // ─── AI call implementations ─────────────────────────
  // FIX: all defined as useCallback BEFORE sendMessage
  // so sendMessage can safely reference them in its deps

  const streamChat = useCallback(async (content: string, assistantId: string) => {
    const ctx  = buildProjectContext()
    // Use messagesRef to read current messages WITHOUT triggering setMessages
    const hist = messagesRef.current
      .filter(m => !m.streaming && !m.error && m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }))
    hist.push({ role: 'user', content })

    let full = ''
    await streamSSE(
      '/api/ai/chat',
      { messages: hist, projectContext: ctx },
      token => {
        full += token
        updateMessage(assistantId, { content: full })
      },
      () => {}
    )
  }, [buildProjectContext, streamSSE, updateMessage])

  const runGenerateScreen = useCallback(async (description: string, assistantId: string) => {
    let full = ''
    await streamSSE(
      '/api/ai/generate-screen',
      { description, projectContext: buildProjectContext() },
      token => {
        full += token
        updateMessage(assistantId, { content: full })
      },
      completed => {
        try {
          const clean = completed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const screenDef = JSON.parse(clean)
          if (screenDef.id && screenDef.widgets && activeScreenId) {
            setScreenFromAI(activeScreenId, screenDef)
            updateMessage(assistantId, {
              content: completed + '\n\n✓ Applied to canvas — check the Canvas tab!',
            })
          }
        } catch { /* leave as text */ }
      }
    )
  }, [buildProjectContext, streamSSE, updateMessage, activeScreenId, setScreenFromAI])

  // ── Screenshot → Screen ──────────────────────────────────────────────────
  const runGenerateScreenFromImage = useCallback(async (
    image: AttachedImage, description: string, assistantId: string
  ) => {
    let full = ''
    await streamSSE(
      '/api/ai/generate-screen-from-image',
      {
        imageBase64:    image.base64,
        mediaType:      image.mediaType,
        description:    description || '',
        projectContext: buildProjectContext(),
      },
      token => {
        full += token
        updateMessage(assistantId, { content: full })
      },
      completed => {
        try {
          const clean = completed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const screenDef = JSON.parse(clean)
          if (screenDef.id && screenDef.widgets && activeScreenId) {
            setScreenFromAI(activeScreenId, screenDef)
            updateMessage(assistantId, {
              content: completed + '\n\n✓ Applied to canvas — check the Canvas tab!',
            })
          }
        } catch { /* leave as text — may be analysis rather than JSON */ }
      }
    )
  }, [buildProjectContext, streamSSE, updateMessage, activeScreenId, setScreenFromAI])

  // ── File attachment handler ───────────────────────────────────────────────
  const handleFileAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please attach an image file (PNG, JPG, WebP, GIF)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip "data:image/png;base64," prefix to get raw base64
      const base64 = dataUrl.split(',')[1]
      setAttachedImage({ base64, mediaType: file.type, dataUrl, name: file.name })
      // Auto-switch to screenshot mode
      setMode('screenshot')
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-attached
    e.target.value = ''
  }, [])

  const runGenerateService = useCallback(async (description: string, assistantId: string) => {
    let full = ''
    await streamSSE(
      '/api/ai/generate-service',
      { description, graphContext: JSON.stringify(microservices) },
      token => {
        full += token
        updateMessage(assistantId, { content: full })
      },
      completed => {
        try {
          const clean  = completed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const svcDef = JSON.parse(clean)
          if (svcDef.name && svcDef.port) {
            addService(svcDef.name, svcDef.port)
            updateMessage(assistantId, {
              content: completed + '\n\n✓ Added to Services tab!',
            })
          }
        } catch { /* leave as text */ }
      }
    )
  }, [streamSSE, updateMessage, microservices, addService])

  const runExplainCode = useCallback(async (code: string, assistantId: string) => {
    try {
      const res  = await fetch(engineUrlRef.current + '/api/ai/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      updateMessage(assistantId, { content: data.explanation || data.error || 'No explanation returned.' })
    } catch (e: any) {
      updateMessage(assistantId, { content: `Error: ${e.message}`, error: true })
    }
  }, [updateMessage])

  const runReviewCode = useCallback(async (code: string, assistantId: string) => {
    try {
      const res  = await fetch(engineUrlRef.current + '/api/ai/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const review = await res.text()
      let formatted = review
      try { formatted = JSON.parse(review)?.review || review } catch { /* plain text */ }
      updateMessage(assistantId, { content: formatted })
    } catch (e: any) {
      updateMessage(assistantId, { content: `Error: ${e.message}`, error: true })
    }
  }, [updateMessage])

  const runGenerateTests = useCallback(async (code: string, assistantId: string) => {
    try {
      const res  = await fetch(engineUrlRef.current + '/api/ai/generate-tests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, screenName: 'CurrentScreen' }),
      })
      const data = await res.json()
      updateMessage(assistantId, { content: data.tests || data.error || '' })
    } catch (e: any) {
      updateMessage(assistantId, { content: `Error: ${e.message}`, error: true })
    }
  }, [updateMessage])

  // ─── Send message ────────────────────────────────────
  // FIX: all AI functions are now in deps array — no stale closures

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    // For screenshot mode, allow sending with just an image (no text required)
    if (mode !== 'screenshot' && !content) return
    if (streaming) return

    setInput('')
    setShowSuggestions(false)

    // User message shows image name + optional text
    const userContent = mode === 'screenshot' && attachedImage
      ? `📎 ${attachedImage.name}${content ? '\n' + content : ''}`
      : content

    addMessage({ role: 'user', content: userContent, type: mode, streaming: false, error: false,
      imagePreview: mode === 'screenshot' && attachedImage ? attachedImage.dataUrl : undefined })

    const assistantId = addMessage({
      role: 'assistant', content: '', type: mode, streaming: true, error: false,
    })

    setStreaming(true)
    abortRef.current = new AbortController()

    // Capture and clear image before async call
    const imageSnapshot = attachedImage
    if (attachedImage) setAttachedImage(null)

    try {
      if      (mode === 'chat')       await streamChat(content, assistantId)
      else if (mode === 'screen')     await runGenerateScreen(content, assistantId)
      else if (mode === 'screenshot' && imageSnapshot)
                                      await runGenerateScreenFromImage(imageSnapshot, content, assistantId)
      else if (mode === 'screenshot' && !imageSnapshot) {
        updateMessage(assistantId, { content: '⚠ Please attach a screenshot image first using the 📎 button.', error: true })
      }
      else if (mode === 'service')    await runGenerateService(content, assistantId)
      else if (mode === 'explain')    await runExplainCode(content, assistantId)
      else if (mode === 'review')     await runReviewCode(content, assistantId)
      else if (mode === 'tests')      await runGenerateTests(content, assistantId)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateMessage(assistantId, {
          content:   `❌ Error: ${err.message}\n\nMake sure the engine is running on ${engineUrlRef.current}`,
          streaming: false,
          error:     true,
        })
      }
    } finally {
      setStreaming(false)
      updateMessage(assistantId, { streaming: false })
    }
  }, [
    input, mode, streaming, attachedImage,
    addMessage, updateMessage,
    streamChat, runGenerateScreen, runGenerateScreenFromImage, runGenerateService,
    runExplainCode, runReviewCode, runGenerateTests,
  ])

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#e0d7ff' }}>AI Copilot</div>
          <div style={{ fontSize:10, color:'#555' }}>Powered by Claude</div>
        </div>
        <button
          onClick={() => { setMessages([WELCOME_MSG]); setShowSuggestions(true) }}
          style={s.clearBtn}>
          ↺ Clear
        </button>
      </div>

      {/* Mode tabs */}
      <div style={s.modeRow}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id as CopilotMode)} style={{
            ...s.modeBtn,
            background:  mode === m.id ? '#1e1a33' : 'transparent',
            color:        mode === m.id ? '#e0d7ff' : '#555',
            borderColor:  mode === m.id ? '#7c5cbf' : '#1e1e2e',
          }} title={m.desc}>
            <span style={{ fontSize:12 }}>{m.icon}</span>
            <span style={{ fontSize:10 }}>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={s.messages}>

        {/* Quick start suggestions */}
        {showSuggestions && mode === 'chat' && (
          <div style={s.suggestions}>
            <div style={{ fontSize:10, color:'#444', marginBottom:8 }}>Quick starts:</div>
            {SUGGESTIONS.map((sg, i) => (
              <button key={i} onClick={() => sendMessage(sg)} style={s.suggestionBtn}>{sg}</button>
            ))}
          </div>
        )}

        {/* Message list */}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming dots */}
        {streaming && (
          <div style={s.streamingDot}>
            <span style={s.dot1}>●</span>
            <span style={s.dot2}>●</span>
            <span style={s.dot3}>●</span>
          </div>
        )}
      </div>

      {/* Mode hint */}
      <div style={s.modeHint}>{MODES.find(m => m.id === mode)?.hint}</div>

      {/* Input */}
      <div style={s.inputRow}>

        {/* Attached image preview */}
        {attachedImage && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
            background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:8, flexShrink:0 }}>
            <img src={attachedImage.dataUrl} alt="attached"
              style={{ width:48, height:36, objectFit:'cover', borderRadius:4,
                border:'1px solid #1e2d3d' }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, color:'#9d7fe8', fontWeight:600, overflow:'hidden',
                textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{attachedImage.name}</div>
              <div style={{ fontSize:10, color:'#555' }}>
                {attachedImage.mediaType} · Screenshot mode active
              </div>
            </div>
            <button onClick={() => setAttachedImage(null)}
              style={{ background:'none', border:'none', color:'#555', cursor:'pointer',
                fontSize:14, padding:'2px 6px', flexShrink:0 }}
              title="Remove image">×</button>
          </div>
        )}

        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder={
            mode === 'screenshot'
              ? attachedImage ? 'Optional: describe what to focus on...' : 'Attach a screenshot then describe what to build...'
              : MODES.find(m => m.id === mode)?.placeholder || 'Ask anything...'
          }
          rows={3}
          style={s.textarea}
          disabled={streaming}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display:'none' }}
          onChange={handleFileAttach}
        />

        <div style={s.inputBtns}>
          {/* Attach image button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            title="Attach screenshot (auto-switches to Screenshot mode)"
            style={{
              padding:'6px 10px', background: attachedImage ? '#1e1a33' : '#0e0e20',
              border:`1px solid ${attachedImage ? '#7c5cbf' : '#22223a'}`,
              borderRadius:6, color: attachedImage ? '#9d7fe8' : '#555',
              cursor:'pointer', fontSize:13, flexShrink:0,
            }}>
            📎
          </button>

          {streaming ? (
            <button onClick={() => abortRef.current?.abort()} style={s.stopBtn}>⊠ Stop</button>
          ) : (
            <button
              onClick={() => sendMessage()}
              disabled={mode === 'screenshot' ? !attachedImage && !input.trim() : !input.trim()}
              style={{
                ...s.sendBtn,
                opacity: (mode === 'screenshot' ? (attachedImage || input.trim()) : input.trim()) ? 1 : 0.4,
              }}>
              ▶ Send
            </button>
          )}
          <span style={{ fontSize:10, color:'#333' }}>⏎ Send · Shift+⏎ Newline</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  const renderContent = (text: string) => {
    const lines = text.split('\n')
    let   inCode = false
    return lines.map((line, i) => {
      if (line.startsWith('```')) {
        inCode = !inCode
        return <div key={i} style={{ height: 4 }} />
      }
      if (inCode || line.startsWith('    ') || line.startsWith('\t')) {
        return (
          <div key={i} style={{ fontFamily:'monospace', fontSize:11, background:'#080813',
            padding:'1px 8px', borderRadius:3, color:'#9cdcfe', whiteSpace:'pre' as const }}>
            {line.replace(/^    /, '')}
          </div>
        )
      }
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      return (
        <div key={i} style={{ marginBottom:2, whiteSpace:'pre-wrap' as const }}>
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} style={{ color:'#e0d7ff' }}>{p.slice(2,-2)}</strong>
              : p
          )}
        </div>
      )
    })
  }

  return (
    <div style={{
      display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom:10, gap:8, alignItems:'flex-start',
    }}>
      {!isUser && <div style={s.avatar}>◆</div>}
      <div style={{
        ...s.bubble,
        background:  isUser ? '#1e1a33' : '#13132a',
        borderColor: isUser ? '#3d3060' : '#2a2a3a',
        maxWidth:    '85%',
      }}>
        {message.type !== 'chat' && !isUser && (
          <div style={s.modeTag}>
            {MODES.find(m => m.id === message.type)?.icon}{' '}
            {MODES.find(m => m.id === message.type)?.label}
          </div>
        )}
        {/* Show attached image preview in user messages */}
        {isUser && message.imagePreview && (
          <img src={message.imagePreview} alt="screenshot"
            style={{ width:'100%', maxWidth:220, borderRadius:6, marginBottom:6,
              border:'1px solid #3d3060', display:'block' }} />
        )}
        <div style={{ fontSize:12, color: message.error ? '#e05252' : '#d4d4d4', lineHeight:1.7 }}>
          {message.content
            ? renderContent(message.content)
            : message.streaming
              ? <span style={{ color:'#555' }}>Thinking...</span>
              : null}
        </div>
        {message.streaming && (
          <span style={{ color:'#7c5cbf', fontSize:16 }}>▌</span>
        )}
      </div>
      {isUser && <div style={s.userAvatar}>U</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const WELCOME_MSG: Message = {
  id: 'welcome', role: 'assistant', type: 'chat',
  streaming: false, error: false, timestamp: new Date(),
  content: 'Hi! I\'m your FlutterForge AI Copilot, powered by Claude.\n\nI can help you:\n• Generate screens from descriptions\n• Design microservices\n• Explain or review generated code\n• Answer Flutter & Spring Boot questions\n\nWhat would you like to build?',
}

const MODES = [
  { id:'chat',       icon:'💬', label:'Chat',       desc:'General assistant',                  placeholder:'Ask anything about Flutter, Spring Boot, architecture...',             hint:'General conversation — ask questions, get advice, discuss architecture.' },
  { id:'screen',     icon:'◈',  label:'Screen',     desc:'Generate Flutter screen from text',  placeholder:'Describe a screen e.g. "A login screen with email and password"',      hint:'Describe a screen → Claude generates the widget tree and applies it to canvas.' },
  { id:'screenshot', icon:'📷', label:'Screenshot', desc:'Generate screen from image',         placeholder:'Attach a screenshot then optionally describe what to focus on...',      hint:'📎 Attach any UI screenshot → Claude analyses it and generates matching Flutter widgets on the canvas.' },
  { id:'service',    icon:'⬢',  label:'Service',    desc:'Generate microservice',              placeholder:'Describe a service e.g. "Auth service with JWT and user roles"',        hint:'Describe a microservice → Claude generates the definition and adds it to Services.' },
  { id:'explain',    icon:'?',  label:'Explain',    desc:'Explain code',                       placeholder:'Paste Dart or Java code to explain...',                                 hint:'Paste any generated code and Claude will explain what it does.' },
  { id:'review',     icon:'✓',  label:'Review',     desc:'Review code for issues',             placeholder:'Paste Dart code to review for issues...',                               hint:'Paste Dart code — Claude checks for null safety, performance, and best practices.' },
  { id:'tests',      icon:'⚙',  label:'Tests',      desc:'Generate widget tests',              placeholder:"Paste a Flutter screen's Dart code to generate tests...",               hint:"Paste a screen's code → Claude generates comprehensive widget tests." },
]

const SUGGESTIONS = [
  'What Flutter widgets should I use for a social feed?',
  'How do I connect my Flutter app to the Spring Boot backend?',
  'Suggest a microservice architecture for an e-commerce app',
  'What Riverpod providers do I need for user authentication?',
  'How do I implement GoRouter with authentication guards?',
]

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:          { display:'flex', flexDirection:'column', height:'100%', background:'#0d0d1a', overflow:'hidden' },
  header:        { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  clearBtn:      { background:'none', border:'1px solid #2a2a3a', borderRadius:6, color:'#555', cursor:'pointer', fontSize:11, padding:'4px 10px', fontFamily:'system-ui,sans-serif' },
  modeRow:       { display:'flex', padding:'6px 8px', gap:4, borderBottom:'1px solid #1e1e2e', flexShrink:0, flexWrap:'wrap' as const },
  modeBtn:       { display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:6, border:'1px solid', cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  messages:      { flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:2 },
  suggestions:   { padding:'12px', background:'#0f0f1e', borderRadius:10, border:'1px solid #1e1e2e', marginBottom:12 },
  suggestionBtn: { display:'block', width:'100%', textAlign:'left' as const, padding:'7px 10px', background:'#13132a', border:'1px solid #2a2a3a', borderRadius:6, color:'#888', cursor:'pointer', fontSize:11, marginBottom:5, fontFamily:'system-ui,sans-serif' },
  streamingDot:  { display:'flex', gap:4, padding:'6px 0', alignItems:'center' },
  dot1:          { color:'#7c5cbf', fontSize:8 },
  dot2:          { color:'#7c5cbf', fontSize:8 },
  dot3:          { color:'#7c5cbf', fontSize:8 },
  modeHint:      { padding:'5px 14px', fontSize:10, color:'#444', borderTop:'1px solid #1e1e2e', flexShrink:0 },
  inputRow:      { padding:'10px 14px', borderTop:'1px solid #1e1e2e', flexShrink:0, display:'flex', flexDirection:'column', gap:6 },
  textarea:      { width:'100%', padding:'9px 12px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:8, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif', resize:'none' as const, lineHeight:1.6 },
  inputBtns:     { display:'flex', alignItems:'center', gap:10 },
  sendBtn:       { padding:'7px 18px', background:'#7c5cbf', border:'none', borderRadius:6, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  stopBtn:       { padding:'7px 14px', background:'#3a1a1a', border:'1px solid #5c1a1a', borderRadius:6, color:'#e05252', fontSize:12, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  avatar:        { width:26, height:26, borderRadius:'50%', background:'#1e1a33', border:'1px solid #3d3060', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#9d7fe8', flexShrink:0 },
  userAvatar:    { width:26, height:26, borderRadius:'50%', background:'#13132a', border:'1px solid #2a2a3a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#666', flexShrink:0 },
  bubble:        { padding:'10px 12px', borderRadius:10, border:'1px solid' },
  modeTag:       { fontSize:9, color:'#555', marginBottom:5 },
}
