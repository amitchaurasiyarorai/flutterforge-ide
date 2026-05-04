// ============================================================
// FlutterForge — Widget JSON Schema
// Core data model for all Flutter widgets on the canvas
// ============================================================

export type WidgetType =
  // Layout
  | 'flutter.widgets.Scaffold'
  | 'flutter.widgets.AppBar'
  | 'flutter.widgets.Container'
  | 'flutter.widgets.Row'
  | 'flutter.widgets.Column'
  | 'flutter.widgets.Stack'
  | 'flutter.widgets.Expanded'
  | 'flutter.widgets.Flexible'
  | 'flutter.widgets.Padding'
  | 'flutter.widgets.Center'
  | 'flutter.widgets.SizedBox'
  | 'flutter.widgets.Wrap'
  | 'flutter.widgets.SafeArea'
  | 'flutter.widgets.SingleChildScrollView'
  | 'flutter.widgets.AspectRatio'
  | 'flutter.widgets.Spacer'
  // Display
  | 'flutter.widgets.Text'
  | 'flutter.widgets.RichText'
  | 'flutter.widgets.Icon'
  | 'flutter.widgets.Image'
  | 'flutter.widgets.Card'
  | 'flutter.widgets.Divider'
  | 'flutter.widgets.CircleAvatar'
  | 'flutter.widgets.Badge'
  | 'flutter.widgets.Chip'
  | 'flutter.widgets.LinearProgressIndicator'
  | 'flutter.widgets.CircularProgressIndicator'
  | 'flutter.widgets.Tooltip'
  | 'flutter.widgets.ClipRRect'
  | 'flutter.widgets.Opacity'
  // Input
  | 'flutter.widgets.TextField'
  | 'flutter.widgets.TextFormField'
  | 'flutter.widgets.ElevatedButton'
  | 'flutter.widgets.TextButton'
  | 'flutter.widgets.OutlinedButton'
  | 'flutter.widgets.FilledButton'
  | 'flutter.widgets.IconButton'
  | 'flutter.widgets.Checkbox'
  | 'flutter.widgets.Switch'
  | 'flutter.widgets.Slider'
  | 'flutter.widgets.RangeSlider'
  | 'flutter.widgets.DropdownButton'
  | 'flutter.widgets.DropdownButtonFormField'
  | 'flutter.widgets.Radio'
  | 'flutter.widgets.ToggleButtons'
  | 'flutter.widgets.SearchBar'
  | 'flutter.widgets.DatePicker'
  | 'flutter.widgets.TimePicker'
  // Navigation
  | 'flutter.widgets.BottomNavigationBar'
  | 'flutter.widgets.NavigationBar'
  | 'flutter.widgets.NavigationDrawer'
  | 'flutter.widgets.NavigationRail'
  | 'flutter.widgets.TabBar'
  | 'flutter.widgets.TabBarView'
  | 'flutter.widgets.FloatingActionButton'
  | 'flutter.widgets.PageView'
  // Lists
  | 'flutter.widgets.ListView'
  | 'flutter.widgets.GridView'
  | 'flutter.widgets.ListTile'
  | 'flutter.widgets.ExpansionTile'
  | 'flutter.widgets.ReorderableListView'
  // Async
  | 'flutter.widgets.FutureBuilder'
  | 'flutter.widgets.StreamBuilder'
  // Overlay
  | 'flutter.widgets.Dialog'
  | 'flutter.widgets.AlertDialog'
  | 'flutter.widgets.BottomSheet'
  | 'flutter.widgets.SnackBar'
  | 'flutter.widgets.Stepper'
// ── Colour ─────────────────────────────────────────────────
export interface FlutterColor {
  hex: string           // e.g. "#FF5722"
  opacity?: number      // 0.0 – 1.0, default 1.0
  materialColor?: string // e.g. "Colors.deepOrange"
}

