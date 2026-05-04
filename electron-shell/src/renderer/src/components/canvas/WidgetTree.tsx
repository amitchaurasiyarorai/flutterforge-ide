import React from 'react'
import { useCanvasStore, selectActiveScreen } from '../../store/canvas.store'
import type { WidgetNode } from '../../types/widget.schema'

export default function WidgetTree(): JSX.Element {
  const activeScreen = useCanvasStore(selectActiveScreen)
  const { selection, selectWidget, activeScreenId } = useCanvasStore()

  if (!activeScreen || !activeScreenId) {
    return (
      <div style={{ padding:'20px 12px', display:'flex', flexDirection:'column' as const,
        alignItems:'center', gap:8, color:'#333' }}>
        <div style={{ fontSize:22, opacity:0.2 }}>⇕</div>
        <div style={{ fontSize:11, color:'#444', textAlign:'center' as const }}>
          No screen selected
        </div>
      </div>
    )
  }

  const rootWidget = activeScreen.rootWidgetId
    ? (activeScreen.widgets || {})[activeScreen.rootWidgetId]
    : null

  if (!rootWidget) {
    return (
      <div style={{ padding:'20px 12px', display:'flex', flexDirection:'column' as const,
        alignItems:'center', gap:8, color:'#333' }}>
        <div style={{ fontSize:22, opacity:0.2 }}>⬡</div>
        <div style={{ fontSize:11, color:'#444', textAlign:'center' as const, lineHeight:1.5 }}>
          Drag a widget from the palette to get started
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex:1, overflowY:'auto' }}>
      <TreeNode
        widget={rootWidget}
        screen={activeScreen}
        selectedIds={selection.widgetIds}
        screenId={activeScreenId}
        onSelect={(id, multi) => selectWidget(activeScreenId, id, multi)}
        depth={0}
      />
    </div>
  )
}

function TreeNode({ widget, screen, selectedIds, screenId, onSelect, depth }: {
  widget: WidgetNode
  screen: ReturnType<typeof selectActiveScreen>
  selectedIds: string[]
  screenId: string
  onSelect: (id: string, multi: boolean) => void
  depth: number
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const isSelected  = selectedIds.includes(widget.id)
  const hasChildren = widget.children && widget.children.length > 0
  const shortName   = widget.type.split('.').pop() || widget.type

  return (
    <div>
      <div
        onClick={e => onSelect(widget.id, e.metaKey || e.ctrlKey)}
        style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'3px 8px 3px ' + (8 + depth * 14) + 'px',
          cursor:'pointer', fontSize:11,
          background: isSelected ? '#1e1a33' : 'transparent',
          color:      isSelected ? '#e0d7ff' : '#888',
          borderLeft: isSelected ? '2px solid #7c5cbf' : '2px solid transparent',
        }}
      >
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); setCollapsed(!collapsed) }}
            style={{ background:'none', border:'none', color:'#555', cursor:'pointer',
              fontSize:9, padding:'0 2px', lineHeight:1 }}>
            {collapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span style={{ width:14 }} />
        )}
        <span style={{ fontSize:9, color: isSelected ? '#9d7fe8' : '#555',
          background:'#0f0f1e', padding:'1px 4px', borderRadius:3, marginRight:4 }}>
          {getWidgetIcon(widget.type)}
        </span>
        <span>{shortName}</span>
        {widget.props.title && (
          <span style={{ color:'#444', fontSize:10, marginLeft:4 }}>
            "{String(widget.props.title).substring(0,12)}"
          </span>
        )}
        {widget.props.data && (
          <span style={{ color:'#444', fontSize:10, marginLeft:4 }}>
            "{String(widget.props.data).substring(0,12)}"
          </span>
        )}
      </div>

      {!collapsed && hasChildren && widget.children?.map(childId => {
        const child = screen?.widgets?.[childId]
        if (!child) return null
        return (
          <TreeNode
            key={childId}
            widget={child}
            screen={screen}
            selectedIds={selectedIds}
            screenId={screenId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        )
      })}
    </div>
  )
}

function getWidgetIcon(type: string): string {
  if (type.includes('Scaffold'))   return '⬜'
  if (type.includes('AppBar'))     return '▬'
  if (type.includes('Text'))       return 'T'
  if (type.includes('Button'))     return '⊞'
  if (type.includes('TextField'))  return '▤'
  if (type.includes('Container'))  return '◻'
  if (type.includes('Row'))        return '⇔'
  if (type.includes('Column'))     return '⇕'
  if (type.includes('Center'))     return '⊙'
  if (type.includes('Image'))      return '🖼'
  if (type.includes('Icon'))       return '✦'
  if (type.includes('Card'))       return '▣'
  if (type.includes('List'))       return '≡'
  if (type.includes('Grid'))       return '⊞'
  return '◈'
}
