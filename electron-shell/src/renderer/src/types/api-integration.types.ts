// ─────────────────────────────────────────────────────────────────────────────
// API Integration Types
// Shared across DataFiles, Interfaces, Canvas binding, and Code generation
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType = 'String' | 'int' | 'double' | 'bool' | 'DateTime' | 'List' | 'Object' | 'dynamic'

export type ResponseType =
  | 'FLAT_OBJECT'     // { name, balance, status }
  | 'BARE_ARRAY'      // [ item, item, item ]
  | 'WRAPPED_ARRAY'   // { data: [...], total, page, pageSize }
  | 'NESTED'          // { kendra: { groups: [{ members: [...] }] } }
  | 'STATUS'          // { success: true, message: "ok", receiptNo: "R1" }
  | 'DYNAMIC_KEYS'    // { categories: { personal: [...], home: [...] } }

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey' | 'custom'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type TriggerType = 'onScreenLoad' | 'onButtonTap' | 'manual' | 'onPullRefresh'
export type CacheStrategy = 'none' | 'memory' | 'session' | 'persistent'
export type FormatType = 'none' | 'currency' | 'date' | 'dateTime' | 'percentage' | 'uppercase' | 'lowercase' | 'truncate' | 'custom'

// ── Schema field (recursive for nested) ──────────────────────────────────────
export interface SchemaField {
  id:         string
  name:       string
  type:       FieldType
  required:   boolean
  mockValue:  string
  description?: string
  // For List type — what type is each item
  itemType?:  FieldType | string   // string = reference to another schema name
  // For Object / nested
  fields?:    SchemaField[]
  // Path hint for deep access e.g. "groups[].members"
  path?:      string
}

// ── Data File (response schema definition) ───────────────────────────────────
export interface DataFile {
  id:           string
  name:         string          // e.g. "KendraResponse"
  description:  string
  responseType: ResponseType
  // For array types — path inside the response where the array lives
  arrayPath?:   string          // e.g. "data" for { data: [...] }
  // For wrapped arrays — pagination fields
  paginationFields?: {
    totalField:    string       // e.g. "total"
    pageField:     string       // e.g. "page"
    pageSizeField: string       // e.g. "pageSize"
  }
  // For dynamic keys — value schema
  dynamicValueType?: FieldType | string
  // Success schema
  fields:       SchemaField[]
  // Error schema (can differ from success)
  errorSchema?: SchemaField[]
  // Full mock response JSON string for test preview
  mockJson:     string
  createdAt:    string
  updatedAt:    string
}

// ── Interface request param ───────────────────────────────────────────────────
export interface RequestParam {
  id:       string
  name:     string
  type:     FieldType
  location: 'path' | 'query' | 'body' | 'header'
  required: boolean
  mockValue: string
}

// ── Interface hook code ───────────────────────────────────────────────────────
export interface InterfaceHooks {
  onBeforeCall: string    // Dart code body — empty string = use default
  onResponse:   string    // Dart code body — empty string = use default
  onError:      string    // Dart code body — empty string = use default
}

// ── Interface definition ──────────────────────────────────────────────────────
export interface InterfaceDefinition {
  id:             string
  name:           string           // e.g. "getKendraList"
  description:    string
  method:         HttpMethod
  urlPath:        string           // e.g. "/api/kendra/list" (base URL from app-config)
  authType:       AuthType
  authHeaderName?: string          // for apiKey auth
  // Request
  params:         RequestParam[]
  requestBodySchemaId?: string     // for POST/PUT — links to a DataFile
  // Response
  responseSchemaId: string         // links to a DataFile
  triggerType:    TriggerType
  cacheStrategy:  CacheStrategy
  cacheDuration?: number           // seconds
  // Developer hooks
  hooks:          InterfaceHooks
  // Test results
  lastTestResult?: {
    status:     number
    body:       string
    testedAt:   string
    durationMs: number
  }
  createdAt:      string
  updatedAt:      string
}

// ── Widget binding (stored in screen.json per widget) ─────────────────────────
export interface WidgetBinding {
  interfaceId:  string         // which interface
  fieldPath:    string         // dot-notation field path e.g. "locationName" or "groups[].memberCount"
  targetProp:   string         // which widget prop gets this value e.g. "data", "src", "value"
  format:       FormatType
  formatArg?:   string         // for custom format or truncate length
  // Conditional visibility
  visibilityExpr?: string      // e.g. "groups.length > 0" or "status == 'ACTIVE'"
  // For list widgets — array binding
  isArrayBinding?: boolean
  arrayPath?:   string         // path to the array within the response
}

// ── The complete interfaces store state ───────────────────────────────────────
export interface IntegrationsState {
  dataFiles:  DataFile[]
  interfaces: InterfaceDefinition[]
}

// ── Default hooks template ───────────────────────────────────────────────────
export const DEFAULT_HOOKS: InterfaceHooks = {
  onBeforeCall: `// Modify the request before it is sent.
// Add custom headers, inject session data, append params.
// Return the modified request.
return request;`,
  onResponse: `// Transform the raw API response before widgets receive it.
// Filter lists, calculate new fields, flatten nested data.
// Return the modified map.
return raw;`,
  onError: `// Handle API errors.
// Redirect on 401, show dialogs for business errors, log, etc.
// AzLogger.error('Error: \$error');`,
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  FLAT_OBJECT:   'Flat object  { name, value }',
  BARE_ARRAY:    'Bare array  [ {}, {}, {} ]',
  WRAPPED_ARRAY: 'Wrapped array  { data: [...], total, page }',
  NESTED:        'Nested  { obj: { list: [ { sub: [] } ] } }',
  STATUS:        'Status response  { success, message }',
  DYNAMIC_KEYS:  'Dynamic keys  { category: [ item ] }',
}

export const FIELD_TYPES: FieldType[] = ['String','int','double','bool','DateTime','List','Object','dynamic']

export const FORMAT_EXAMPLES: Record<FormatType, string> = {
  none:       'raw value',
  currency:   '₹2,84,750.00',
  date:       '26 Mar 2026',
  dateTime:   '26 Mar 2026, 2:30 PM',
  percentage: '28.5%',
  uppercase:  'MUMBAI CENTRAL',
  lowercase:  'mumbai central',
  truncate:   'Mumbai Cent...',
  custom:     'custom expression',
}

export function makeFieldId(): string {
  return 'f-' + Math.random().toString(36).slice(2, 10)
}

export function makeInterfaceId(): string {
  return 'ifc-' + Math.random().toString(36).slice(2, 10)
}

export function makeDataFileId(): string {
  return 'df-' + Math.random().toString(36).slice(2, 10)
}