// ── EdgeInsets ──────────────────────────────────────────────
export interface EdgeInsets {
  all?: number
  top?: number
  bottom?: number
  left?: number
  right?: number
  horizontal?: number
  vertical?: number
}

// ── BorderRadius ────────────────────────────────────────────
export interface BorderRadius {
  all?: number
  topLeft?: number
  topRight?: number
  bottomLeft?: number
  bottomRight?: number
}

// ── TextStyle ───────────────────────────────────────────────
export interface TextStyle {
  fontSize?: number
  fontWeight?: 'w100'|'w200'|'w300'|'w400'|'w500'|'w600'|'w700'|'w800'|'w900'|'bold'|'normal'
  color?: FlutterColor
  fontFamily?: string
  letterSpacing?: number
  height?: number
  decoration?: 'none'|'underline'|'overline'|'lineThrough'
  overflow?: 'clip'|'ellipsis'|'fade'|'visible'
}

// ── BoxDecoration ───────────────────────────────────────────
export interface BoxDecoration {
  color?: FlutterColor
  borderRadius?: BorderRadius
  border?: {
    width?: number
    color?: FlutterColor
    style?: 'solid'|'none'
  }
  boxShadow?: {
    color?: FlutterColor
    blurRadius?: number
    spreadRadius?: number
    offsetX?: number
    offsetY?: number
  }[]
}

// ── Alignment ───────────────────────────────────────────────
export type Alignment =
  | 'topLeft'|'topCenter'|'topRight'
  | 'centerLeft'|'center'|'centerRight'
  | 'bottomLeft'|'bottomCenter'|'bottomRight'

// ── CrossAxisAlignment / MainAxisAlignment ──────────────────
export type MainAxisAlignment =
  | 'start'|'end'|'center'|'spaceBetween'|'spaceAround'|'spaceEvenly'
export type CrossAxisAlignment =
  | 'start'|'end'|'center'|'stretch'|'baseline'
export type MainAxisSize = 'min'|'max'

// ── API Integration binding (new — from Interfaces tab) ─────
export interface ApiBinding {
  interfaceId:   string    // InterfaceDefinition.id
  fieldPath:     string    // dot-path e.g. "locationName" or "groups[].memberCount"
  targetProp:    string    // which widget prop receives value e.g. "data", "value"
  format:        string    // "none"|"currency"|"date"|"percentage"|"uppercase"|"lowercase"|"truncate"|"custom"
  formatArg?:    string    // for truncate=length, custom=expression
  visibilityExpr?: string  // e.g. "status == 'ACTIVE'" — evaluates to bool
  isListBinding?:  boolean // widget is a ListView, binds to array
  arrayPath?:      string  // for list widgets — path to array in response
  mockPreview?:    string  // resolved mock value shown in canvas
}

// ── Service binding ─────────────────────────────────────────
export interface ServiceBinding {
  serviceId: string          // references ServiceDefinition.id
  operation: string          // e.g. "getUser", "createOrder"
  params?: Record<string, string> // param name → canvas field id
  onSuccess?: string         // state variable to update
  onError?: string           // error state variable
  loadingState?: string      // loading bool state variable
}

// ── State binding ───────────────────────────────────────────
export interface StateBinding {
  provider: string           // Riverpod provider name
  field?: string             // nested field path e.g. "user.name"
  twoWay?: boolean           // for inputs — read + write back
}

// ── Navigation action ───────────────────────────────────────
export interface NavigationAction {
  type: 'push'|'pop'|'pushReplacement'|'pushNamed'
  route?: string             // route name or screen id
  arguments?: Record<string, string>
}

// ── Action types ─────────────────────────────────────────────
// Each event on a widget holds an ordered list of WAction items.
// Actions run top-to-bottom when the event fires.

export type WActionType =
  | 'navigate'       // go to another screen
  | 'callApi'        // call an Interface defined in the Interfaces panel
  | 'showDialog'     // show an AlertDialog
  | 'showSnackbar'   // show a SnackBar message
  | 'callCode'       // call a named method in the screen's .dart file

