// ============================================================
// Figma REST API — TypeScript types (subset we use)
// ============================================================

export interface FigmaColor {
  r: number; g: number; b: number; a: number
}

export interface FigmaColorStop {
  color: FigmaColor
  position: number
}

export interface FigmaPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'IMAGE' | string
  color?: FigmaColor
  opacity?: number
  gradientStops?: FigmaColorStop[]
  imageRef?: string
  scaleMode?: string
}

export interface FigmaTypeStyle {
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM'
  letterSpacing?: number
  lineHeightPx?: number
  lineHeightPercent?: number
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
  italic?: boolean
}

export interface FigmaConstraints {
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE'
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE'
}

export interface FigmaBoundingBox {
  x: number; y: number; width: number; height: number
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  radius?: number
  color?: FigmaColor
  offset?: { x: number; y: number }
  visible?: boolean
}

export interface FigmaNode {
  id:           string
  name:         string
  type:         string          // FRAME, GROUP, SECTION, TEXT, RECTANGLE, ELLIPSE, VECTOR, etc.
  children?:    FigmaNode[]

  // geometry
  absoluteBoundingBox?: FigmaBoundingBox
  size?: { x: number; y: number }

  // appearance
  fills?:       FigmaPaint[]
  strokes?:     FigmaPaint[]
  strokeWeight?: number
  cornerRadius?: number
  rectangleCornerRadii?: [number, number, number, number]
  opacity?:     number
  visible?:     boolean
  blendMode?:   string
  effects?:     FigmaEffect[]
  clipsContent?: boolean

  // text
  characters?: string
  style?:      FigmaTypeStyle
  characterStyleOverrides?: number[]
  styleOverrideTable?: Record<string, FigmaTypeStyle>

  // auto-layout
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
  primaryAxisSizingMode?: 'FIXED' | 'AUTO'
  counterAxisSizingMode?: 'FIXED' | 'AUTO'
  primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN'
  counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE'
  itemSpacing?: number
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number

  // constraints (for absolute-position frames)
  constraints?: FigmaConstraints

  // component
  componentId?: string
  mainComponent?: FigmaNode
}

export interface FigmaCanvas {
  id: string; name: string; type: 'CANVAS'
  children: FigmaNode[]
}

export interface FigmaDocument {
  id: string; name: string; type: 'DOCUMENT'
  children: FigmaCanvas[]
}

export interface FigmaFile {
  name: string
  document: FigmaDocument
  styles?: Record<string, { name: string; styleType: string }>
}
