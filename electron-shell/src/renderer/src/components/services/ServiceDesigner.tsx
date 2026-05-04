import React, { useState } from 'react'
import { useProjectStore, type ServiceEntry } from '../../store/project.store'

interface Props { engineUrl: string }

const COLORS = ['#7c5cbf','#4a9edd','#2da44e','#e09b2d','#e05252','#4caf7d','#9d7fe8','#63b3ed']

export default function ServiceDesigner({ engineUrl }: Props): JSX.Element {
  const {
    gateway, services, selectedId,
    addService, updateService, removeService, selectService,
    updateGateway, lastOutputDir, setOutputDir,
  } = useProjectStore()

  const [outputDir, setLocalOutputDir] = useState(lastOutputDir)
  const [newName,   setNewName]        = useState('')
  const [newPort,   setNewPort]        = useState('8084')
  const [status,    setStatus]         = useState<'idle'|'running'|'success'|'error'>('idle')
  const [result,    setResult]         = useState<any>(null)
  const [editingGw, setEditingGw]      = useState(false)

  const selected = services.find(s => s.id === selectedId) || null

  const handleAddService = () => {
    if (!newName.trim()) return
    addService(newName.trim(), parseInt(newPort) || 8084)
    setNewName('')
    setNewPort(String(parseInt(newPort) + 1))
  }

  const handleOutputDir = (val: string) => {
    setLocalOutputDir(val)
    setOutputDir(val)
  }

  const buildGraphPayload = () => {
    const servicesMap: Record<string, any> = {}
    services.forEach(svc => {
      servicesMap[svc.id] = {
        id: svc.id, name: svc.name, artifactId: svc.artifactId,
        groupId: svc.groupId, version: svc.version, port: svc.port,
        javaVersion: svc.javaVersion, springBootVersion: svc.springBootVersion,
        apiBasePath: svc.apiBasePath, description: svc.description,
        endpoints: [], schemas: [], dependencies: [],
        security: svc.hasJwt
          ? { scheme:'jwt', publicPaths:['/actuator/**','/swagger-ui/**','/v3/api-docs/**'] }
          : { scheme:'none' },
        database: svc.hasDatabase
          ? { engine:'postgresql', name: svc.artifactId.replace(/-/g,'_')+'_db', tables:[], flywayEnabled:true }
          : null,
        kafkaTopics: svc.hasKafka ? [{ name: svc.artifactId+'.events', pattern:'publish' }] : [],
        infra: {
          docker: { baseImage:'eclipse-temurin:21-jre-alpine', exposedPort:svc.port, healthCheckPath:'/actuator/health', envVars:[] },
          kubernetes: { namespace:'default', replicas:{min:2,max:5}, resources:{requests:{cpu:'250m',memory:'256Mi'},limits:{cpu:'500m',memory:'512Mi'}}, livenessProbe:{path:'/actuator/health',port:svc.port,initialDelaySeconds:30,periodSeconds:10}, readinessProbe:{path:'/actuator/health',port:svc.port,initialDelaySeconds:20,periodSeconds:5}, serviceType:'ClusterIP' },
          cicd: { provider:'github-actions', registry:'registry.example.com', imageName:`example/${svc.artifactId}`, branchStrategy:'gitflow', environments:[{name:'dev',namespace:'dev',valuesFile:'values-dev.yaml'}] },
        },
      }
    })

    return {
      id: 'graph_' + Date.now(), name: 'MyServiceGraph',
      gateway: {
        id: 'gw_1', groupId: gateway.groupId, artifactId: gateway.artifactId,
        version: gateway.version, port: gateway.port, routes: [],
        auth: { jwtEnabled: gateway.jwtEnabled, jwtSecret:'${JWT_SECRET}' },
        globalCors: { allowedOrigins: gateway.corsOrigins, allowedMethods:['GET','POST','PUT','DELETE','PATCH'], allowedHeaders:['*'], allowCredentials:false },
        infra: {
          docker: { baseImage:'eclipse-temurin:21-jre-alpine', exposedPort:gateway.port, healthCheckPath:'/actuator/health', envVars:[] },
          kubernetes: { namespace:'default', replicas:{min:2,max:5}, resources:{requests:{cpu:'250m',memory:'256Mi'},limits:{cpu:'500m',memory:'512Mi'}}, livenessProbe:{path:'/actuator/health',port:gateway.port,initialDelaySeconds:30,periodSeconds:10}, readinessProbe:{path:'/actuator/health',port:gateway.port,initialDelaySeconds:20,periodSeconds:5}, serviceType:'ClusterIP' },
          cicd: { provider:'github-actions', registry:'registry.example.com', imageName:'example/api-gateway', branchStrategy:'gitflow', environments:[{name:'dev',namespace:'dev',valuesFile:'values-dev.yaml'}] },
        },
      },
      services: servicesMap,
    }
  }

  const generateGraph = async () => {
    if (!outputDir) { alert('Please enter an output directory'); return }
    setStatus('running'); setResult(null)
    try {
      const res = await fetch(engineUrl + '/api/codegen/service-graph', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ payload: JSON.stringify(buildGraphPayload()), outputDir }),
      })
      const data = await res.json()
      if (data.success) { setStatus('success'); setResult(data) }
      else              { setStatus('error');   setResult({ success:false, error:data.error||'Failed' }) }
    } catch (err) {
      setStatus('error'); setResult({ success:false, error:String(err) })
    }
  }

  return (
    <div style={s.root}>

      {/* ── Left: Service list ────────────────────────── */}
      <div style={s.left}>
        <div style={s.panelHeader}>
          <span style={s.pt}>SERVICES</span>
          <span style={s.count}>{services.length}</span>
        </div>

        {/* Gateway entry */}
        <div onClick={() => { selectService(null); setEditingGw(true) }} style={{
          ...s.serviceCard, borderColor: editingGw && !selectedId ? '#7c5cbf' : '#1e1e2e',
          background: editingGw && !selectedId ? '#1a1a2e' : '#0a0a14',
        }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:'#7c5cbf', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#e0d7ff' }}>API Gateway</div>
            <div style={{ fontSize:9, color:'#555' }}>:{gateway.port} · {gateway.artifactId}</div>
          </div>
          <span style={{ fontSize:9, color:'#555' }}>GW</span>
        </div>

        <div style={{ height:1, background:'#1e1e2e', margin:'4px 0' }} />

        {/* Service list */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {services.map(svc => (
            <div key={svc.id} onClick={() => { selectService(svc.id); setEditingGw(false) }} style={{
              ...s.serviceCard,
              borderColor: selectedId===svc.id ? svc.color : '#1e1e2e',
              background:  selectedId===svc.id ? '#1a1a2e' : 'transparent',
            }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:svc.color, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#e0d7ff' }}>{svc.name}</div>
                <div style={{ fontSize:9, color:'#555' }}>:{svc.port} · {svc.artifactId}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); removeService(svc.id) }}
                style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:13 }}>×</button>
            </div>
          ))}
        </div>

        {/* Add service */}
        <div style={{ borderTop:'1px solid #1e1e2e', padding:10 }}>
          <div style={s.fl}>Add service</div>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key==='Enter' && handleAddService()}
            placeholder="e.g. PaymentService" style={s.input} />
          <div style={{ display:'flex', gap:6, marginTop:6 }}>
            <input value={newPort} onChange={e => setNewPort(e.target.value)}
              placeholder="Port" style={{ ...s.input, width:64 }} />
            <button onClick={handleAddService} style={s.addBtn}>+ Add</button>
          </div>
        </div>
      </div>

      {/* ── Centre: Visual graph ──────────────────────── */}
      <div style={s.centre}>
        <div style={s.graphLabel}>Service Graph</div>

        {/* Gateway node */}
        <div style={s.gatewayNode}>
          <span style={{ fontSize:18, color:'#7c5cbf' }}>⬡</span>
          <div style={{ fontSize:12, fontWeight:700, color:'#e0d7ff' }}>API Gateway</div>
          <div style={{ fontSize:10, color:'#555' }}>:{gateway.port}</div>
          <div style={{ fontSize:9, color:'#555' }}>
            {gateway.jwtEnabled ? '🔒 JWT' : '🔓 Open'} · CORS: {gateway.corsOrigins.join(', ')}
          </div>
        </div>

        {/* Connection lines */}
        <div style={{ display:'flex', justifyContent:'center', gap:20, margin:'6px 0' }}>
          {services.map(svc => (
            <div key={svc.id} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ width:1, height:20, background: svc.color, opacity:0.6 }} />
            </div>
          ))}
        </div>

        {/* Service nodes */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', maxWidth:480 }}>
          {services.map(svc => (
            <div key={svc.id} onClick={() => { selectService(svc.id); setEditingGw(false) }}
              style={{
                ...s.serviceNode,
                borderColor: selectedId===svc.id ? svc.color : '#2a2a3a',
                background:  selectedId===svc.id ? '#1a1a2e' : '#0f0f1e',
                boxShadow:   selectedId===svc.id ? `0 0 12px ${svc.color}44` : 'none',
              }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:svc.color }} />
              <div style={{ fontSize:11, fontWeight:600, color:'#e0d7ff' }}>{svc.name}</div>
              <div style={{ fontSize:9, color:'#555' }}>:{svc.port}</div>
              <div style={{ display:'flex', gap:4, marginTop:3, flexWrap:'wrap', justifyContent:'center' }}>
                {svc.hasDatabase && <span style={s.featureTag}>DB</span>}
                {svc.hasKafka   && <span style={s.featureTag}>Kafka</span>}
                {svc.hasJwt     && <span style={s.featureTag}>JWT</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:10, color:'#333', marginTop:12 }}>
          {services.length} microservice{services.length !== 1 ? 's' : ''} · 1 gateway · Spring Boot 3.2
        </div>
      </div>

      {/* ── Right: Properties + Generate ──────────────── */}
      <div style={s.right}>

        {/* Properties editor */}
        {(selected || editingGw) && (
          <div style={s.propsSection}>
            <div style={s.panelHeader}>
              <span style={s.pt}>{editingGw ? 'GATEWAY' : 'SERVICE'}</span>
            </div>

            {editingGw ? (
              // Gateway properties
              <>
                <PropRow label="Port">
                  <input type="number" value={gateway.port}
                    onChange={e => updateGateway({ port: parseInt(e.target.value)||8080 })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="Group ID">
                  <input type="text" value={gateway.groupId}
                    onChange={e => updateGateway({ groupId: e.target.value })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="Artifact ID">
                  <input type="text" value={gateway.artifactId}
                    onChange={e => updateGateway({ artifactId: e.target.value })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="JWT">
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                    <input type="checkbox" checked={gateway.jwtEnabled}
                      onChange={e => updateGateway({ jwtEnabled: e.target.checked })} />
                    <span style={{ fontSize:11, color: gateway.jwtEnabled ? '#4caf7d' : '#555' }}>
                      {gateway.jwtEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </PropRow>
              </>
            ) : selected ? (
              // Service properties
              <>
                <PropRow label="Name">
                  <input type="text" value={selected.name}
                    onChange={e => updateService(selected.id, { name: e.target.value })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="Artifact ID">
                  <input type="text" value={selected.artifactId}
                    onChange={e => updateService(selected.id, { artifactId: e.target.value })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="Group ID">
                  <input type="text" value={selected.groupId}
                    onChange={e => updateService(selected.id, { groupId: e.target.value })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="Port">
                  <input type="number" value={selected.port}
                    onChange={e => updateService(selected.id, { port: parseInt(e.target.value)||8080 })}
                    style={s.propInput} />
                </PropRow>
                <PropRow label="Base Path">
                  <input type="text" value={selected.apiBasePath}
                    onChange={e => updateService(selected.id, { apiBasePath: e.target.value })}
                    style={s.propInput} />
                </PropRow>
                <div style={{ padding:'6px 0', borderTop:'1px solid #1e1e2e', marginTop:4 }}>
                  <div style={s.fl}>Features</div>
                  {[
                    { key:'hasDatabase', label:'PostgreSQL + Flyway' },
                    { key:'hasKafka',    label:'Kafka events'        },
                    { key:'hasJwt',      label:'JWT security'        },
                  ].map(f => (
                    <label key={f.key} style={{ display:'flex', alignItems:'center', gap:8,
                      padding:'4px 0', cursor:'pointer', fontSize:11 }}>
                      <input type="checkbox"
                        checked={selected[f.key as keyof ServiceEntry] as boolean}
                        onChange={e => updateService(selected.id, { [f.key]: e.target.checked })} />
                      <span style={{ color: (selected[f.key as keyof ServiceEntry] as boolean) ? '#ccc' : '#555' }}>
                        {f.label}
                      </span>
                    </label>
                  ))}
                </div>
                <PropRow label="Color">
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {COLORS.map(c => (
                      <div key={c} onClick={() => updateService(selected.id, { color: c })}
                        style={{ width:16, height:16, borderRadius:'50%', background:c, cursor:'pointer',
                          outline: selected.color===c ? `2px solid ${c}` : 'none', outlineOffset:2 }} />
                    ))}
                  </div>
                </PropRow>
              </>
            ) : null}
          </div>
        )}

        {/* Generate section */}
        <div style={{ borderTop:'1px solid #1e1e2e', padding:12, flex:1, overflowY:'auto' }}>
          <div style={s.panelHeader}><span style={s.pt}>GENERATE</span></div>

          <div style={s.fl}>Summary</div>
          <div style={s.infoRow}><span style={s.il}>Services</span><span style={s.iv}>{services.length}</span></div>
          <div style={s.infoRow}><span style={s.il}>Gateway</span><span style={s.iv}>✓ Spring Cloud</span></div>
          <div style={s.infoRow}><span style={s.il}>DB services</span><span style={s.iv}>{services.filter(s=>s.hasDatabase).length}</span></div>
          <div style={s.infoRow}><span style={s.il}>Kafka topics</span><span style={s.iv}>{services.filter(s=>s.hasKafka).length}</span></div>

          <div style={{ ...s.fl, marginTop:10 }}>Output directory</div>
          <input type="text" value={outputDir} onChange={e => handleOutputDir(e.target.value)}
            placeholder="e.g. D:\output\my-graph" style={s.input} />

          <button onClick={generateGraph}
            disabled={status==='running' || services.length===0}
            style={{ ...s.genBtn, opacity: status==='running' ? 0.5 : 1 }}>
            {status==='running' ? '◌  Generating...' : '▶  Generate All'}
          </button>

          {result && (
            <div style={{ marginTop:8, padding:10, borderRadius:8, border:'1px solid',
              borderColor: result.success ? '#1a5c2e' : '#5c1a1a',
              background:  result.success ? '#0a1a0f' : '#1a0a0a' }}>
              {result.success ? (
                <>
                  <div style={{ color:'#4caf7d', fontWeight:600, fontSize:12, marginBottom:4 }}>
                    ✓ {result.files?.length ?? 0} files generated
                  </div>
                  {result.files?.slice(0,5).map((f: string, i: number) => (
                    <div key={i} style={{ fontSize:10, color:'#666', fontFamily:'monospace' }}>
                      • {f.split(/[/\\]/).slice(-3).join('/')}
                    </div>
                  ))}
                  {(result.files?.length ?? 0) > 5 && (
                    <div style={{ fontSize:10, color:'#444', marginTop:2 }}>
                      ...and {result.files.length - 5} more
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color:'#e05252', fontSize:11 }}>✗ {result.error}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', fontSize:11 }}>
      <div style={{ width:60, color:'#555', flexShrink:0, fontSize:10 }}>{label}</div>
      <div style={{ flex:1 }}>{children}</div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:        { display:'flex', height:'100%', overflow:'hidden' },
  left:        { width:210, flexShrink:0, background:'#0a0a16', borderRight:'1px solid #1e1e2e', display:'flex', flexDirection:'column', overflow:'hidden' },
  centre:      { flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:20, overflowY:'auto', background:'#0d0d1a' },
  right:       { width:220, flexShrink:0, background:'#0a0a16', borderLeft:'1px solid #1e1e2e', display:'flex', flexDirection:'column', overflow:'hidden' },
  panelHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px 4px' },
  pt:          { fontSize:9, fontWeight:700, color:'#444', letterSpacing:'0.08em' },
  count:       { fontSize:10, padding:'1px 6px', borderRadius:10, background:'#1e1a33', color:'#9d7fe8', border:'1px solid #3d3060' },
  serviceCard: { display:'flex', alignItems:'center', gap:8, padding:'7px 12px', cursor:'pointer', border:'1px solid', borderRadius:0, marginBottom:2 },
  addBtn:      { flex:1, padding:'6px 8px', background:'#1e1a33', border:'1px solid #3d3060', borderRadius:6, color:'#9d7fe8', fontSize:11, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
  fl:          { fontSize:9, fontWeight:700, color:'#555', letterSpacing:'0.07em', textTransform:'uppercase' as const, padding:'4px 10px 3px' },
  input:       { width:'100%', padding:'6px 8px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:5, fontSize:11, color:'#d4d4d4', outline:'none', fontFamily:'monospace' },
  graphLabel:  { fontSize:13, fontWeight:700, color:'#555', marginBottom:14, letterSpacing:'0.05em' },
  gatewayNode: { display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 24px', borderRadius:12, border:'2px solid #7c5cbf', background:'#1e1a33', gap:3, cursor:'pointer' },
  serviceNode: { display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 14px', borderRadius:10, border:'1px solid', cursor:'pointer', minWidth:100, gap:2 },
  featureTag:  { fontSize:8, padding:'1px 4px', borderRadius:4, background:'#1a1a2e', color:'#666', border:'1px solid #2a2a3a' },
  propsSection:{ borderBottom:'1px solid #1e1e2e', paddingBottom:8 },
  propInput:   { width:'100%', padding:'4px 6px', background:'#0a0a14', border:'1px solid #2a2a3a', borderRadius:4, fontSize:11, color:'#d4d4d4', outline:'none', fontFamily:'monospace' },
  infoRow:     { display:'flex', justifyContent:'space-between', fontSize:11, padding:'2px 10px' },
  il:          { color:'#555' },
  iv:          { color:'#888', fontFamily:'monospace', fontSize:10 },
  genBtn:      { marginTop:10, width:'100%', padding:10, background:'#7c5cbf', border:'none', borderRadius:8, color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'system-ui,sans-serif' },
}