export interface WActionNavigate {
  type:        'navigate'
  navType:     'push' | 'pushReplacement' | 'pop' | 'popUntil'
  screenId?:   string   // target screen id
  route?:      string   // target route e.g. /dashboard
  screenName?: string   // display label
}

export interface WActionCallApi {
  type:         'callApi'
  interfaceId:  string   // InterfaceDefinition.id
  interfaceName?: string // display label
  loadingVar?:  string   // state variable name for loading indicator
  onSuccess?:   WActionNavigate | WActionShowSnackbar   // chained action on success
  onError?:     WActionShowSnackbar                      // chained action on error
}

export interface WActionShowDialog {
  type:         'showDialog'
  title:        string
  message:      string
  confirmLabel: string
  cancelLabel:  string
  onConfirm?:   WActionNavigate | WActionCallApi         // chained on confirm
}

export interface WActionShowSnackbar {
  type:        'showSnackbar'
  message:     string
  duration?:   number   // seconds, default 3
  isError?:    boolean  // red background if true
}

export interface WActionCallCode {
  type:        'callCode'
  methodName:  string   // dart method name e.g. _onLoginPressed
  // The actual dart code lives in the screen's .dart file, not here
}

export type WAction =
  | WActionNavigate
  | WActionCallApi
  | WActionShowDialog
  | WActionShowSnackbar
  | WActionCallCode

// ── Event trigger types ─────────────────────────────────────
// Which events a widget exposes depends on its type.
// The ActionsPanel shows only events relevant to the selected widget.

export type WEventType =
  | 'onPressed'    // buttons, FAB
  | 'onTap'        // ListTile, Container/GestureDetector, any tappable
  | 'onLongPress'  // any tappable
  | 'onChanged'    // TextField, Switch, Checkbox, Slider
  | 'onSubmitted'  // TextField — keyboard done/submit

export interface WEventHandler {
  event:   WEventType
  actions: WAction[]   // ordered, runs top to bottom
}

// ── Widget event handlers (replaces old WidgetEvents) ────────
export interface WidgetEvents {
  handlers: WEventHandler[]   // list of configured event+action chains

  // Legacy fields kept for backward compatibility
  onTap?:        ServiceBinding | NavigationAction | { stateAction: string }
  onChanged?:    StateBinding
  onSubmitted?:  ServiceBinding
  onLongPress?:  ServiceBinding | NavigationAction
}

// ── Canvas position & size ──────────────────────────────────
export interface CanvasGeometry {
  x: number
  y: number
  width?: number | 'match_parent' | 'wrap_content'
  height?: number | 'match_parent' | 'wrap_content'
  zIndex?: number
}

// ── Per-widget property bags ─────────────────────────────────
export interface ScaffoldProps {
  backgroundColor?: FlutterColor
  extendBodyBehindAppBar?: boolean
  resizeToAvoidBottomInset?: boolean
}

export interface AppBarProps {
  title?: string
  titleTextStyle?: TextStyle
  backgroundColor?: FlutterColor
  foregroundColor?: FlutterColor
  elevation?: number
  centerTitle?: boolean
  leading?: string           // child widget id
  actions?: string[]         // child widget ids
}

export interface ContainerProps {
  width?: number | string
  height?: number | string
  color?: FlutterColor
  decoration?: BoxDecoration
  padding?: EdgeInsets
  margin?: EdgeInsets
  alignment?: Alignment
  clipBehavior?: 'none'|'hardEdge'|'antiAlias'
}

export interface TextProps {
  data: string               // the text content (can be a state ref: "{{user.name}}")
  style?: TextStyle
  textAlign?: 'left'|'right'|'center'|'justify'
  maxLines?: number
  softWrap?: boolean
  overflow?: 'clip'|'ellipsis'|'fade'
}

