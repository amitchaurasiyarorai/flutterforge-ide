import React, { useState, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import { useIntegrationsStore } from '../../store/integrations.store'
import { useCodeStore } from '../../store/code.store'
import { useUIStore } from '../../store/ui.store'
import type { WidgetNode } from '../../types/widget.schema'
import type {
  WAction, WActionType, WEventType, WEventHandler,
  WActionNavigate, WActionCallApi, WActionShowDialog,
  WActionShowSnackbar, WActionCallCode,
} from '../../types/widget.schema'

// ─────────────────────────────────────────────────────────────────────────────
// WHICH EVENTS APPLY TO WHICH WIDGET TYPES
// ─────────────────────────────────────────────────────────────────────────────

function getAvailableEvents(widgetType: string): { event: WEventType; label: string }[] {
  const t = widgetType
  const events: { event: WEventType; label: string }[] = []

  if (t.includes('ElevatedButton') || t.includes('FilledButton') ||
      t.includes('OutlinedButton') || t.includes('TextButton') ||
      t.includes('IconButton') || t.includes('FloatingActionButton'))
    events.push({ event: 'onPressed', label: 'onPressed — button tapped' })

  if (t.includes('ListTile') || t.includes('GestureDetector') ||
      t.includes('InkWell') || t.includes('Card'))
    events.push({ event: 'onTap', label: 'onTap — item tapped' })

  if (t.includes('ListTile') || t.includes('GestureDetector'))
    events.push({ event: 'onLongPress', label: 'onLongPress — long press' })

  if (t.includes('TextField') || t.includes('TextFormField'))
    events.push(
      { event: 'onChanged',   label: 'onChanged — text changed' },
      { event: 'onSubmitted', label: 'onSubmitted — keyboard submit' }
    )

  if (t.includes('Switch') || t.includes('Checkbox') || t.includes('Slider'))
    events.push({ event: 'onChanged', label: 'onChanged — value changed' })

  // Any widget can have an onTap if nothing else matches
  if (events.length === 0)
    events.push({ event: 'onTap', label: 'onTap — add gesture' })

  return events
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION TYPE METADATA
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_TYPES: { type: WActionType; label: string; color: string; bg: string; desc: string }[] = [
  { type: 'navigate',    label: 'Navigate',     color: '#4a9edd', bg: '#0a1628', desc: 'Go to another screen' },
  { type: 'callApi',     label: 'Call API',      color: '#4caf7d', bg: '#0a1a0f', desc: 'Call an API Interface' },
  { type: 'showDialog',  label: 'Show Dialog',   color: '#c9a227', bg: '#1a1500', desc: 'Show an alert dialog' },
  { type: 'showSnackbar',label: 'Snackbar',      color: '#9d7fe8', bg: '#0f0f1e', desc: 'Show a message bar' },
  { type: 'callCode',    label: 'Custom Code',   color: '#e09b2d', bg: '#1a1200', desc: 'Call a Dart method' },
]

function defaultAction(type: WActionType): WAction {
  switch (type) {
    case 'navigate':     return { type: 'navigate',     navType: 'push', route: '/', screenName: 'Select screen' }
    case 'callApi':      return { type: 'callApi',      interfaceId: '', interfaceName: 'Select interface' }
    case 'showDialog':   return { type: 'showDialog',   title: 'Confirm', message: 'Are you sure?', confirmLabel: 'OK', cancelLabel: 'Cancel' }
    case 'showSnackbar': return { type: 'showSnackbar', message: 'Done!', duration: 3, isError: false }
    case 'callCode':     return { type: 'callCode',     methodName: '_onAction' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL ACTION EDITORS
// ─────────────────────────────────────────────────────────────────────────────

function NavigateEditor({ action, onChange }: { action: WActionNavigate; onChange: (a: WActionNavigate) => void }) {
  const { project } = useCanvasStore()
  const screens = project ? Object.values(project.screens) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={row}>
        <span style={lbl}>Screen</span>
        <select
          value={action.screenId || ''}
          onChange={e => {
            const scr = screens.find(s => s.id === e.target.value)
            onChange({ ...action, screenId: e.target.value, route: scr?.route || '/', screenName: scr?.name })
          }}
          style={sel}>
          <option value="">— select screen —</option>
          {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div style={row}>
        <span style={lbl}>Transition</span>
        <select value={action.navType} onChange={e => onChange({ ...action, navType: e.target.value as any })} style={sel}>
          <option value="push">Push (forward)</option>
          <option value="pushReplacement">Replace (no back)</option>
          <option value="pop">Pop (go back)</option>
          <option value="popUntil">Pop until route</option>
        </select>
      </div>
      {action.route && (
        <div style={{ fontSize: 10, color: '#555', fontFamily: 'monospace', paddingLeft: 2 }}>
          context.go('{action.route}')
        </div>
      )}
    </div>
  )
}

function CallApiEditor({ action, onChange }: { action: WActionCallApi; onChange: (a: WActionCallApi) => void }) {
  const interfaces = useIntegrationsStore(s => s.interfaces)
  const { project } = useCanvasStore()
  const screens = project ? Object.values(project.screens) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={row}>
        <span style={lbl}>Interface</span>
        <select
          value={action.interfaceId}
          onChange={e => {
            const ifc = interfaces.find(i => i.id === e.target.value)
            onChange({ ...action, interfaceId: e.target.value, interfaceName: ifc?.name })
          }}
          style={sel}>
          <option value="">— select interface —</option>
          {interfaces.map(i => (
            <option key={i.id} value={i.id}>{i.method} {i.name}</option>
          ))}
        </select>
      </div>
      {interfaces.length === 0 && (
        <div style={{ fontSize: 10, color: '#c9a227', lineHeight: 1.5 }}>
          No interfaces yet — add one in Data/API → Interfaces tab first.
        </div>
      )}
      <div style={row}>
        <span style={lbl}>Loading var</span>
        <input
          value={action.loadingVar || ''}
          onChange={e => onChange({ ...action, loadingVar: e.target.value })}
          placeholder="e.g. isLoading"
          style={inp}
        />
      </div>
      <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>On success →</div>
      <select
        value={action.onSuccess?.type || ''}
        onChange={e => {
          if (!e.target.value) { onChange({ ...action, onSuccess: undefined }); return }
          if (e.target.value === 'navigate')
            onChange({ ...action, onSuccess: { type: 'navigate', navType: 'pushReplacement', route: '/', screenName: 'Select screen' } })
          if (e.target.value === 'showSnackbar')
            onChange({ ...action, onSuccess: { type: 'showSnackbar', message: 'Success!' } })
        }}
        style={sel}>
        <option value="">Nothing</option>
        <option value="navigate">Navigate to screen</option>
        <option value="showSnackbar">Show Snackbar</option>
      </select>
      {action.onSuccess?.type === 'navigate' && (
        <select
          value={(action.onSuccess as WActionNavigate).screenId || ''}
          onChange={e => {
            const scr = screens.find(s => s.id === e.target.value)
            onChange({ ...action, onSuccess: { ...(action.onSuccess as WActionNavigate), screenId: e.target.value, route: scr?.route || '/', screenName: scr?.name } })
          }}
          style={{ ...sel, marginLeft: 12 }}>
          <option value="">— select screen —</option>
          {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {action.onSuccess?.type === 'showSnackbar' && (
        <input
          value={(action.onSuccess as WActionShowSnackbar).message}
          onChange={e => onChange({ ...action, onSuccess: { type: 'showSnackbar', message: e.target.value } })}
          placeholder="Success message"
          style={{ ...inp, marginLeft: 12 }}
        />
      )}
      <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>On error →</div>
      <input
        value={action.onError?.message || ''}
        onChange={e => onChange({ ...action, onError: e.target.value ? { type: 'showSnackbar', message: e.target.value, isError: true } : undefined })}
        placeholder="Error message (leave empty to skip)"
        style={inp}
      />
    </div>
  )
}

function ShowDialogEditor({ action, onChange }: { action: WActionShowDialog; onChange: (a: WActionShowDialog) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={row}><span style={lbl}>Title</span><input value={action.title} onChange={e => onChange({ ...action, title: e.target.value })} style={inp} /></div>
      <div style={row}><span style={lbl}>Message</span><input value={action.message} onChange={e => onChange({ ...action, message: e.target.value })} style={inp} /></div>
      <div style={row}><span style={lbl}>Confirm</span><input value={action.confirmLabel} onChange={e => onChange({ ...action, confirmLabel: e.target.value })} style={inp} /></div>
      <div style={row}><span style={lbl}>Cancel</span><input value={action.cancelLabel} onChange={e => onChange({ ...action, cancelLabel: e.target.value })} style={inp} /></div>
    </div>
  )
}

function ShowSnackbarEditor({ action, onChange }: { action: WActionShowSnackbar; onChange: (a: WActionShowSnackbar) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={row}><span style={lbl}>Message</span><input value={action.message} onChange={e => onChange({ ...action, message: e.target.value })} placeholder="e.g. Saved successfully!" style={inp} /></div>
      <div style={row}>
        <span style={lbl}>Duration</span>
        <input type="number" min={1} max={10} value={action.duration ?? 3} onChange={e => onChange({ ...action, duration: +e.target.value })} style={{ ...inp, width: 60 }} />
        <span style={{ fontSize: 10, color: '#555' }}>sec</span>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!action.isError} onChange={e => onChange({ ...action, isError: e.target.checked })} />
        <span style={{ fontSize: 11, color: '#888' }}>Show as error (red)</span>
      </label>
    </div>
  )
}

function CallCodeEditor({
  action, onChange, screenId,
}: {
  action: WActionCallCode
  onChange: (a: WActionCallCode) => void
  screenId: string
}) {
  const { project } = useCanvasStore()
  const codeStore    = useCodeStore()
  const setActiveTab = useUIStore(s => s.setActiveTab)

  const handleGoToCode = useCallback(() => {
    const screen = project?.screens[screenId]
    if (!screen) return

    // Ensure the screen file exists
    if (!codeStore.screenFiles[screenId]) {
      codeStore.initScreenFile(screenId, screen.name, screen.route)
    }

    // Inject method stub if not already present
    const file = useCodeStore.getState().screenFiles[screenId]
    if (file) {
      const methodName = action.methodName || '_onAction'
      const stub = `\n  // ── Action: ${methodName} ─────────────────────────────────\n  void ${methodName}() {\n    // TODO: implement your logic here\n  }\n`
      if (!file.dartCode.includes(`void ${methodName}(`) &&
          !file.dartCode.includes(`Future<void> ${methodName}(`)) {
        // Insert before the last closing brace of the class
        const lastBrace = file.dartCode.lastIndexOf('\n}')
        const updated   = lastBrace !== -1
          ? file.dartCode.slice(0, lastBrace) + stub + '\n}'
          : file.dartCode + stub
        codeStore.updateScreenCode(screenId, updated)
      }
      // Set active screen file
      codeStore.setActiveScreenFile(screenId)
    }

    // Switch to Code tab
    setActiveTab('code')
  }, [action.methodName, screenId, project, codeStore, setActiveTab])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={row}>
        <span style={lbl}>Method</span>
        <input
          value={action.methodName}
          onChange={e => onChange({ ...action, methodName: e.target.value })}
          placeholder="_onAction"
          style={{ ...inp, fontFamily: 'monospace' }}
        />
      </div>
      <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5 }}>
        Write this method in your screen's .dart file.
        The IDE will create a stub for you.
      </div>
      <button onClick={handleGoToCode} style={{
        padding: '6px 12px', background: '#1a1200',
        border: '1px solid #e09b2d', borderRadius: 7,
        color: '#e09b2d', cursor: 'pointer', fontSize: 11,
        fontFamily: 'system-ui, sans-serif', fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        ↗ Create stub &amp; go to Code tab
      </button>
      <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace', lineHeight: 1.6 }}>
        void {action.methodName || '_onAction'}() {'{'}<br />
        &nbsp;&nbsp;// your logic here<br />
        {'}'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE ACTION CARD
// ─────────────────────────────────────────────────────────────────────────────

function ActionCard({
  action, index, total, screenId,
  onChange, onDelete, onMoveUp, onMoveDown,
}: {
  action:     WAction
  index:      number
  total:      number
  screenId:   string
  onChange:   (a: WAction) => void
  onDelete:   () => void
  onMoveUp:   () => void
  onMoveDown: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const meta = ACTION_TYPES.find(a => a.type === action.type)!

  return (
    <div style={{
      border: `1px solid ${meta.color}44`,
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 8, background: meta.bg,
      marginBottom: 6, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color,
          background: meta.color + '22', padding: '2px 6px', borderRadius: 4 }}>
          {index + 1}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, flex: 1 }}>
          {meta.label}
          {action.type === 'navigate'    && (action as WActionNavigate).screenName    ? ` → ${(action as WActionNavigate).screenName}`        : ''}
          {action.type === 'callApi'     && (action as WActionCallApi).interfaceName  ? ` → ${(action as WActionCallApi).interfaceName}`       : ''}
          {action.type === 'callCode'    && (action as WActionCallCode).methodName    ? `  ${(action as WActionCallCode).methodName}()`        : ''}
          {action.type === 'showSnackbar'&& (action as WActionShowSnackbar).message   ? `  "${(action as WActionShowSnackbar).message.slice(0,16)}…"` : ''}
        </span>
        {/* Reorder */}
        <button onClick={e => { e.stopPropagation(); onMoveUp() }}
          disabled={index === 0}
          style={{ ...iconBtn, opacity: index === 0 ? 0.3 : 1 }}>↑</button>
        <button onClick={e => { e.stopPropagation(); onMoveDown() }}
          disabled={index === total - 1}
          style={{ ...iconBtn, opacity: index === total - 1 ? 0.3 : 1 }}>↓</button>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ ...iconBtn, color: '#e05252' }}>✕</button>
        <span style={{ fontSize: 10, color: '#444' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Editor */}
      {expanded && (
        <div style={{ padding: '0 10px 10px' }}>
          {action.type === 'navigate'     && <NavigateEditor     action={action as WActionNavigate}     onChange={a => onChange(a)} />}
          {action.type === 'callApi'      && <CallApiEditor      action={action as WActionCallApi}      onChange={a => onChange(a)} />}
          {action.type === 'showDialog'   && <ShowDialogEditor   action={action as WActionShowDialog}   onChange={a => onChange(a)} />}
          {action.type === 'showSnackbar' && <ShowSnackbarEditor action={action as WActionShowSnackbar} onChange={a => onChange(a)} />}
          {action.type === 'callCode'     && <CallCodeEditor     action={action as WActionCallCode}     onChange={a => onChange(a)} screenId={screenId} />}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT BLOCK — one event + its action list
// ─────────────────────────────────────────────────────────────────────────────

function EventBlock({
  handler, screenId, widgetType,
  onChange, onDelete,
}: {
  handler:    WEventHandler
  screenId:   string
  widgetType: string
  onChange:   (h: WEventHandler) => void
  onDelete:   () => void
}) {
  const [showAddMenu, setShowAddMenu] = useState(false)

  const addAction = (type: WActionType) => {
    onChange({ ...handler, actions: [...handler.actions, defaultAction(type)] })
    setShowAddMenu(false)
  }

  const updateAction = (i: number, a: WAction) => {
    const actions = [...handler.actions]; actions[i] = a
    onChange({ ...handler, actions })
  }

  const deleteAction = (i: number) => {
    onChange({ ...handler, actions: handler.actions.filter((_, idx) => idx !== i) })
  }

  const moveUp = (i: number) => {
    if (i === 0) return
    const actions = [...handler.actions]
    ;[actions[i - 1], actions[i]] = [actions[i], actions[i - 1]]
    onChange({ ...handler, actions })
  }

  const moveDown = (i: number) => {
    if (i === handler.actions.length - 1) return
    const actions = [...handler.actions]
    ;[actions[i], actions[i + 1]] = [actions[i + 1], actions[i]]
    onChange({ ...handler, actions })
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Event header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9d7fe8', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#9d7fe8', fontFamily: 'monospace' }}>
            {handler.event}
          </span>
          <span style={{ fontSize: 10, color: '#555' }}>
            {handler.actions.length} action{handler.actions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onDelete} style={{ ...iconBtn, color: '#555', fontSize: 10 }}>
          Remove event
        </button>
      </div>

      {/* Actions list */}
      {handler.actions.length === 0 && (
        <div style={{ fontSize: 11, color: '#444', padding: '8px 10px',
          border: '1px dashed #2a2a3a', borderRadius: 6, textAlign: 'center' }}>
          No actions yet — add one below
        </div>
      )}
      {handler.actions.map((action, i) => (
        <ActionCard
          key={i}
          action={action}
          index={i}
          total={handler.actions.length}
          screenId={screenId}
          onChange={a => updateAction(i, a)}
          onDelete={() => deleteAction(i)}
          onMoveUp={() => moveUp(i)}
          onMoveDown={() => moveDown(i)}
        />
      ))}

      {/* Add action button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowAddMenu(v => !v)}
          style={{
            width: '100%', padding: '5px 0',
            background: 'transparent', border: '1px dashed #3d3060',
            borderRadius: 6, color: '#7c5cbf', cursor: 'pointer',
            fontSize: 11, fontFamily: 'system-ui, sans-serif',
          }}>
          + Add action
        </button>

        {showAddMenu && (
          <div style={{
            position: 'absolute' as const, bottom: '110%', left: 0, right: 0,
            background: '#0d0d1a', border: '1px solid #2a2a3a',
            borderRadius: 8, zIndex: 200, overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}>
            {ACTION_TYPES.map(at => (
              <button
                key={at.type}
                onClick={() => addAction(at.type)}
                style={{
                  width: '100%', padding: '8px 12px', background: 'transparent',
                  border: 'none', borderBottom: '1px solid #1e1e2e',
                  cursor: 'pointer', textAlign: 'left' as const,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: at.color,
                  background: at.color + '22', padding: '2px 7px', borderRadius: 4 }}>
                  {at.label}
                </span>
                <span style={{ fontSize: 11, color: '#555' }}>{at.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — ActionsPanel
// Rendered inside PropertiesPanel when an interactive widget is selected
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  widget:   WidgetNode
  screenId: string
}

export default function ActionsPanel({ widget, screenId }: Props) {
  const { updateWidget } = useCanvasStore()

  const handlers: WEventHandler[] = (widget.events as any)?.handlers || []
  const availableEvents           = getAvailableEvents(widget.type)
  const usedEvents                = new Set(handlers.map(h => h.event))
  const unusedEvents              = availableEvents.filter(e => !usedEvents.has(e.event))

  const [showEventMenu, setShowEventMenu] = useState(false)

  const saveHandlers = useCallback((next: WEventHandler[]) => {
    updateWidget(screenId, widget.id, {
      events: { ...(widget.events || {}), handlers: next } as any,
    })
  }, [widget, screenId, updateWidget])

  const addEvent = (event: WEventType) => {
    saveHandlers([...handlers, { event, actions: [] }])
    setShowEventMenu(false)
  }

  const updateHandler = (i: number, h: WEventHandler) => {
    const next = [...handlers]; next[i] = h; saveHandlers(next)
  }

  const deleteHandler = (i: number) => {
    saveHandlers(handlers.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e2e' }}>
      {/* Section header */}
      <div style={{ fontSize: 9, fontWeight: 700, color: '#9d7fe8',
        letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
        Actions
      </div>

      {handlers.length === 0 && (
        <div style={{ fontSize: 11, color: '#444', marginBottom: 10, lineHeight: 1.6 }}>
          No events configured. Add an event to wire up actions for this widget.
        </div>
      )}

      {/* Event blocks */}
      {handlers.map((h, i) => (
        <EventBlock
          key={h.event + i}
          handler={h}
          screenId={screenId}
          widgetType={widget.type}
          onChange={next => updateHandler(i, next)}
          onDelete={() => deleteHandler(i)}
        />
      ))}

      {/* Add event */}
      {unusedEvents.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowEventMenu(v => !v)}
            style={{
              width: '100%', padding: '6px 0',
              background: '#0f0f1e', border: '1px solid #3d3060',
              borderRadius: 7, color: '#9d7fe8', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: 'system-ui, sans-serif',
            }}>
            + Add event
          </button>

          {showEventMenu && (
            <div style={{
              position: 'absolute' as const, bottom: '110%', left: 0, right: 0,
              background: '#0d0d1a', border: '1px solid #2a2a3a',
              borderRadius: 8, zIndex: 200, overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}>
              {unusedEvents.map(e => (
                <button
                  key={e.event}
                  onClick={() => addEvent(e.event)}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'transparent',
                    border: 'none', borderBottom: '1px solid #1e1e2e',
                    cursor: 'pointer', textAlign: 'left' as const,
                    fontSize: 12, color: '#9d7fe8', fontFamily: 'monospace',
                  }}>
                  {e.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {availableEvents.length === 0 && (
        <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
          This widget type has no configurable events.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MICRO STYLES
// ─────────────────────────────────────────────────────────────────────────────

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
}

const lbl: React.CSSProperties = {
  fontSize: 10, color: '#666', width: 62, flexShrink: 0,
}

const sel: React.CSSProperties = {
  flex: 1, padding: '4px 6px', background: '#0a0a14',
  border: '1px solid #2a2a3a', borderRadius: 5,
  fontSize: 11, color: '#d4d4d4', outline: 'none',
  fontFamily: 'system-ui, sans-serif',
}

const inp: React.CSSProperties = {
  flex: 1, padding: '4px 6px', background: '#0a0a14',
  border: '1px solid #2a2a3a', borderRadius: 5,
  fontSize: 11, color: '#d4d4d4', outline: 'none',
  fontFamily: 'system-ui, sans-serif',
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#555', fontSize: 12, padding: '0 3px', lineHeight: 1,
  fontFamily: 'system-ui, sans-serif',
}
