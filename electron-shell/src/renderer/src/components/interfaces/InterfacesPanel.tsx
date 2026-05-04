import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useIntegrationsStore } from '../../store/integrations.store'
import { useCanvasStore } from '../../store/canvas.store'
import type {
  InterfaceDefinition, HttpMethod, AuthType, DataFile,
  TriggerType, CacheStrategy, RequestParam,
} from '../../types/api-integration.types'
import { DEFAULT_HOOKS } from '../../types/api-integration.types'

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:       { display:'flex', height:'100%', background:'#0d0d1a', overflow:'hidden' },
  sidebar:    { width:220, borderRight:'1px solid #1e2d3d', display:'flex', flexDirection:'column', flexShrink:0 },
  sideHead:   { padding:'12px 14px', borderBottom:'1px solid #1e2d3d', display:'flex', alignItems:'center', justifyContent:'space-between' },
  sideTitle:  { fontSize:11, fontWeight:700, color:'#8892A4', letterSpacing:'0.08em', textTransform:'uppercase' as const },
  addBtn:     { background:'#1E6BFF', border:'none', color:'#fff', width:22, height:22, borderRadius:5, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' },
  ifcItem:    { padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #0d1117' },
  ifcName:    { fontSize:13, fontWeight:500 },
  body:       { flex:1, overflowY:'auto' as const, padding:20 },
  section:    { marginBottom:20, border:'1px solid #1e2d3d', borderRadius:10, overflow:'hidden' },
  secHead:    { padding:'8px 14px', background:'#0a0a14', borderBottom:'1px solid #1e2d3d', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 },
  secTitle:   { fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase' as const },
  secBody:    { padding:14 },
  row:        { display:'flex', alignItems:'center', gap:10, marginBottom:10 },
  label:      { width:140, fontSize:12, color:'#8892A4', flexShrink:0 },
  input:      { flex:1, padding:'6px 10px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif' },
  select:     { flex:1, padding:'6px 10px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:6, fontSize:12, color:'#d4d4d4', outline:'none', cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  smallBtn:   { padding:'4px 10px', background:'#1e1a33', border:'1px solid #3d3060', borderRadius:6, color:'#9d7fe8', fontSize:11, cursor:'pointer', fontFamily:'system-ui,sans-serif', whiteSpace:'nowrap' as const },
  delBtn:     { background:'transparent', border:'none', color:'#3a1a1a', cursor:'pointer', fontSize:13, padding:'0 4px', transition:'color 0.15s' },
  method:     { padding:'4px 10px', borderRadius:6, border:'1px solid', fontSize:11, fontWeight:700, fontFamily:'monospace', cursor:'pointer', letterSpacing:'0.04em' },
  urlBar:     { display:'flex', gap:8, alignItems:'center', flex:1 },
  hookGrid:   { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 },
  hookCard:   { border:'1px solid', borderRadius:8, overflow:'hidden' },
  hookHead:   { padding:'7px 12px', borderBottom:'1px solid', display:'flex', alignItems:'center', gap:6 },
  hookEditor: { padding:0, background:'#050510', fontFamily:'monospace', fontSize:12, lineHeight:1.7, color:'#d4d4d4', border:'none', outline:'none', resize:'none' as const, width:'100%' },
  hookSig:    { padding:'6px 12px', background:'#0a0a14', borderBottom:'1px solid', fontFamily:'monospace', fontSize:11, color:'#555' },
  testBox:    { background:'#050510', borderRadius:8, padding:14, fontFamily:'monospace', fontSize:12, lineHeight:1.8, whiteSpace:'pre-wrap' as const, border:'1px solid #1e2d3d', maxHeight:240, overflowY:'auto' as const },
  paramGrid:  { display:'grid', gridTemplateColumns:'1fr 90px 90px 90px 24px', gap:6, alignItems:'center', marginBottom:5 },
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:'#4caf7d', POST:'#4a9edd', PUT:'#c9a227', PATCH:'#9d7fe8', DELETE:'#e05252',
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function HookEditor({ ifc }: { ifc: InterfaceDefinition }) {
  const { updateHooks } = useIntegrationsStore()

  const hooks = [
    {
      key:   'onBeforeCall' as const,
      color: '#c9a227',
      sig:   'AzRequest onBeforeCall(AzRequest request) {',
      hint:  'Modify headers, params, body before call',
    },
    {
      key:   'onResponse' as const,
      color: '#4a9edd',
      sig:   'Map<String,dynamic> onResponse(Map<String,dynamic> raw) {',
      hint:  'Transform, filter, enrich the response',
    },
    {
      key:   'onError' as const,
      color: '#e05252',
      sig:   'void onError(dynamic error, int statusCode) {',
      hint:  'Handle errors — redirect, dialog, log',
    },
  ]

  return (
    <div style={s.hookGrid}>
      {hooks.map(h => (
        <div key={h.key} style={{ ...s.hookCard, borderColor: h.color + '44' }}>
          <div style={{ ...s.hookHead, background: h.color + '11', borderBottomColor: h.color + '33' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: h.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, fontWeight:700, color: h.color, fontFamily:'monospace' }}>{h.key}</span>
          </div>
          <div style={{ ...s.hookSig, borderBottomColor: h.color + '22' }}>{h.sig}</div>
          <textarea
            style={{ ...s.hookEditor, padding:'10px 12px' }}
            rows={7}
            value={ifc.hooks[h.key]}
            onChange={e => updateHooks(ifc.id, { [h.key]: e.target.value })}
            placeholder={DEFAULT_HOOKS[h.key]}
            spellCheck={false}
          />
          <div style={{ ...s.hookSig, borderBottom:'none', borderTop: '1px solid ' + h.color + '22' }}>{'}'}</div>
          <div style={{ padding:'4px 12px 8px', fontSize:10, color:'#444' }}>{h.hint} · leave empty for default</div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST PANEL
// ─────────────────────────────────────────────────────────────────────────────

function TestPanel({ ifc, engineUrl }: { ifc: InterfaceDefinition; engineUrl: string }) {
  const { setTestResult } = useIntegrationsStore()
  const { project } = useCanvasStore()
  const [testing, setTesting] = useState(false)

  const runTest = async () => {
    setTesting(true)
    const start = Date.now()
    try {
      // Build full URL from app config base URL
      const appConfig = (project as any)?._configs?.['app-config.json']
      const env = appConfig?.activeEnv || 'dev'
      const baseUrl = appConfig?.environments?.[env]?.baseUrl || appConfig?.baseUrl || 'http://localhost:9876'
      const url = baseUrl.replace(/\/$/, '') + ifc.urlPath

      // Build params from mock values
      const queryParams = ifc.params
        .filter(p => p.location === 'query' && p.mockValue)
        .map(p => `${p.name}=${encodeURIComponent(p.mockValue)}`)
        .join('&')
      const fullUrl = queryParams ? `${url}?${queryParams}` : url

      // Fire via engine proxy to avoid CORS issues
      const res = await fetch(engineUrl + '/api/proxy/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: ifc.method, url: fullUrl, params: ifc.params }),
      })
      const data = await res.json()
      const duration = Date.now() - start
      setTestResult(ifc.id, {
        status: data.status || res.status,
        body: typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2),
        testedAt: new Date().toISOString(),
        durationMs: duration,
      })
    } catch (e: any) {
      setTestResult(ifc.id, {
        status: 0, body: 'Error: ' + e.message,
        testedAt: new Date().toISOString(), durationMs: Date.now() - start,
      })
    } finally {
      setTesting(false)
    }
  }

  const result = ifc.lastTestResult

  return (
    <div style={s.secBody}>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
        <button onClick={runTest} disabled={testing} style={{
          padding:'7px 16px', background: testing ? '#1a1a2a' : '#1E6BFF',
          border:'none', borderRadius:7, color:'#fff', fontSize:12, cursor: testing ? 'not-allowed':'pointer',
          fontFamily:'system-ui,sans-serif', fontWeight:600,
        }}>
          {testing ? '◌ Testing...' : '▶ Test API'}
        </button>
        {result && (
          <span style={{ fontSize:11, fontFamily:'monospace',
            color: result.status >= 200 && result.status < 300 ? '#4caf7d' : '#e05252' }}>
            {result.status} · {result.durationMs}ms · {new Date(result.testedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      {result && (
        <div style={s.testBox}>
          <div style={{ color: result.status >= 200 && result.status < 300 ? '#4caf7d' : '#e05252', marginBottom:8, fontSize:11 }}>
            HTTP {result.status}
          </div>
          <div style={{ color:'#6dda9d' }}>{result.body}</div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACE EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function InterfaceEditor({ ifc, engineUrl }: { ifc: InterfaceDefinition; engineUrl: string }) {
  const { updateInterface, addParam, updateParam, deleteParam, deleteInterface } = useIntegrationsStore()
  const { dataFiles } = useIntegrationsStore()

  return (
    <div style={s.body}>

      {/* Endpoint */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#4a9edd' }}>Endpoint</span>
          <button style={{ ...s.smallBtn, color:'#e05252', borderColor:'#5c1a1a' }}
            onClick={() => deleteInterface(ifc.id)}>Delete</button>
        </div>
        <div style={s.secBody}>
          <div style={s.row}>
            <span style={s.label}>Name</span>
            <input style={s.input} value={ifc.name}
              onChange={e => updateInterface(ifc.id, { name: e.target.value })}
              placeholder="e.g. getKendraList"/>
          </div>
          <div style={s.row}>
            <span style={s.label}>Description</span>
            <input style={s.input} value={ifc.description}
              onChange={e => updateInterface(ifc.id, { description: e.target.value })}
              placeholder="What does this API do?"/>
          </div>
          <div style={s.row}>
            <span style={s.label}>Method + URL</span>
            <div style={s.urlBar}>
              {(['GET','POST','PUT','PATCH','DELETE'] as HttpMethod[]).map(m => (
                <button key={m} onClick={() => updateInterface(ifc.id, { method: m })} style={{
                  ...s.method,
                  color: ifc.method === m ? METHOD_COLORS[m] : '#333',
                  borderColor: ifc.method === m ? METHOD_COLORS[m] + '88' : '#1e2d3d',
                  background: ifc.method === m ? METHOD_COLORS[m] + '15' : 'transparent',
                }}>{m}</button>
              ))}
              <input style={{ ...s.input, fontFamily:'monospace', fontSize:12 }}
                value={ifc.urlPath}
                onChange={e => updateInterface(ifc.id, { urlPath: e.target.value })}
                placeholder="/api/kendra/list"/>
            </div>
          </div>
          <div style={s.row}>
            <span style={s.label}>Auth</span>
            <select style={{ ...s.select, flex:'none', width:140 }}
              value={ifc.authType}
              onChange={e => updateInterface(ifc.id, { authType: e.target.value as AuthType })}>
              <option value="none">None</option>
              <option value="bearer">Bearer token (AzSession)</option>
              <option value="basic">Basic auth</option>
              <option value="apiKey">API key header</option>
              <option value="custom">Custom (set in onBeforeCall)</option>
            </select>
            {ifc.authType === 'apiKey' && (
              <input style={{ ...s.input, flex:'none', width:160 }}
                value={ifc.authHeaderName || ''}
                onChange={e => updateInterface(ifc.id, { authHeaderName: e.target.value })}
                placeholder="Header name e.g. X-API-Key"/>
            )}
          </div>
          <div style={s.row}>
            <span style={s.label}>Response schema</span>
            <select style={{ ...s.select, flex:'none', width:240 }}
              value={ifc.responseSchemaId}
              onChange={e => updateInterface(ifc.id, { responseSchemaId: e.target.value })}>
              <option value="">— select a Data File —</option>
              {dataFiles.map(df => (
                <option key={df.id} value={df.id}>{df.name}</option>
              ))}
            </select>
          </div>
          <div style={s.row}>
            <span style={s.label}>Trigger</span>
            <select style={{ ...s.select, flex:'none', width:180 }}
              value={ifc.triggerType}
              onChange={e => updateInterface(ifc.id, { triggerType: e.target.value as TriggerType })}>
              <option value="onScreenLoad">On screen load (auto-call)</option>
              <option value="onButtonTap">On button tap</option>
              <option value="onPullRefresh">On pull-to-refresh</option>
              <option value="manual">Manual — call from code</option>
            </select>
            <select style={{ ...s.select, flex:'none', width:160 }}
              value={ifc.cacheStrategy}
              onChange={e => updateInterface(ifc.id, { cacheStrategy: e.target.value as CacheStrategy })}>
              <option value="none">No cache</option>
              <option value="memory">Memory (app session)</option>
              <option value="session">Session storage</option>
              <option value="persistent">Persistent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Request params */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#9d7fe8' }}>Request params</span>
          <button style={s.smallBtn} onClick={() => addParam(ifc.id)}>+ add param</button>
        </div>
        <div style={s.secBody}>
          {ifc.params.length === 0 && (
            <div style={{ fontSize:12, color:'#444', textAlign:'center' as const, padding:'8px 0' }}>
              No params — add path/query/body params here
            </div>
          )}
          {ifc.params.length > 0 && (
            <div style={{ ...s.paramGrid, opacity:0.5, marginBottom:8 }}>
              {['Name','Type','In','Mock value',''].map((h,i) => (
                <span key={i} style={{ fontSize:10, color:'#555', fontFamily:'monospace' }}>{h}</span>
              ))}
            </div>
          )}
          {ifc.params.map(p => (
            <div key={p.id} style={s.paramGrid}>
              <input style={{ padding:'4px 8px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:5, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif', width:'100%' }}
                value={p.name} onChange={e => updateParam(ifc.id, p.id, { name: e.target.value })}
                placeholder="paramName"/>
              <select style={{ padding:'4px 6px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:5, fontSize:11, color:'#d4d4d4', outline:'none', cursor:'pointer', width:'100%' }}
                value={p.type} onChange={e => updateParam(ifc.id, p.id, { type: e.target.value as any })}>
                {['String','int','double','bool'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={{ padding:'4px 6px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:5, fontSize:11, color:'#d4d4d4', outline:'none', cursor:'pointer', width:'100%' }}
                value={p.location} onChange={e => updateParam(ifc.id, p.id, { location: e.target.value as any })}>
                {['query','path','body','header'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <input style={{ padding:'4px 8px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:5, fontSize:12, color:'#d4d4d4', outline:'none', fontFamily:'system-ui,sans-serif', width:'100%' }}
                value={p.mockValue} onChange={e => updateParam(ifc.id, p.id, { mockValue: e.target.value })}
                placeholder="mock"/>
              <button style={s.delBtn}
                onMouseEnter={e => (e.currentTarget.style.color='#e05252')}
                onMouseLeave={e => (e.currentTarget.style.color='#3a1a1a')}
                onClick={() => deleteParam(ifc.id, p.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Hooks — inline editors */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#c9a227' }}>Developer hooks</span>
          <span style={{ fontSize:10, color:'#555' }}>Write Dart code here — compiled into screen controller on Generate</span>
        </div>
        <div style={{ padding:14 }}>
          <HookEditor ifc={ifc} />
        </div>
        <div style={{ padding:'0 14px 14px', fontSize:11, color:'#444', lineHeight:1.8 }}>
          All three hooks are optional. Leave empty and the default behaviour is used.
          The generated controller will contain these exact method bodies inside the controller class.
        </div>
      </div>

      {/* Generated code preview */}
      <GeneratedCodePreview ifc={ifc} />

      {/* Test */}
      <div style={s.section}>
        <div style={s.secHead}>
          <span style={{ ...s.secTitle, color:'#4caf7d' }}>Test API</span>
          <span style={{ fontSize:10, color:'#555' }}>Fires the real endpoint using mock param values</span>
        </div>
        <TestPanel ifc={ifc} engineUrl={engineUrl} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATED CODE PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

function GeneratedCodePreview({ ifc }: { ifc: InterfaceDefinition }) {
  const { dataFiles } = useIntegrationsStore()
  const df = dataFiles.find(d => d.id === ifc.responseSchemaId)
  const [open, setOpen] = useState(false)

  const modelName = df ? df.name : 'ResponseModel'
  const providerName = ifc.name[0].toLowerCase() + ifc.name.slice(1) + 'Provider'
  const ctrlName = ifc.name[0].toUpperCase() + ifc.name.slice(1) + 'Controller'

  const hasOnBeforeCall = ifc.hooks.onBeforeCall.trim() && ifc.hooks.onBeforeCall.trim() !== DEFAULT_HOOKS.onBeforeCall.trim()
  const hasOnResponse   = ifc.hooks.onResponse.trim()   && ifc.hooks.onResponse.trim()   !== DEFAULT_HOOKS.onResponse.trim()
  const hasOnError      = ifc.hooks.onError.trim()      && ifc.hooks.onError.trim()       !== DEFAULT_HOOKS.onError.trim()

  const authLine = ifc.authType === 'bearer'
    ? `'Authorization': 'Bearer \${await AzSession.instance.getToken()}'`
    : ifc.authType === 'apiKey'
    ? `'${ifc.authHeaderName || 'X-API-Key'}': AzConfig.apiKey`
    : ''

  const code = `// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GENERATED by Appzillon-New IDE
// Interface: ${ifc.name}  •  ${ifc.method} ${ifc.urlPath}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ${ctrlName} extends StateNotifier<AsyncValue<${modelName}>> {
  ${ctrlName}(this.ref) : super(const AsyncValue.loading())${ifc.triggerType === 'onScreenLoad' ? ' { load(); }' : ';'}
  final Ref ref;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      var request = AzRequest(
        url: AzConfig.baseUrl + '${ifc.urlPath}',${authLine ? `\n        headers: {${authLine}},` : ''}
      );
      request = onBeforeCall(request);
      final raw = await AzServer.instance.${ifc.method.toLowerCase()}(
        request.url, headers: request.headers,
      );
      final transformed = onResponse(raw);
      state = AsyncValue.data(${modelName}.fromJson(transformed));
    } catch (e, st) {
      onError(e, (e as AzServerException?)?.statusCode ?? 0);
      state = AsyncValue.error(e, st);
    }
  }

  // ── Developer hooks ──────────────────────────────
  AzRequest onBeforeCall(AzRequest request) {
    ${hasOnBeforeCall ? ifc.hooks.onBeforeCall : '  return request;'}
  }

  Map<String,dynamic> onResponse(Map<String,dynamic> raw) {
    ${hasOnResponse ? ifc.hooks.onResponse : '  return raw;'}
  }

  void onError(dynamic error, int statusCode) {
    ${hasOnError ? ifc.hooks.onError : "    AzLogger.error('${ifc.name} error: \$error');"}
  }
}

final ${providerName} = StateNotifierProvider.autoDispose<${ctrlName}, AsyncValue<${modelName}>>(
  (ref) => ${ctrlName}(ref),
);`

  return (
    <div style={s.section}>
      <div style={{ ...s.secHead, cursor:'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{ ...s.secTitle, color:'#4caf7d' }}>Generated controller preview</span>
        <span style={{ fontSize:11, color:'#555' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </div>
      {open && (
        <div style={{ padding:'0 14px 14px' }}>
          <pre style={{ background:'#050510', border:'1px solid #1e2d3d', borderRadius:8, padding:14,
            fontFamily:'monospace', fontSize:11, lineHeight:1.8, color:'#c9d1d9', overflowX:'auto' as const,
            whiteSpace:'pre' as const }}>
            {code}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function InterfacesPanel({ engineUrl }: { engineUrl: string }): JSX.Element {
  const { interfaces, addInterface } = useIntegrationsStore()
  const { dataFiles } = useIntegrationsStore()
  const { project, activeScreenId, setScreenFromAI } = useCanvasStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [paintMsg, setPaintMsg] = useState<string | null>(null)

  const selectedIfc = interfaces.find(i => i.id === selected)

  const handleAdd = () => {
    if (!newName.trim()) return
    const id = addInterface(newName.trim())
    setSelected(id)
    setNewName('')
    setAdding(false)
  }

  // ── Paint to Canvas ───────────────────────────────────────────────────────
  // Reads the interface's response schema (DataFile) and generates a fully-
  // bound widget tree injected into the active screen via setScreenFromAI().
  const handlePaintToCanvas = (ifc: InterfaceDefinition) => {
    if (!activeScreenId || !project) {
      setPaintMsg('Open a project and select a screen first.')
      setTimeout(() => setPaintMsg(null), 3000)
      return
    }
    const df = dataFiles.find(d => d.id === ifc.responseSchemaId)
    if (!df) {
      setPaintMsg('Link a Data File (response schema) to this interface first.')
      setTimeout(() => setPaintMsg(null), 3000)
      return
    }

    const makeId = () => 'w_' + Math.random().toString(36).substring(2, 10)
    const isList = df.responseType === 'BARE_ARRAY' || df.responseType === 'WRAPPED_ARRAY'
    const fields  = df.fields || []

    const widgets: Record<string, any> = {}

    if (isList) {
      // ── List response → AppBar + ListView with bound ListTiles ─────────────
      const scaffoldId  = makeId()
      const appBarId    = makeId()
      const listViewId  = makeId()
      const listTileId  = makeId()

      const titleField    = fields.find(f => f.type === 'String') || fields[0]
      const subtitleField = fields.filter(f => f.type === 'String')[1] || fields[1]

      widgets[appBarId] = {
        id: appBarId, type: 'flutter.widgets.AppBar',
        props: { title: ifc.name, centerTitle: false },
      }

      // ListTile template — bound to title/subtitle fields
      widgets[listTileId] = {
        id: listTileId,
        type: 'flutter.widgets.ListTile',
        props: {
          title:    titleField?.name    || 'item',
          subtitle: subtitleField?.name || '',
          trailing: true,
        },
        apiBinding: titleField ? {
          interfaceId: ifc.id,
          interfaceName: ifc.name,
          urlPath: ifc.urlPath,
          method: ifc.method,
          fieldPath: titleField.name,
          targetProp: 'title',
          format: 'none',
          isListBinding: true,
          arrayPath: df.responseType === 'WRAPPED_ARRAY' ? (df.arrayPath || 'data') : '',
          mockPreview: titleField.mockValue || '',
        } : undefined,
      }

      // ListView — bound array
      widgets[listViewId] = {
        id: listViewId,
        type: 'flutter.widgets.ListView',
        props: {},
        children: [listTileId],
        apiBinding: {
          interfaceId: ifc.id,
          interfaceName: ifc.name,
          urlPath: ifc.urlPath,
          method: ifc.method,
          fieldPath: '',
          targetProp: 'items',
          format: 'none',
          isListBinding: true,
          arrayPath: df.responseType === 'WRAPPED_ARRAY' ? (df.arrayPath || 'data') : '',
        },
      }

      widgets[scaffoldId] = {
        id: scaffoldId,
        type: 'flutter.widgets.Scaffold',
        props: {},
        children: [appBarId, listViewId],
      }

      setScreenFromAI(activeScreenId, {
        ...project.screens[activeScreenId],
        rootWidgetId: scaffoldId,
        widgets,
      })

    } else {
      // ── Object response → AppBar + Column with labeled rows per field ──────
      const scaffoldId = makeId()
      const appBarId   = makeId()
      const columnId   = makeId()
      const childIds: string[] = []

      widgets[appBarId] = {
        id: appBarId, type: 'flutter.widgets.AppBar',
        props: { title: ifc.name, centerTitle: false },
      }

      for (const field of fields.slice(0, 8)) { // max 8 rows
        const rowId    = makeId()
        const labelId  = makeId()
        const valueId  = makeId()

        widgets[labelId] = {
          id: labelId, type: 'flutter.widgets.Text',
          props: { data: field.name, style: { fontSize: 11, fontWeight: 'w400', color: { hex: '#8892A4' } } },
        }
        widgets[valueId] = {
          id: valueId, type: 'flutter.widgets.Text',
          props: { data: field.mockValue || '--', style: { fontSize: 14, fontWeight: 'w500' } },
          apiBinding: {
            interfaceId: ifc.id,
            interfaceName: ifc.name,
            urlPath: ifc.urlPath,
            method: ifc.method,
            fieldPath: field.name,
            targetProp: 'data',
            format: 'none',
            mockPreview: field.mockValue || '',
          },
        }
        widgets[rowId] = {
          id: rowId, type: 'flutter.widgets.Row',
          props: { mainAxisAlignment: 'spaceBetween' },
          children: [labelId, valueId],
        }

        // Divider between rows
        const divId = makeId()
        widgets[divId] = { id: divId, type: 'flutter.widgets.Divider', props: { thickness: 0.5 } }
        childIds.push(rowId, divId)
      }

      widgets[columnId] = {
        id: columnId, type: 'flutter.widgets.Column',
        props: { mainAxisAlignment: 'start', crossAxisAlignment: 'stretch' },
        children: childIds,
      }

      // Wrap in Padding + SingleChildScrollView
      const scrollId = makeId()
      const padId    = makeId()
      widgets[padId]    = { id: padId, type: 'flutter.widgets.Padding',
        props: { padding: { all: 16 } }, children: [columnId] }
      widgets[scrollId] = { id: scrollId, type: 'flutter.widgets.SingleChildScrollView',
        props: {}, children: [padId] }

      widgets[scaffoldId] = {
        id: scaffoldId, type: 'flutter.widgets.Scaffold',
        props: {},
        children: [appBarId, scrollId],
      }

      setScreenFromAI(activeScreenId, {
        ...project.screens[activeScreenId],
        rootWidgetId: scaffoldId,
        widgets,
      })
    }

    setPaintMsg(`✓ Screen painted from "${ifc.name}" — ${Object.keys(widgets).length} widgets`)
    setTimeout(() => setPaintMsg(null), 4000)
  }

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sideHead}>
          <span style={s.sideTitle}>Interfaces</span>
          <button style={s.addBtn} onClick={() => setAdding(true)} title="New interface">+</button>
        </div>

        {adding && (
          <div style={{ padding:'10px 12px', borderBottom:'1px solid #1e2d3d' }}>
            <input autoFocus style={{ flex:1, padding:'5px 8px', background:'#0a0a14', border:'1px solid #1e2d3d', borderRadius:5, fontSize:12, color:'#d4d4d4', outline:'none', width:'100%', marginBottom:6, fontFamily:'system-ui,sans-serif' }}
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="getKendraList"/>
            <div style={{ display:'flex', gap:6 }}>
              <button style={{ ...s.smallBtn, color:'#4caf7d', borderColor:'#14532d' }} onClick={handleAdd}>Create</button>
              <button style={s.smallBtn} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ flex:1, overflowY:'auto' as const }}>
          {interfaces.length === 0 && !adding && (
            <div style={{ padding:'20px 14px', textAlign:'center' as const, color:'#444' }}>
              <div style={{ fontSize:24, marginBottom:8, opacity:0.3 }}>⟳</div>
              <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>
                No interfaces yet
              </div>
              <div style={{ fontSize:11, color:'#333', lineHeight:1.6, marginBottom:12 }}>
                Define your API endpoints here — URL, method, auth, and response schema
              </div>
              <button onClick={() => setAdding(true)} style={{
                padding:'6px 14px', background:'#1e1a33',
                border:'1px solid #3d3060', borderRadius:6,
                color:'#9d7fe8', fontSize:11, cursor:'pointer',
                fontFamily:'system-ui,sans-serif',
              }}>+ New Interface</button>
            </div>
          )}
          {interfaces.map(ifc => (
            <div key={ifc.id}
              style={{ ...s.ifcItem,
                background: selected === ifc.id ? '#1e1a33' : 'transparent',
                color:      selected === ifc.id ? '#e0d7ff' : '#8892A4',
              }}
              onClick={() => setSelected(ifc.id)}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                <span style={{ fontFamily:'monospace', fontSize:10, fontWeight:700,
                  color: METHOD_COLORS[ifc.method], background: METHOD_COLORS[ifc.method] + '15',
                  padding:'1px 6px', borderRadius:3, border:'1px solid ' + METHOD_COLORS[ifc.method] + '44',
                }}>{ifc.method}</span>
                <span style={s.ifcName}>{ifc.name}</span>
                {/* Paint to Canvas button */}
                <button
                  title="Paint to Canvas — scaffold a full screen from this interface's schema"
                  onClick={e => { e.stopPropagation(); handlePaintToCanvas(ifc) }}
                  style={{
                    marginLeft:'auto', padding:'2px 7px', background:'#0a1a0f',
                    border:'1px solid #1a5c2e', borderRadius:4, color:'#4caf7d',
                    cursor:'pointer', fontSize:10, fontFamily:'system-ui,sans-serif',
                    flexShrink:0, lineHeight:1.4,
                  }}>
                  ⬡ Paint
                </button>
              </div>
              <div style={{ fontSize:10, color:'#555', fontFamily:'monospace', paddingLeft:2 }}>
                {ifc.urlPath.length > 26 ? ifc.urlPath.slice(0,24) + '…' : ifc.urlPath}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Paint toast */}
      {paintMsg && (
        <div style={{
          position:'absolute' as const, bottom:32, left:'50%', transform:'translateX(-50%)',
          background: paintMsg.startsWith('✓') ? '#0a1a0f' : '#1a0a0a',
          border:`1px solid ${paintMsg.startsWith('✓') ? '#1a5c2e' : '#5c1a1a'}`,
          borderRadius:10, padding:'10px 18px', fontSize:12,
          color: paintMsg.startsWith('✓') ? '#4caf7d' : '#e05252',
          zIndex:999, whiteSpace:'nowrap' as const, pointerEvents:'none' as const,
        }}>
          {paintMsg}
        </div>
      )}

      {/* Editor */}
      {selectedIfc ? (
        <InterfaceEditor key={selectedIfc.id} ifc={selectedIfc} engineUrl={engineUrl} />
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center', gap:10, color:'#444', padding:24 }}>
          <div style={{ fontSize:32, opacity:0.2 }}>⟳</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#555' }}>Select an interface</div>
          <div style={{ fontSize:12, color:'#333', textAlign:'center' as const, lineHeight:1.6, maxWidth:280 }}>
            Each interface defines an API endpoint — URL, method, auth, and response schema.<br/><br/>
            Use <strong style={{ color:'#9d7fe8' }}>⬡ Paint</strong> next to any interface to scaffold a full screen from its response schema.
          </div>
        </div>
      )}
    </div>
  )
}