export interface TextFieldProps {
  labelText?: string
  hintText?: string
  helperText?: string
  errorText?: string
  obscureText?: boolean
  keyboardType?: 'text'|'number'|'email'|'phone'|'url'|'multiline'
  maxLines?: number
  maxLength?: number
  prefixIcon?: string        // Flutter icon name e.g. "Icons.email"
  suffixIcon?: string
  filled?: boolean
  fillColor?: FlutterColor
  controllerName?: string    // generated TextEditingController name
  validationRules?: ValidationRule[]
}

export interface ValidationRule {
  type: 'required'|'minLength'|'maxLength'|'email'|'pattern'|'custom'
  value?: string | number
  message: string
}

export interface ButtonProps {
  label: string
  icon?: string
  style?: {
    backgroundColor?: FlutterColor
    foregroundColor?: FlutterColor
    padding?: EdgeInsets
    borderRadius?: BorderRadius
    elevation?: number
  }
  loading?: boolean          // show CircularProgressIndicator when true
  disabled?: boolean
}

export interface ListViewProps {
  scrollDirection?: 'vertical'|'horizontal'
  shrinkWrap?: boolean
  physics?: 'bouncing'|'clamping'|'never'
  padding?: EdgeInsets
  separatorType?: 'none'|'divider'
  itemCount?: number | string  // number or state ref
  itemBuilder?: string         // child widget id used as template
}

export interface ImageProps {
  src: string                // URL, asset path, or state ref
  fit?: 'fill'|'contain'|'cover'|'fitWidth'|'fitHeight'|'none'
  width?: number
  height?: number
  borderRadius?: BorderRadius
  placeholder?: string       // asset path for placeholder
  errorWidget?: string       // child widget id for error state
}

export interface CardProps {
  elevation?: number
  color?: FlutterColor
  shadowColor?: FlutterColor
  shape?: BorderRadius
  margin?: EdgeInsets
  clipBehavior?: 'none'|'hardEdge'|'antiAlias'
}

export interface RowColumnProps {
  mainAxisAlignment?: MainAxisAlignment
  crossAxisAlignment?: CrossAxisAlignment
  mainAxisSize?: MainAxisSize
  spacing?: number           // gap between children (Flutter 3.x)
}

export interface BottomNavigationBarProps {
  items: BottomNavItem[]
  currentIndex?: number | string   // number or state ref
  backgroundColor?: FlutterColor
  selectedItemColor?: FlutterColor
  unselectedItemColor?: FlutterColor
  type?: 'fixed'|'shifting'
  showLabels?: boolean
}

export interface BottomNavItem {
  label: string
  icon: string               // Flutter icon name
  activeIcon?: string
  route?: string
}

export interface TabBarProps {
  tabs: TabItem[]
  isScrollable?: boolean
  indicatorColor?: FlutterColor
  labelColor?: FlutterColor
  unselectedLabelColor?: FlutterColor
}

export interface TabItem {
  label: string
  icon?: string
}

export interface FutureBuilderProps {
  futureProvider: string     // async function / service call
  loadingWidget?: string     // child widget id
  errorWidget?: string       // child widget id
  dataWidget?: string        // child widget id — receives snapshot.data
}

export interface StreamBuilderProps {
  streamProvider: string     // Riverpod stream provider name
  loadingWidget?: string
  errorWidget?: string
  dataWidget?: string
}

export interface DialogProps {
  title?: string
  contentWidget?: string     // child widget id
  actions?: string[]         // child widget ids (buttons)
  barrierDismissible?: boolean
}

// ── Union of all prop types ──────────────────────────────────
export type WidgetProps =
  | ScaffoldProps
  | AppBarProps
  | ContainerProps
  | TextProps
  | TextFieldProps
  | ButtonProps
  | ListViewProps
  | ImageProps
  | CardProps
  | RowColumnProps
  | BottomNavigationBarProps
  | TabBarProps
  | FutureBuilderProps
  | StreamBuilderProps
  | DialogProps
  | Record<string, unknown>

