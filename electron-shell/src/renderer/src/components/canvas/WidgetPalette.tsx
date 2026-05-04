import React, { useState } from 'react'
import type { WidgetType } from '../../types/widget.schema'

export interface PaletteItem {
  type:            WidgetType
  label:           string
  icon:            string
  category:        string
  defaultProps:    Record<string,any>
  canHaveChildren: boolean
  hint?:           string
}

// ── Thumbnail CSS snippets — rendered inline on each palette item ─────────────
// Key = widget type (full), value = JSX thumbnail element
const THUMBNAIL: Partial<Record<string, React.CSSProperties>> = {
  'flutter.widgets.Text':              { background:'linear-gradient(#1e2d3d 2px,transparent 2px),linear-gradient(#1e2d3d 2px,transparent 2px)', backgroundSize:'80% 8px, 50% 8px', backgroundPosition:'8px 6px, 8px 18px', height:30 },
  'flutter.widgets.ElevatedButton':    { background:'#1E6BFF', borderRadius:8, height:28 },
  'flutter.widgets.OutlinedButton':    { border:'1.5px solid #1E6BFF', borderRadius:8, height:28 },
  'flutter.widgets.TextButton':        { height:28, display:'flex', alignItems:'center', justifyContent:'center' },
  'flutter.widgets.FilledButton':      { background:'#1E6BFF', borderRadius:50, height:28 },
  'flutter.widgets.IconButton':        { display:'flex', alignItems:'center', justifyContent:'center', height:30 },
  'flutter.widgets.TextField':         { border:'1px solid #1e3a5f', borderRadius:6, height:30, background:'#0a1628' },
  'flutter.widgets.TextFormField':     { border:'1px solid #1E6BFF44', borderRadius:6, height:30, background:'#0a1628' },
  'flutter.widgets.SearchBar':         { border:'1px solid #2a2a3a', borderRadius:20, height:30, background:'#1a1a2e' },
  'flutter.widgets.Checkbox':          { display:'flex', alignItems:'center', justifyContent:'center', height:30 },
  'flutter.widgets.Switch':            { display:'flex', alignItems:'center', height:30 },
  'flutter.widgets.Slider':            { display:'flex', alignItems:'center', height:30 },
  'flutter.widgets.Container':         { border:'1px dashed #1e3a5f', borderRadius:6, height:30 },
  'flutter.widgets.Row':               { display:'flex', gap:3, padding:'4px 4px', height:30, alignItems:'center' },
  'flutter.widgets.Column':            { display:'flex', flexDirection:'column' as const, gap:3, padding:'4px 4px', height:30, justifyContent:'center' },
  'flutter.widgets.Stack':             { position:'relative' as const, height:30 },
  'flutter.widgets.Card':              { background:'#0D1B2A', borderRadius:8, height:30, boxShadow:'0 2px 6px rgba(0,0,0,0.5)' },
  'flutter.widgets.ListTile':          { display:'flex', alignItems:'center', gap:6, padding:'0 6px', height:30, background:'#0a0a14' },
  'flutter.widgets.ListView':          { display:'flex', flexDirection:'column' as const, gap:2, height:30, overflow:'hidden' },
  'flutter.widgets.GridView':          { display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, height:30, overflow:'hidden' },
  'flutter.widgets.AppBar':            { background:'#060E1A', height:30, display:'flex', alignItems:'center', padding:'0 8px' },
  'flutter.widgets.BottomNavigationBar':{ background:'#0F1E35', height:30, display:'flex', alignItems:'center', justifyContent:'space-around' },
  'flutter.widgets.Scaffold':          { background:'#060E1A', height:30, border:'1px solid #1e2d3d' },
  'flutter.widgets.CircleAvatar':      { display:'flex', alignItems:'center', justifyContent:'center', height:30 },
  'flutter.widgets.Image':             { background:'#0D1B2A', borderRadius:4, height:30, display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed #1e3a5f' },
  'flutter.widgets.Divider':           { display:'flex', alignItems:'center', height:30 },
  'flutter.widgets.SizedBox':          { border:'1px dashed #2a2a3a', height:30 },
  'flutter.widgets.Chip':              { display:'flex', alignItems:'center', justifyContent:'center', height:30 },
  'flutter.widgets.Badge':             { display:'flex', alignItems:'center', justifyContent:'center', height:30 },
  'flutter.widgets.LinearProgressIndicator': { display:'flex', alignItems:'center', height:30 },
  'flutter.widgets.CircularProgressIndicator':{ display:'flex', alignItems:'center', justifyContent:'center', height:30 },
  'flutter.widgets.NavigationBar':     { background:'#0D1B2A', borderTop:'1px solid #1e2d3d', height:30, display:'flex', alignItems:'center', justifyContent:'space-around' },
  'flutter.widgets.AlertDialog':       { background:'#0D1B2A', border:'1px solid #1e2d3d', borderRadius:8, height:30 },
  'flutter.widgets.DatePicker':        { border:'1px solid #1e3a5f', borderRadius:8, height:30, background:'#0a1628', display:'flex', alignItems:'center', padding:'0 8px' },
}

// Small rendered preview for each thumbnail
function WidgetThumb({ type }: { type: string }) {
  const base: React.CSSProperties = { width:56, height:30, borderRadius:4, overflow:'hidden', flexShrink:0, background:'#0a0a18' }
  const extra = THUMBNAIL[type] || {}
  const style = { ...base, ...extra }

  // Special rendered thumbnails
  if (type.includes('ElevatedButton') || type.includes('FilledButton')) {
    return <div style={style}><div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#fff', fontWeight:600 }}>BUTTON</div></div>
  }
  if (type.includes('OutlinedButton')) {
    return <div style={style}><div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:'#1E6BFF', fontWeight:600 }}>BUTTON</div></div>
  }
  if (type.includes('TextField') || type.includes('SearchBar')) {
    return <div style={style}><div style={{ height:'100%', display:'flex', alignItems:'center', paddingLeft:6, fontSize:9, color:'#555' }}>Type...</div></div>
  }
  if (type.includes('AppBar')) {
    return <div style={style}><div style={{ height:'100%', display:'flex', alignItems:'center', paddingLeft:8, fontSize:9, color:'#fff', fontWeight:600 }}>AppBar</div></div>
  }
  if (type.includes('Divider')) {
    return <div style={style}><div style={{ width:'100%', height:1, background:'#1e2d3d', marginTop:14 }}/></div>
  }
  if (type.includes('CircleAvatar')) {
    return <div style={style}><div style={{ width:22, height:22, borderRadius:'50%', background:'#1E6BFF', margin:'4px auto' }}/></div>
  }
  if (type.includes('Switch')) {
    return <div style={style}><div style={{ width:32, height:16, borderRadius:8, background:'#1E6BFF', margin:'7px auto', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:2 }}><div style={{ width:12, height:12, borderRadius:'50%', background:'#fff' }}/></div></div>
  }
  if (type.includes('Checkbox')) {
    return <div style={style}><div style={{ width:16, height:16, border:'2px solid #1E6BFF', borderRadius:3, margin:'7px auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#1E6BFF' }}>✓</div></div>
  }
  if (type.includes('LinearProgress')) {
    return <div style={style}><div style={{ margin:'13px 6px', height:4, borderRadius:2, background:'#1e2d3d' }}><div style={{ width:'60%', height:'100%', background:'#1E6BFF', borderRadius:2 }}/></div></div>
  }
  if (type.includes('CircularProgress')) {
    return <div style={style}><div style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid #1e2d3d', borderTopColor:'#1E6BFF', margin:'7px auto' }}/></div>
  }
  if (type.includes('Row')) {
    return <div style={style}><div style={{ display:'flex', gap:3, padding:'6px 6px', alignItems:'center', height:'100%' }}>
      {[1,2,3].map(i => <div key={i} style={{ flex:1, height:16, background:'#1e3a5f', borderRadius:2 }}/>) }
    </div></div>
  }
  if (type.includes('Column')) {
    return <div style={style}><div style={{ display:'flex', flexDirection:'column' as const, gap:2, padding:'3px 6px', height:'100%', justifyContent:'center' }}>
      {[1,2].map(i => <div key={i} style={{ height:8, background:'#1e3a5f', borderRadius:2 }}/>) }
    </div></div>
  }
  if (type.includes('ListView')) {
    return <div style={style}><div style={{ display:'flex', flexDirection:'column' as const, gap:2, padding:'3px 4px' }}>
      {[1,2,3].map(i => <div key={i} style={{ height:6, background:'#1e3a5f', borderRadius:2 }}/>) }
    </div></div>
  }
  if (type.includes('GridView')) {
    return <div style={style}><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, padding:'3px 4px' }}>
      {[1,2,3,4].map(i => <div key={i} style={{ height:10, background:'#1e3a5f', borderRadius:2 }}/>) }
    </div></div>
  }
  if (type.includes('Card')) {
    return <div style={style}><div style={{ height:'100%', background:'#0D1B2A', borderRadius:4, margin:'2px', border:'1px solid #1e2d3d' }}/></div>
  }
  if (type.includes('Image')) {
    return <div style={style}><div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#4a6a8a' }}>🖼</div></div>
  }
  if (type.includes('Chip')) {
    return <div style={style}><div style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:20, border:'1px solid #2a2a3a', fontSize:9, color:'#888', margin:'5px 8px' }}>Chip</div></div>
  }
  if (type.includes('Badge')) {
    return <div style={style}><div style={{ width:18, height:18, borderRadius:'50%', background:'#e05252', margin:'6px auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 }}>3</div></div>
  }

  return <div style={style} />
}

const ALL_WIDGETS: PaletteItem[] = [
  { type:'flutter.widgets.Scaffold',              label:'Scaffold',         icon:'⬜', category:'Layout',     hint:'Root screen container',  canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.AppBar',                label:'AppBar',           icon:'▬',  category:'Layout',     hint:'Top navigation bar',     canHaveChildren:false, defaultProps:{ title:'Title', centerTitle:true } },
  { type:'flutter.widgets.Container',             label:'Container',        icon:'◻',  category:'Layout',     hint:'Box with decoration',    canHaveChildren:true,  defaultProps:{ padding:{ all:16 } } },
  { type:'flutter.widgets.Row',                   label:'Row',              icon:'⇔',  category:'Layout',     hint:'Horizontal layout',      canHaveChildren:true,  defaultProps:{ mainAxisAlignment:'start' } },
  { type:'flutter.widgets.Column',                label:'Column',           icon:'⇕',  category:'Layout',     hint:'Vertical layout',        canHaveChildren:true,  defaultProps:{ mainAxisAlignment:'start' } },
  { type:'flutter.widgets.Stack',                 label:'Stack',            icon:'⊞',  category:'Layout',     hint:'Layered overlap',        canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.Expanded',              label:'Expanded',         icon:'⤢',  category:'Layout',     hint:'Fill available space',   canHaveChildren:true,  defaultProps:{ flex:1 } },
  { type:'flutter.widgets.Flexible',              label:'Flexible',         icon:'⤡',  category:'Layout',     hint:'Flexible flex child',    canHaveChildren:true,  defaultProps:{ flex:1 } },
  { type:'flutter.widgets.Padding',               label:'Padding',          icon:'⊡',  category:'Layout',     hint:'Add spacing around child',canHaveChildren:true, defaultProps:{ padding:{ all:16 } } },
  { type:'flutter.widgets.Center',                label:'Center',           icon:'⊙',  category:'Layout',     hint:'Center child widget',    canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.SizedBox',              label:'SizedBox',         icon:'▭',  category:'Layout',     hint:'Fixed size / gap',       canHaveChildren:true,  defaultProps:{ width:100, height:100 } },
  { type:'flutter.widgets.Spacer',                label:'Spacer',           icon:'↔',  category:'Layout',     hint:'Flexible gap in Row/Col',canHaveChildren:false, defaultProps:{ flex:1 } },
  { type:'flutter.widgets.Wrap',                  label:'Wrap',             icon:'↩',  category:'Layout',     hint:'Wrapping row/column',    canHaveChildren:true,  defaultProps:{ spacing:8, runSpacing:8 } },
  { type:'flutter.widgets.SafeArea',              label:'SafeArea',         icon:'⊛',  category:'Layout',     hint:'Avoid system UI edges',  canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.SingleChildScrollView', label:'ScrollView',       icon:'↕',  category:'Layout',     hint:'Scrollable container',   canHaveChildren:true,  defaultProps:{ scrollDirection:'vertical' } },
  { type:'flutter.widgets.AspectRatio',           label:'AspectRatio',      icon:'⊟',  category:'Layout',     hint:'Force aspect ratio',     canHaveChildren:true,  defaultProps:{ aspectRatio:1.0 } },
  { type:'flutter.widgets.Text',                  label:'Text',             icon:'T',  category:'Display',    hint:'Static or bound text',   canHaveChildren:false, defaultProps:{ data:'Text', style:{ fontSize:16 } } },
  { type:'flutter.widgets.RichText',              label:'RichText',         icon:'Tₐ', category:'Display',    hint:'Mixed styled text spans', canHaveChildren:false, defaultProps:{ text:{ text:'Hello ' } } },
  { type:'flutter.widgets.Icon',                  label:'Icon',             icon:'✦',  category:'Display',    hint:'Material icon',          canHaveChildren:false, defaultProps:{ icon:'Icons.star', size:24, color:{ hex:'#1E6BFF' } } },
  { type:'flutter.widgets.Image',                 label:'Image',            icon:'🖼', category:'Display',    hint:'Network or asset image', canHaveChildren:false, defaultProps:{ src:'https://picsum.photos/300/200', fit:'cover', width:300, height:200 } },
  { type:'flutter.widgets.Card',                  label:'Card',             icon:'▣',  category:'Display',    hint:'Elevated card surface',  canHaveChildren:true,  defaultProps:{ elevation:2 } },
  { type:'flutter.widgets.CircleAvatar',          label:'Avatar',           icon:'◯',  category:'Display',    hint:'Circular user avatar',   canHaveChildren:false, defaultProps:{ radius:24, backgroundColor:{ hex:'#1E6BFF' }, child:'AB' } },
  { type:'flutter.widgets.Divider',               label:'Divider',          icon:'─',  category:'Display',    hint:'Horizontal line separator',canHaveChildren:false,defaultProps:{ thickness:1, color:{ hex:'#1E2D3D' } } },
  { type:'flutter.widgets.Badge',                 label:'Badge',            icon:'🔴', category:'Display',    hint:'Notification count badge',canHaveChildren:true, defaultProps:{ label:'3', backgroundColor:{ hex:'#E05252' } } },
  { type:'flutter.widgets.Chip',                  label:'Chip',             icon:'◉',  category:'Display',    hint:'Tag or label chip',      canHaveChildren:false, defaultProps:{ label:'Chip', selected:false } },
  { type:'flutter.widgets.LinearProgressIndicator',label:'LinearProgress', icon:'▬',  category:'Display',    hint:'Horizontal progress bar',canHaveChildren:false, defaultProps:{ value:0.6, color:{ hex:'#1E6BFF' } } },
  { type:'flutter.widgets.CircularProgressIndicator',label:'CircularProgress',icon:'◌',category:'Display',   hint:'Circular spinner',       canHaveChildren:false, defaultProps:{ value:null, color:{ hex:'#1E6BFF' }, strokeWidth:3 } },
  { type:'flutter.widgets.Tooltip',               label:'Tooltip',          icon:'💬', category:'Display',    hint:'On-hover tooltip',       canHaveChildren:true,  defaultProps:{ message:'Tooltip text' } },
  { type:'flutter.widgets.ClipRRect',             label:'ClipRRect',        icon:'▢',  category:'Display',    hint:'Rounded clip mask',      canHaveChildren:true,  defaultProps:{ borderRadius:{ all:12 } } },
  { type:'flutter.widgets.Opacity',               label:'Opacity',          icon:'◐',  category:'Display',    hint:'Transparency control',   canHaveChildren:true,  defaultProps:{ opacity:0.5 } },
  { type:'flutter.widgets.TextField',             label:'TextField',        icon:'▤',  category:'Input',      hint:'Single-line text input', canHaveChildren:false, defaultProps:{ labelText:'Label', hintText:'Enter text...' } },
  { type:'flutter.widgets.TextFormField',         label:'TextFormField',    icon:'▤▤', category:'Input',      hint:'Validated form field',   canHaveChildren:false, defaultProps:{ labelText:'Field', hintText:'Enter value...', validator:'required' } },
  { type:'flutter.widgets.ElevatedButton',        label:'ElevatedButton',   icon:'⊞',  category:'Input',      hint:'Filled primary button',  canHaveChildren:false, defaultProps:{ text:'Submit', onPressed:'(){}' } },
  { type:'flutter.widgets.FilledButton',          label:'FilledButton',     icon:'⬛', category:'Input',      hint:'M3 filled tonal button', canHaveChildren:false, defaultProps:{ text:'Continue', onPressed:'(){}' } },
  { type:'flutter.widgets.OutlinedButton',        label:'OutlinedButton',   icon:'⊠',  category:'Input',      hint:'Border-only button',     canHaveChildren:false, defaultProps:{ text:'Cancel', onPressed:'(){}' } },
  { type:'flutter.widgets.TextButton',            label:'TextButton',       icon:'⊟',  category:'Input',      hint:'Text-only link button',  canHaveChildren:false, defaultProps:{ text:'Learn more', onPressed:'(){}' } },
  { type:'flutter.widgets.IconButton',            label:'IconButton',       icon:'◈',  category:'Input',      hint:'Icon-only tap button',   canHaveChildren:false, defaultProps:{ icon:'Icons.add', size:24 } },
  { type:'flutter.widgets.Checkbox',              label:'Checkbox',         icon:'☑',  category:'Input',      hint:'Boolean checkbox',       canHaveChildren:false, defaultProps:{ value:false, label:'Option' } },
  { type:'flutter.widgets.Switch',                label:'Switch',           icon:'⊛',  category:'Input',      hint:'On/off toggle switch',   canHaveChildren:false, defaultProps:{ value:false } },
  { type:'flutter.widgets.Radio',                 label:'Radio',            icon:'◎',  category:'Input',      hint:'Radio option in group',  canHaveChildren:false, defaultProps:{ value:'opt1', groupValue:'opt1', label:'Option 1' } },
  { type:'flutter.widgets.ToggleButtons',         label:'ToggleButtons',    icon:'⊞⊟', category:'Input',     hint:'Multi-select segment',   canHaveChildren:false, defaultProps:{ labels:['Day','Week','Month'], selected:[true,false,false] } },
  { type:'flutter.widgets.Slider',                label:'Slider',           icon:'⊸',  category:'Input',      hint:'Continuous value slider',canHaveChildren:false, defaultProps:{ value:50, min:0, max:100, divisions:10 } },
  { type:'flutter.widgets.RangeSlider',           label:'RangeSlider',      icon:'⊹',  category:'Input',      hint:'Min–max range slider',   canHaveChildren:false, defaultProps:{ start:20, end:80, min:0, max:100 } },
  { type:'flutter.widgets.DropdownButton',        label:'Dropdown',         icon:'▼',  category:'Input',      hint:'Dropdown selector',      canHaveChildren:false, defaultProps:{ value:'opt1', items:['opt1','opt2','opt3'], hint:'Select...' } },
  { type:'flutter.widgets.DropdownButtonFormField',label:'DropdownForm',    icon:'▽',  category:'Input',      hint:'Form dropdown + validator',canHaveChildren:false,defaultProps:{ value:'', items:['Option 1','Option 2'], labelText:'Select' } },
  { type:'flutter.widgets.SearchBar',             label:'SearchBar',        icon:'🔍', category:'Input',      hint:'M3 search bar widget',   canHaveChildren:false, defaultProps:{ hintText:'Search...' } },
  { type:'flutter.widgets.DatePicker',            label:'DatePicker',       icon:'📅', category:'Input',      hint:'Date picker dialog',     canHaveChildren:false, defaultProps:{ labelText:'Select date', firstDate:'2000-01-01', lastDate:'2100-12-31' } },
  { type:'flutter.widgets.TimePicker',            label:'TimePicker',       icon:'🕐', category:'Input',      hint:'Time picker dialog',     canHaveChildren:false, defaultProps:{ labelText:'Select time', initialTime:'09:00' } },
  { type:'flutter.widgets.BottomNavigationBar',   label:'BottomNav',        icon:'⊟',  category:'Navigation', hint:'M2 bottom tab bar',      canHaveChildren:false, defaultProps:{ currentIndex:0, items:[{label:'Home',icon:'Icons.home'},{label:'Search',icon:'Icons.search'},{label:'Profile',icon:'Icons.person'}] } },
  { type:'flutter.widgets.NavigationBar',         label:'NavigationBar',    icon:'⊠',  category:'Navigation', hint:'M3 bottom navigation',   canHaveChildren:false, defaultProps:{ selectedIndex:0, destinations:[{label:'Home',icon:'Icons.home'},{label:'Explore',icon:'Icons.explore'},{label:'Profile',icon:'Icons.person'}] } },
  { type:'flutter.widgets.NavigationRail',        label:'NavigationRail',   icon:'⊣',  category:'Navigation', hint:'Side navigation rail',   canHaveChildren:false, defaultProps:{ selectedIndex:0, destinations:[{label:'Home',icon:'Icons.home'},{label:'Settings',icon:'Icons.settings'}] } },
  { type:'flutter.widgets.NavigationDrawer',      label:'Drawer',           icon:'☰',  category:'Navigation', hint:'Slide-in side drawer',   canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.TabBar',                label:'TabBar',           icon:'⊞',  category:'Navigation', hint:'Horizontal tab strip',   canHaveChildren:true,  defaultProps:{ tabs:[{label:'Tab 1'},{label:'Tab 2'},{label:'Tab 3'}] } },
  { type:'flutter.widgets.TabBarView',            label:'TabBarView',       icon:'⊡',  category:'Navigation', hint:'Tab body container',     canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.FloatingActionButton',  label:'FAB',              icon:'⊕',  category:'Navigation', hint:'Floating action button', canHaveChildren:false, defaultProps:{ icon:'Icons.add', tooltip:'Add' } },
  { type:'flutter.widgets.PageView',              label:'PageView',         icon:'⊳',  category:'Navigation', hint:'Swipeable page scroller',canHaveChildren:true,  defaultProps:{ scrollDirection:'horizontal', pageSnapping:true } },
  { type:'flutter.widgets.ListView',              label:'ListView',         icon:'≡',  category:'Lists',      hint:'Scrollable list',        canHaveChildren:true,  defaultProps:{ scrollDirection:'vertical' } },
  { type:'flutter.widgets.GridView',              label:'GridView',         icon:'⊞',  category:'Lists',      hint:'Grid layout of items',   canHaveChildren:true,  defaultProps:{ crossAxisCount:2, crossAxisSpacing:8, mainAxisSpacing:8 } },
  { type:'flutter.widgets.ListTile',              label:'ListTile',         icon:'▤',  category:'Lists',      hint:'Standard list row',      canHaveChildren:false, defaultProps:{ title:'Title', subtitle:'Subtitle', leading:'Icons.person', trailing:'Icons.chevron_right' } },
  { type:'flutter.widgets.ExpansionTile',         label:'ExpansionTile',    icon:'▼▤', category:'Lists',      hint:'Expandable list item',   canHaveChildren:true,  defaultProps:{ title:'Expand me', initiallyExpanded:false } },
  { type:'flutter.widgets.ReorderableListView',   label:'ReorderableList',  icon:'⇅',  category:'Lists',      hint:'Drag-to-reorder list',   canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.FutureBuilder',         label:'FutureBuilder',    icon:'⏳', category:'Async',      hint:'Async future widget',    canHaveChildren:true,  defaultProps:{ future:'myFuture' } },
  { type:'flutter.widgets.StreamBuilder',         label:'StreamBuilder',    icon:'⟳', category:'Async',      hint:'Stream-driven widget',   canHaveChildren:true,  defaultProps:{ stream:'myStream' } },
  { type:'flutter.widgets.AlertDialog',           label:'AlertDialog',      icon:'⚠',  category:'Overlay',    hint:'Confirm/alert dialog',   canHaveChildren:false, defaultProps:{ title:'Alert', content:'Are you sure?', confirmText:'OK', cancelText:'Cancel' } },
  { type:'flutter.widgets.Dialog',                label:'Dialog',           icon:'⊡',  category:'Overlay',    hint:'Custom dialog widget',   canHaveChildren:true,  defaultProps:{} },
  { type:'flutter.widgets.BottomSheet',           label:'BottomSheet',      icon:'⊻',  category:'Overlay',    hint:'Slide-up sheet',         canHaveChildren:true,  defaultProps:{ isDismissible:true } },
  { type:'flutter.widgets.SnackBar',              label:'SnackBar',         icon:'▭',  category:'Overlay',    hint:'Toast notification bar', canHaveChildren:false, defaultProps:{ content:'Action completed', actionLabel:'Undo', duration:3000 } },
  { type:'flutter.widgets.Stepper',               label:'Stepper',          icon:'⑴',  category:'Overlay',    hint:'Step-by-step form',      canHaveChildren:false, defaultProps:{ type:'vertical', currentStep:0, steps:[{title:'Step 1',content:'Content 1'},{title:'Step 2',content:'Content 2'}] } },
]

const CATEGORIES = ['Layout','Display','Input','Navigation','Lists','Async','Overlay']

export default function WidgetPalette({ onDragStart }: {
  onDragStart: (item: PaletteItem) => void
}): JSX.Element {
  const [search,         setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [hoveredType,    setHoveredType]    = useState<string | null>(null)
  const [hoverPos,       setHoverPos]       = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const filtered = ALL_WIDGETS.filter(w => {
    const matchCat    = activeCategory === 'all' || w.category === activeCategory
    const matchSearch = !search || w.label.toLowerCase().includes(search.toLowerCase()) ||
      (w.hint?.toLowerCase().includes(search.toLowerCase()) ?? false)
    return matchCat && matchSearch
  })

  const grouped: Record<string, PaletteItem[]> = {}
  const catsToShow = activeCategory === 'all' ? CATEGORIES : [activeCategory]
  for (const cat of catsToShow) {
    const items = filtered.filter(w => w.category === cat)
    if (items.length) grouped[cat] = items
  }

  const hoveredItem = hoveredType ? ALL_WIDGETS.find(w => w.type === hoveredType) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Search */}
      <div style={{ padding:'8px 10px', borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${ALL_WIDGETS.length} widgets...`}
          style={{ width:'100%', padding:'6px 10px', background:'#0a0a14',
            border:'1px solid #1e2d3d', borderRadius:6, color:'#d4d4d4',
            fontSize:11, outline:'none', boxSizing:'border-box' as const }}
        />
      </div>

      {/* Category filter */}
      <div style={{ display:'flex', gap:3, padding:'5px 8px', flexWrap:'wrap' as const,
        borderBottom:'1px solid #1e1e2e', flexShrink:0 }}>
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding:'2px 7px', borderRadius:10, fontSize:10, cursor:'pointer',
            border:`1px solid ${activeCategory===cat ? '#4a9edd' : '#1e2d3d'}`,
            background: activeCategory===cat ? '#0a1a2a' : 'transparent',
            color: activeCategory===cat ? '#4a9edd' : '#555',
            fontFamily:'system-ui,sans-serif',
          }}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Widget list */}
      <div style={{ flex:1, overflowY:'auto' as const }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div style={{ padding:'5px 10px 2px', fontSize:10, fontWeight:700,
              color:'#444', letterSpacing:'0.07em', textTransform:'uppercase' as const,
              background:'#050510', borderBottom:'1px solid #0f0f1a',
              position:'sticky' as const, top:0 }}>
              {cat} <span style={{ color:'#333', fontWeight:400 }}>({items.length})</span>
            </div>
            {items.map(item => (
              <div
                key={item.type}
                draggable
                onDragStart={() => { onDragStart(item); setHoveredType(null) }}
                title={item.hint}
                onMouseEnter={e => {
                  setHoveredType(item.type)
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHoverPos({ x: rect.right + 8, y: rect.top })
                  ;(e.currentTarget as HTMLDivElement).style.background = '#0a0a1e'
                }}
                onMouseLeave={e => {
                  setHoveredType(null)
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px',
                  cursor:'grab', borderBottom:'1px solid #0a0a14',
                  userSelect:'none' as const }}>
                <WidgetThumb type={item.type} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:'#c0bcd8', fontWeight:500,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                    {item.label}
                  </div>
                  {item.hint && (
                    <div style={{ fontSize:9, color:'#444', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' as const, marginTop:1 }}>
                      {item.hint}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding:'20px', textAlign:'center' as const, color:'#444', fontSize:12 }}>
            No widgets match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'3px 10px', borderTop:'1px solid #0f0f1a',
        fontSize:10, color:'#333', flexShrink:0 }}>
        {filtered.length}/{ALL_WIDGETS.length} widgets
      </div>

      {/* Hover preview tooltip */}
      {hoveredItem && (
        <div style={{
          position:'fixed' as const,
          left: Math.min(hoverPos.x, window.innerWidth - 180),
          top:  Math.max(8, Math.min(hoverPos.y, window.innerHeight - 140)),
          zIndex:9999, pointerEvents:'none',
          background:'#0d0d1a', border:'1px solid #2a2a3a', borderRadius:10,
          padding:12, width:164,
          boxShadow:'0 8px 28px rgba(0,0,0,0.8)',
        }}>
          <div style={{ width:'100%', height:56, background:'#0a0a18',
            borderRadius:6, overflow:'hidden', marginBottom:8, border:'1px solid #1e2d3d' }}>
            <WidgetThumb type={hoveredItem.type} />
          </div>
          <div style={{ fontSize:12, fontWeight:600, color:'#e0d7ff', marginBottom:3 }}>
            {hoveredItem.label}
          </div>
          {hoveredItem.hint && (
            <div style={{ fontSize:10, color:'#666', lineHeight:1.5 }}>
              {hoveredItem.hint}
            </div>
          )}
          <div style={{ marginTop:6, fontSize:9, color:'#333', fontFamily:'monospace' }}>
            {hoveredItem.type.split('.').pop()}
          </div>
        </div>
      )}
    </div>
  )
}
