import React, { useState, useRef, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import type { AssetDefinition } from '../../types/widget.schema'

// ─────────────────────────────────────────────────────────
// ANDROID ICON SIZES
// ─────────────────────────────────────────────────────────
const ANDROID_ICON_SIZES = [
  { name: 'mipmap-mdpi',    size: 48,  desc: '1×' },
  { name: 'mipmap-hdpi',    size: 72,  desc: '1.5×' },
  { name: 'mipmap-xhdpi',   size: 96,  desc: '2×' },
  { name: 'mipmap-xxhdpi',  size: 144, desc: '3×' },
  { name: 'mipmap-xxxhdpi', size: 192, desc: '4×' },
]

const IOS_ICON_SIZES = [
  { name: 'Icon-20',    size: 20  },
  { name: 'Icon-20@2x', size: 40  },
  { name: 'Icon-20@3x', size: 60  },
  { name: 'Icon-29',    size: 29  },
  { name: 'Icon-29@2x', size: 58  },
  { name: 'Icon-29@3x', size: 87  },
  { name: 'Icon-40',    size: 40  },
  { name: 'Icon-40@2x', size: 80  },
  { name: 'Icon-40@3x', size: 120 },
  { name: 'Icon-60@2x', size: 120 },
  { name: 'Icon-60@3x', size: 180 },
  { name: 'Icon-76',    size: 76  },
  { name: 'Icon-76@2x', size: 152 },
  { name: 'Icon-1024',  size: 1024 },
]

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

type AssetTab = 'launcher' | 'splash' | 'images'

export default function AssetsManager(): JSX.Element {
  const { project, addAsset, removeAsset, updateAsset } = useCanvasStore()
  const [tab, setTab]           = useState<AssetTab>('launcher')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const assets    = project?.assets || []
  const iconAsset = assets.find(a => a.type === 'image' && a.path === 'assets/icon/icon.png')
  const splashAsset = assets.find(a => a.type === 'image' && a.path === 'assets/splash/splash.png')
  const imageAssets = assets.filter(a => a.type === 'image'
    && a.path !== 'assets/icon/icon.png'
    && a.path !== 'assets/splash/splash.png')

  // Read file as base64 data URL
  const readFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // Handle launcher icon upload
  const handleIconUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await readFile(file)
    const assetData = { id: 'asset_icon', name: file.name,
      path: 'assets/icon/icon.png', type: 'image' as const, dataUrl } as any
    if (iconAsset) {
      updateAsset(iconAsset.id, assetData)
    } else {
      addAsset(assetData)
    }
  }, [iconAsset, addAsset, updateAsset])

  // Handle splash upload
  const handleSplashUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await readFile(file)
    const assetData = { id: 'asset_splash', name: file.name,
      path: 'assets/splash/splash.png', type: 'image' as const, dataUrl } as any
    if (splashAsset) {
      updateAsset(splashAsset.id, assetData)
    } else {
      addAsset(assetData)
    }
  }, [splashAsset, addAsset, updateAsset])

  // Handle in-app image upload
  const handleImageUpload = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await readFile(file)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()
      const existing = imageAssets.find(a => a.path === `assets/images/${safeName}`)
      if (existing) {
        updateAsset(existing.id, { ...(existing as any), dataUrl } as any)
      } else {
        addAsset({
          id: 'asset_' + Date.now() + '_' + safeName,
          name: safeName.replace(/\.[^/.]+$/, ''),
          path: `assets/images/${safeName}`,
          type: 'image',
          ...({ dataUrl } as any),
        } as any)
      }
    }
  }, [imageAssets, addAsset, updateAsset])

  if (!project) return (
    <div style={s.empty}>
      <div style={{ fontSize:32, marginBottom:12 }}>🖼</div>
      <div style={{ fontSize:14, color:'#555' }}>No project loaded</div>
      <div style={{ fontSize:12, color:'#333', marginTop:6 }}>Import or create a project first</div>
    </div>
  )

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#e0d7ff' }}>App Icons & Images</div>
          <div style={{ fontSize:10, color:'#555' }}>
            {assets.length} asset{assets.length !== 1 ? 's' : ''} · auto-included in generated project
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabRow}>
        {([
          { id:'launcher', icon:'📱', label:'App Icon'   },
          { id:'splash',   icon:'✦',  label:'Splash'     },
          { id:'images',   icon:'🖼',  label:'Images'     },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...s.tabBtn,
            background:   tab===t.id ? '#1e1a33' : 'transparent',
            color:        tab===t.id ? '#e0d7ff' : '#555',
            borderBottom: tab===t.id ? '2px solid #7c5cbf' : '2px solid transparent',
          }}>
            <span style={{ fontSize:13 }}>{t.icon}</span>
            <span style={{ fontSize:11 }}>{t.label}</span>
            {t.id === 'launcher' && iconAsset   && <span style={s.dot}/>}
            {t.id === 'splash'   && splashAsset  && <span style={s.dot}/>}
            {t.id === 'images'   && imageAssets.length > 0 && (
              <span style={s.badge}>{imageAssets.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={s.body}>

        {/* ── LAUNCHER ICON TAB ── */}
        {tab === 'launcher' && (
          <LauncherIconTab
            iconAsset={iconAsset as any}
            onUpload={handleIconUpload}
          />
        )}

        {/* ── SPLASH SCREEN TAB ── */}
        {tab === 'splash' && (
          <SplashTab
            splashAsset={splashAsset as any}
            onUpload={handleSplashUpload}
            primaryColor={project.theme?.primaryColor?.hex || '#00875A'}
          />
        )}

        {/* ── IN-APP IMAGES TAB ── */}
        {tab === 'images' && (
          <ImagesTab
            images={imageAssets as any[]}
            onUpload={handleImageUpload}
            onRemove={removeAsset}
          />
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// LAUNCHER ICON TAB
// ─────────────────────────────────────────────────────────

function LauncherIconTab({ iconAsset, onUpload }: { iconAsset: any; onUpload: (f: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      <div style={s.infoBox}>
        Upload one <strong>1024×1024px</strong> PNG. The IDE will show previews
        at all Android and iOS sizes. These get exported into the generated Flutter
        project as <code>assets/icon/icon.png</code> — use with{' '}
        <code>flutter_launcher_icons</code> package.
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...s.dropZone,
          borderColor: dragOver ? '#7c5cbf' : iconAsset?.dataUrl ? '#1a5c2e' : '#2a2a3a',
          background:  dragOver ? '#0a0a2a' : 'transparent',
        }}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
      >
        {iconAsset?.dataUrl ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <img src={iconAsset.dataUrl} alt="App Icon"
              style={{ width:96, height:96, borderRadius:20, imageRendering:'auto' }}/>
            <div style={{ fontSize:12, color:'#4caf7d' }}>✓ {iconAsset.name}</div>
            <div style={{ fontSize:10, color:'#555' }}>Click to replace</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:40 }}>📱</div>
            <div style={{ fontSize:13, color:'#666' }}>Drop icon PNG here</div>
            <div style={{ fontSize:11, color:'#444' }}>or click to browse · 1024×1024px recommended</div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg"
        style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) onUpload(f) }}/>

      {/* Size previews */}
      {iconAsset?.dataUrl && (
        <>
          <div style={s.sectionTitle}>Android previews</div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' as const }}>
            {ANDROID_ICON_SIZES.map(sz => (
              <div key={sz.name} style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:6 }}>
                <img src={iconAsset.dataUrl} alt={sz.name}
                  style={{ width:sz.size/3, height:sz.size/3, borderRadius: (sz.size/3)*0.2,
                    border:'1px solid #2a2a3a', imageRendering:'auto' }}/>
                <div style={{ fontSize:9, color:'#555', textAlign:'center' as const }}>{sz.name}<br/>{sz.size}px</div>
              </div>
            ))}
          </div>

          <div style={s.sectionTitle}>iOS previews</div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' as const }}>
            {[20,29,40,60,76,120,152,180].map(sz => (
              <div key={sz} style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:4 }}>
                <img src={iconAsset.dataUrl} alt={`${sz}px`}
                  style={{ width:sz/3, height:sz/3, borderRadius:(sz/3)*0.22,
                    border:'1px solid #2a2a3a', imageRendering:'auto' }}/>
                <div style={{ fontSize:9, color:'#555' }}>{sz}px</div>
              </div>
            ))}
          </div>

          {/* Home screen mock */}
          <div style={s.sectionTitle}>Home screen preview</div>
          <div style={{ display:'flex', gap:24 }}>
            <HomeScreenMock iconUrl={iconAsset.dataUrl} platform="android" label={iconAsset.name?.replace(/\.[^/.]+$/,'')||'App'}/>
            <HomeScreenMock iconUrl={iconAsset.dataUrl} platform="ios"     label={iconAsset.name?.replace(/\.[^/.]+$/,'')||'App'}/>
          </div>

          {/* pubspec.yaml snippet */}
          <div style={s.sectionTitle}>Add to pubspec.yaml</div>
          <div style={s.codeBlock}>
            <pre style={{ margin:0, fontSize:11, color:'#9cdcfe', lineHeight:1.8 }}>{`dev_dependencies:
  flutter_launcher_icons: ^0.13.1

flutter_launcher_icons:
  android: true
  ios: true
  image_path: "assets/icon/icon.png"
  adaptive_icon_background: "#${iconAsset.name?.includes('white') ? 'FFFFFF' : '00875A'}"
  adaptive_icon_foreground: "assets/icon/icon.png"
  web:
    generate: true
    image_path: "assets/icon/icon.png"`}</pre>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// HOME SCREEN MOCK
// ─────────────────────────────────────────────────────────

function HomeScreenMock({ iconUrl, platform, label }: { iconUrl: string; platform: 'android'|'ios'; label: string }) {
  const isIos = platform === 'ios'
  return (
    <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:6 }}>
      <div style={s.sectionTitle}>{isIos ? 'iOS' : 'Android'}</div>
      {/* Mini phone */}
      <div style={{ width:100, height:180, background:'#1a1a2e', borderRadius:14,
        border:'2px solid #2a2a3a', display:'flex', flexDirection:'column' as const,
        alignItems:'center', justifyContent:'center', padding:8, gap:4 }}>
        {/* Status bar */}
        <div style={{ width:'100%', height:8, display:'flex', alignItems:'center',
          justifyContent:'space-between', paddingBottom:4 }}>
          <div style={{ fontSize:6, color:'#fff' }}>9:41</div>
          <div style={{ fontSize:6, color:'#fff' }}>▲▲▲</div>
        </div>
        {/* Wallpaper area */}
        <div style={{ flex:1, width:'100%', background: isIos
          ? 'linear-gradient(135deg,#1a2a4a,#2a1a4a)'
          : 'linear-gradient(135deg,#1a3a2a,#0a1a2a)',
          borderRadius:8, display:'flex', flexDirection:'column' as const,
          alignItems:'center', justifyContent:'center', gap:4 }}>
          {/* App icon */}
          <img src={iconUrl} alt="icon"
            style={{ width:36, height:36,
              borderRadius: isIos ? 8 : 10,
              boxShadow:'0 2px 8px rgba(0,0,0,0.5)' }}/>
          <div style={{ fontSize:7, color:'#fff', textAlign:'center' as const,
            maxWidth:44, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
            {label}
          </div>
        </div>
        {/* Home bar */}
        {isIos && <div style={{ width:30, height:3, background:'#fff', borderRadius:2, opacity:0.4, marginTop:4 }}/>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// SPLASH SCREEN TAB
// ─────────────────────────────────────────────────────────

function SplashTab({ splashAsset, onUpload, primaryColor }: {
  splashAsset: any; onUpload: (f: File) => void; primaryColor: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [bgColor, setBgColor]   = useState(primaryColor)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      <div style={s.infoBox}>
        Upload a <strong>PNG logo/image</strong> for the splash screen.
        Choose a background color below. Works with the{' '}
        <code>flutter_native_splash</code> package.
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...s.dropZone,
          borderColor: dragOver ? '#7c5cbf' : splashAsset?.dataUrl ? '#1a5c2e' : '#2a2a3a',
        }}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
      >
        {splashAsset?.dataUrl ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <img src={splashAsset.dataUrl} alt="Splash"
              style={{ maxWidth:120, maxHeight:80, objectFit:'contain' }}/>
            <div style={{ fontSize:12, color:'#4caf7d' }}>✓ {splashAsset.name}</div>
            <div style={{ fontSize:10, color:'#555' }}>Click to replace</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:40 }}>✦</div>
            <div style={{ fontSize:13, color:'#666' }}>Drop splash image here</div>
            <div style={{ fontSize:11, color:'#444' }}>PNG with transparent background recommended</div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg"
        style={{ display:'none' }} onChange={e => { const f=e.target.files?.[0]; if(f) onUpload(f) }}/>

      {/* Background color */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:12, color:'#888' }}>Background color</div>
        <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
          style={{ width:36, height:28, border:'none', borderRadius:6,
            background:'transparent', cursor:'pointer' }}/>
        <div style={{ fontSize:11, color:'#555', fontFamily:'monospace' }}>{bgColor}</div>
      </div>

      {/* Splash preview */}
      {splashAsset?.dataUrl && (
        <>
          <div style={s.sectionTitle}>Splash preview</div>
          <div style={{ display:'flex', gap:20 }}>
            {['portrait','landscape'].map(orient => (
              <div key={orient} style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', gap:6 }}>
                <div style={s.sectionTitle}>{orient}</div>
                <div style={{
                  width:  orient==='portrait' ? 100 : 180,
                  height: orient==='portrait' ? 180 : 100,
                  background: bgColor,
                  borderRadius: 12,
                  border: '2px solid #2a2a3a',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <img src={splashAsset.dataUrl} alt="splash"
                    style={{ maxWidth:'60%', maxHeight:'60%', objectFit:'contain' }}/>
                </div>
              </div>
            ))}
          </div>

          {/* pubspec snippet */}
          <div style={s.sectionTitle}>Add to pubspec.yaml</div>
          <div style={s.codeBlock}>
            <pre style={{ margin:0, fontSize:11, color:'#9cdcfe', lineHeight:1.8 }}>{`dev_dependencies:
  flutter_native_splash: ^2.3.10

flutter_native_splash:
  color: "${bgColor}"
  image: assets/splash/splash.png
  android: true
  ios: true
  web: true`}</pre>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// IN-APP IMAGES TAB
// ─────────────────────────────────────────────────────────

function ImagesTab({ images, onUpload, onRemove }: {
  images: any[]; onUpload: (files: FileList) => void; onRemove: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files)
  }

  const selectedImg = images.find(i => i.id === selected)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      <div style={s.infoBox}>
        Manage in-app images — logos, banners, placeholders, background images.
        All assets are exported to <code>assets/images/</code> in the generated project.
        Reference in Flutter: <code>Image.asset('assets/images/logo.png')</code>
      </div>

      {/* Upload drop zone */}
      <div
        style={{
          ...s.dropZone,
          minHeight: 70,
          padding: '14px 16px',
          borderColor: dragOver ? '#7c5cbf' : '#2a2a3a',
          background:  dragOver ? '#0a0a2a' : 'transparent',
        }}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:24 }}>+</span>
          <div>
            <div style={{ fontSize:13, color:'#666' }}>Drop images here or click to browse</div>
            <div style={{ fontSize:10, color:'#444' }}>PNG, JPG, SVG, WebP · multiple files supported</div>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple
        style={{ display:'none' }} onChange={e => { if(e.target.files?.length) onUpload(e.target.files) }}/>

      {/* Image grid */}
      {images.length > 0 && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {images.map(img => (
              <div key={img.id}
                onClick={() => setSelected(selected===img.id ? null : img.id)}
                style={{
                  background: '#13132a',
                  border: `1px solid ${selected===img.id ? '#7c5cbf' : '#2a2a3a'}`,
                  borderRadius:8, overflow:'hidden', cursor:'pointer',
                  transition:'border-color 0.15s',
                }}>
                {img.dataUrl ? (
                  <img src={img.dataUrl} alt={img.name}
                    style={{ width:'100%', height:64, objectFit:'cover', display:'block' }}/>
                ) : (
                  <div style={{ width:'100%', height:64, background:'#0a0a14',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:20, color:'#333' }}>🖼</div>
                )}
                <div style={{ padding:'5px 8px' }}>
                  <div style={{ fontSize:10, color:'#888', overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                    {img.name}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected image detail */}
          {selectedImg && (
            <div style={{ background:'#13132a', border:'1px solid #2a2a3a',
              borderRadius:10, padding:14, display:'flex', flexDirection:'column' as const, gap:10 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                {selectedImg.dataUrl && (
                  <img src={selectedImg.dataUrl} alt={selectedImg.name}
                    style={{ width:72, height:72, objectFit:'contain',
                      background:'#0a0a14', borderRadius:6, border:'1px solid #2a2a3a' }}/>
                )}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e0d7ff', marginBottom:4 }}>
                    {selectedImg.name}
                  </div>
                  <div style={{ fontSize:11, color:'#555', fontFamily:'monospace' }}>
                    {selectedImg.path}
                  </div>
                  <div style={{ marginTop:10, padding:'6px 10px',
                    background:'#080812', borderRadius:6, fontSize:11,
                    color:'#9cdcfe', fontFamily:'monospace' }}>
                    Image.asset('{selectedImg.path}')
                  </div>
                </div>
              </div>
              <button
                onClick={() => { onRemove(selectedImg.id); setSelected(null) }}
                style={{ alignSelf:'flex-end' as const, padding:'5px 14px',
                  background:'#1a0a0a', border:'1px solid #5c1a1a',
                  borderRadius:6, color:'#e05252', fontSize:11, cursor:'pointer' }}>
                🗑 Remove
              </button>
            </div>
          )}

          {/* pubspec assets list */}
          <div style={s.sectionTitle}>Add to pubspec.yaml</div>
          <div style={s.codeBlock}>
            <pre style={{ margin:0, fontSize:11, color:'#9cdcfe', lineHeight:1.8 }}>{`flutter:
  assets:
${images.map(img => `    - ${img.path}`).join('\n')}`}</pre>
          </div>
        </>
      )}

      {images.length === 0 && (
        <div style={{ textAlign:'center' as const, padding:'24px 0', color:'#333', fontSize:13 }}>
          No images added yet
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:         { display:'flex', flexDirection:'column', height:'100%', background:'#0d0d1a', overflow:'hidden' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  tabRow:       { display:'flex', padding:'0 8px', gap:2, borderBottom:'1px solid #1e1e2e', flexShrink:0 },
  tabBtn:       { display:'flex', alignItems:'center', gap:5, padding:'8px 12px', border:'none', cursor:'pointer', fontSize:11, fontFamily:'system-ui,sans-serif', background:'transparent', position:'relative' as const },
  dot:          { width:6, height:6, borderRadius:'50%', background:'#4caf7d', position:'absolute' as const, top:6, right:4 },
  badge:        { fontSize:9, padding:'1px 5px', borderRadius:8, background:'#7c5cbf', color:'#fff', marginLeft:2 },
  body:         { flex:1, overflowY:'auto', padding:16 },
  empty:        { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#444' },
  infoBox:      { padding:'10px 14px', background:'#0a1a0f', border:'1px solid #1a5c2e', borderRadius:8, fontSize:12, color:'#6dda9d', lineHeight:1.7 },
  dropZone:     { border:'2px dashed', borderRadius:12, padding:'28px 16px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.2s', minHeight:100 },
  sectionTitle: { fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.07em', textTransform:'uppercase' as const, margin:'8px 0 6px' },
  codeBlock:    { background:'#080812', border:'1px solid #1e1e2e', borderRadius:8, padding:'12px 14px', overflow:'auto' },
}