// ── Core WidgetNode — the fundamental canvas unit ─────────────
export interface WidgetNode {
  id: string                          // uuid v4
  type: WidgetType
  name?: string                       // user-given name e.g. "LoginButton"
  props: WidgetProps
  children?: string[]                 // ordered child widget ids
  geometry?: CanvasGeometry           // position on canvas (root widgets only)
  stateBinding?: StateBinding         // read from Riverpod provider
  serviceBinding?: ServiceBinding     // data fetch binding
  apiBinding?:     ApiBinding            // API integration binding
  events?: WidgetEvents               // tap/change/submit handlers
  conditionalRender?: string          // bool state ref — hide if false
  repeatFor?: string                  // list state ref — repeat for each item
  theme?: {
    useMaterial3?: boolean
    themeMode?: 'light'|'dark'|'system'
  }
  metadata?: {
    createdAt?: string
    updatedAt?: string
    notes?: string
    aiGenerated?: boolean
    locked?: boolean
  }
}

// ── Screen / Route definition ────────────────────────────────
export interface ScreenDefinition {
  id: string
  name: string                        // e.g. "LoginScreen"
  route: string                       // e.g. "/login"
  title?: string
  rootWidgetId: string                // top-level WidgetNode id
  widgets: Record<string, WidgetNode> // id → WidgetNode map
  stateProviders?: string[]           // Riverpod providers used on this screen
  guards?: RouteGuard[]
  transitions?: 'fade'|'slide'|'scale'|'none'
  navPos?: { x: number; y: number }   // position on navigation designer canvas
}

export interface RouteGuard {
  type: 'auth'|'role'|'custom'
  redirectTo?: string
  role?: string
  customCondition?: string
}

// ── App-level theme ──────────────────────────────────────────
export interface AppTheme {
  // ── Core seed colors ──────────────────────────────
  primaryColor:    FlutterColor
  secondaryColor:  FlutterColor
  tertiaryColor:   FlutterColor
  errorColor:      FlutterColor

  // ── Surface / background ──────────────────────────
  backgroundColor: FlutterColor
  surfaceColor:    FlutterColor

  // ── On-colors (text/icon on each surface) ─────────
  onPrimaryColor:    FlutterColor
  onSecondaryColor:  FlutterColor
  onBackgroundColor: FlutterColor
  onSurfaceColor:    FlutterColor
  onErrorColor:      FlutterColor

  // ── Typography ────────────────────────────────────
  fontFamily:        string          // e.g. "Roboto", "Inter", "Poppins"
  // Per-role font sizes (Material 3 type scale)
  displayFontSize:   number          // default 57
  headlineFontSize:  number          // default 32
  titleFontSize:     number          // default 22
  bodyFontSize:      number          // default 14
  labelFontSize:     number          // default 12
  fontWeightBold:    number          // default 700
  fontWeightNormal:  number          // default 400

  // ── Shape ─────────────────────────────────────────
  borderRadiusSmall:  number         // chips, badges    default 8
  borderRadiusMedium: number         // cards, inputs    default 12
  borderRadiusLarge:  number         // dialogs, sheets  default 28
  borderRadiusFull:   number         // FAB, buttons     default 50

  // ── Component-level overrides ─────────────────────
  appBarElevation:    number         // default 0
  cardElevation:      number         // default 2
  buttonHeight:       number         // default 48
  inputBorderStyle:   'outline' | 'underline' | 'filled'

  // ── Mode ──────────────────────────────────────────
  useMaterial3: boolean
  brightness:   'light' | 'dark' | 'system'
}

// ── Default theme (Material 3 baseline) ──────────────────────
export const DEFAULT_THEME: AppTheme = {
  primaryColor:      { hex: '#6200EA' },
  secondaryColor:    { hex: '#03DAC6' },
  tertiaryColor:     { hex: '#EFB8C8' },
  errorColor:        { hex: '#B00020' },
  backgroundColor:   { hex: '#FFFBFE' },
  surfaceColor:      { hex: '#FFFBFE' },
  onPrimaryColor:    { hex: '#FFFFFF' },
  onSecondaryColor:  { hex: '#000000' },
  onBackgroundColor: { hex: '#1C1B1F' },
  onSurfaceColor:    { hex: '#1C1B1F' },
  onErrorColor:      { hex: '#FFFFFF' },
  fontFamily:        'Roboto',
  displayFontSize:   57,
  headlineFontSize:  32,
  titleFontSize:     22,
  bodyFontSize:      14,
  labelFontSize:     12,
  fontWeightBold:    700,
  fontWeightNormal:  400,
  borderRadiusSmall:  8,
  borderRadiusMedium: 12,
  borderRadiusLarge:  28,
  borderRadiusFull:   50,
  appBarElevation:    0,
  cardElevation:      2,
  buttonHeight:       48,
  inputBorderStyle:   'outline',
  useMaterial3: true,
  brightness:   'system',
}

// ── Root project model ───────────────────────────────────────
// ── Navigation connection (stored at project level) ──────────────────────────
export interface NavConnection {
  id:         string
  fromId:     string   // source screen id
  toId:       string   // target screen id
  label?:     string   // e.g. "On Login Success"
  transition: 'push' | 'pushReplacement' | 'popUntil' | 'go'
}

export interface FlutterForgeProject {
  id: string
  name: string
  packageName: string                 // e.g. "com.mycompany.myapp"
  version: string                     // e.g. "1.0.0"
  description?: string
  screens: Record<string, ScreenDefinition>
  initialRoute: string
  navConnections?: NavConnection[]    // navigation flow connections
  theme: AppTheme
  services: Record<string, ServiceDefinition>
  stateProviders: Record<string, ProviderDefinition>
  assets?: AssetDefinition[]
  dependencies?: Record<string, string> // pub.dev packages
  createdAt: string
  updatedAt: string
  metadata?: {
    targetPlatforms?: ('ios'|'android'|'web'|'windows'|'macos'|'linux')[]
    minSdkVersion?: number
    targetSdkVersion?: number
  }
}

// ── Service definition ───────────────────────────────────────
export interface ServiceDefinition {
  id: string
  name: string                        // e.g. "UserService"
  baseUrl: string                     // e.g. "http://localhost:8080"
  operations: ServiceOperation[]
  auth?: 'none'|'jwt'|'apiKey'|'oauth2'
  timeout?: number
}

export interface ServiceOperation {
  id: string
  name: string                        // e.g. "getUser"
  method: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'
  path: string                        // e.g. "/users/{id}"
  pathParams?: ParamDefinition[]
  queryParams?: ParamDefinition[]
  requestBody?: SchemaDefinition
  responseSchema?: SchemaDefinition
  requiresAuth?: boolean
}

export interface ParamDefinition {
  name: string
  type: 'String'|'int'|'double'|'bool'
  required?: boolean
  defaultValue?: string
}

export interface SchemaDefinition {
  type: 'object'|'array'|'string'|'int'|'double'|'bool'
  properties?: Record<string, SchemaDefinition>
  items?: SchemaDefinition
  required?: string[]
}

// ── Riverpod provider definition ─────────────────────────────
export interface ProviderDefinition {
  id: string
  name: string                        // e.g. "userProvider"
  type: 'state'|'stateNotifier'|'asyncNotifier'|'stream'|'future'|'computed'
  stateType: string                   // Dart type e.g. "User", "List<Product>"
  initialValue?: string               // Dart expression
  serviceBinding?: {
    serviceId: string
    operation: string
  }
}

// ── Asset definition ─────────────────────────────────────────
export interface AssetDefinition {
  id: string
  name: string
  path: string                        // e.g. "assets/images/logo.png"
  type: 'image'|'font'|'json'|'svg'|'lottie'
}
