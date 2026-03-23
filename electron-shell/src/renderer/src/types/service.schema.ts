// ============================================================
// FlutterForge — Microservice JSON Schema
// Defines services, gateway, events, DB — feeds Java codegen
// ============================================================

// ── HTTP methods & response codes ───────────────────────────
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type HttpStatus = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 500

// ── OpenAPI-style field types ────────────────────────────────
export type FieldType =
  | 'String' | 'Integer' | 'Long' | 'Double' | 'Float'
  | 'Boolean' | 'LocalDate' | 'LocalDateTime' | 'UUID'
  | 'BigDecimal' | 'List' | 'Map' | 'Object'

// ── Database engines ─────────────────────────────────────────
export type DbEngine = 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'h2'
export type DbColumnType =
  | 'VARCHAR' | 'TEXT' | 'INTEGER' | 'BIGINT' | 'DECIMAL'
  | 'BOOLEAN' | 'TIMESTAMP' | 'DATE' | 'UUID' | 'JSONB' | 'BYTEA'

// ── Kafka event patterns ─────────────────────────────────────
export type EventPattern = 'publish' | 'subscribe' | 'request-reply'

// ── Security schemes ─────────────────────────────────────────
export type SecurityScheme = 'jwt' | 'oauth2' | 'apiKey' | 'basicAuth' | 'none'

// ─────────────────────────────────────────────────────────────
// DATABASE SCHEMA
// ─────────────────────────────────────────────────────────────
export interface DbColumnDefinition {
  name: string
  type: DbColumnType
  length?: number
  precision?: number
  scale?: number
  nullable?: boolean
  unique?: boolean
  primaryKey?: boolean
  autoGenerate?: boolean          // UUID auto-generate or SERIAL
  defaultValue?: string
  foreignKey?: {
    table: string
    column: string
    onDelete?: 'CASCADE' | 'SET_NULL' | 'RESTRICT'
  }
  index?: boolean
}

export interface DbTableDefinition {
  name: string                    // snake_case e.g. "user_profiles"
  columns: DbColumnDefinition[]
  indexes?: {
    name: string
    columns: string[]
    unique?: boolean
  }[]
  comments?: string
}

export interface DatabaseDefinition {
  engine: DbEngine
  name: string                    // database name
  schema?: string                 // PostgreSQL schema, default "public"
  tables: DbTableDefinition[]
  flywayEnabled: boolean
  connectionPoolSize?: number
}

// ─────────────────────────────────────────────────────────────
// API / ENDPOINT DEFINITIONS
// ─────────────────────────────────────────────────────────────
export interface ApiFieldDefinition {
  name: string
  type: FieldType
  itemType?: string               // for List<T> — the T
  required?: boolean
  description?: string
  example?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
    notBlank?: boolean
    notNull?: boolean
    size?: { min?: number; max?: number }
  }
}

export interface ApiSchemaDefinition {
  name: string                    // Java class name e.g. "UserResponse"
  type: 'request' | 'response' | 'event' | 'shared'
  fields: ApiFieldDefinition[]
  description?: string
}

export interface ApiEndpoint {
  id: string
  path: string                    // e.g. "/api/v1/users/{id}"
  method: HttpMethod
  operationId: string             // e.g. "getUserById" — becomes Java method name
  summary: string
  description?: string
  tags?: string[]
  pathParams?: ApiFieldDefinition[]
  queryParams?: ApiFieldDefinition[]
  requestBody?: string            // references ApiSchemaDefinition.name
  responses: ApiEndpointResponse[]
  security?: SecurityScheme
  rateLimit?: {
    requests: number
    windowSeconds: number
  }
  cache?: {
    ttlSeconds: number
    key?: string
  }
}

export interface ApiEndpointResponse {
  status: HttpStatus
  schema?: string                 // references ApiSchemaDefinition.name
  description: string
}

// ─────────────────────────────────────────────────────────────
// KAFKA / EVENT DEFINITIONS
// ─────────────────────────────────────────────────────────────
export interface KafkaTopicDefinition {
  name: string                    // e.g. "user.created"
  pattern: EventPattern
  payloadSchema: string           // references ApiSchemaDefinition.name
  partitions?: number
  replicationFactor?: number
  retentionMs?: number
  description?: string
}

// ─────────────────────────────────────────────────────────────
// CORE MICROSERVICE DEFINITION
// ─────────────────────────────────────────────────────────────
export interface MicroserviceDefinition {
  id: string
  name: string                    // PascalCase e.g. "UserService"
  artifactId: string              // kebab-case e.g. "user-service"
  groupId: string                 // e.g. "com.mycompany"
  version: string                 // e.g. "1.0.0"
  description?: string
  port: number                    // default server port e.g. 8081

  // Spring Boot config
  springProfiles: ('default' | 'dev' | 'staging' | 'prod')[]
  javaVersion: '17' | '21'
  springBootVersion: '3.1' | '3.2' | '3.3'

  // API layer
  apiBasePath: string             // e.g. "/api/v1"
  endpoints: ApiEndpoint[]
  schemas: ApiSchemaDefinition[]

  // Security
  security: {
    scheme: SecurityScheme
    jwtSecret?: string            // placeholder — real value in env
    jwtExpiry?: number            // seconds
    corsOrigins?: string[]
    publicPaths?: string[]        // paths that bypass auth
  }

  // Database
  database?: DatabaseDefinition

  // Messaging
  kafkaTopics?: KafkaTopicDefinition[]
  kafkaGroupId?: string           // consumer group id

  // Service dependencies (Feign clients)
  dependencies?: ServiceDependency[]

  // Infrastructure hints
  infra: InfraDefinition

  // Generated metadata
  metadata?: {
    createdAt: string
    updatedAt: string
    aiGenerated?: boolean
    notes?: string
  }
}

export interface ServiceDependency {
  serviceId: string               // references MicroserviceDefinition.id
  clientName: string              // e.g. "UserServiceClient"
  circuitBreaker?: boolean
  retry?: {
    maxAttempts: number
    waitDuration: number          // ms
  }
  fallback?: boolean
}

// ─────────────────────────────────────────────────────────────
// INFRASTRUCTURE DEFINITION
// ─────────────────────────────────────────────────────────────
export interface InfraDefinition {
  // Container
  docker: {
    baseImage: string             // e.g. "eclipse-temurin:21-jre-alpine"
    exposedPort: number
    healthCheckPath: string       // e.g. "/actuator/health"
    envVars?: EnvVarDefinition[]
    labels?: Record<string, string>
  }

  // Kubernetes / OpenShift
  kubernetes: {
    namespace: string
    replicas: {
      min: number
      max: number
      targetCpuPercent?: number
    }
    resources: {
      requests: ResourceSpec
      limits: ResourceSpec
    }
    livenessProbe: ProbeDefinition
    readinessProbe: ProbeDefinition
    serviceType: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
    ingressEnabled?: boolean
    ingressHost?: string
    openShiftRoute?: boolean      // generate OpenShift Route instead of Ingress
  }

  // CI/CD
  cicd: {
    provider: 'github-actions' | 'jenkins' | 'tekton' | 'gitlab-ci'
    registry: string              // e.g. "registry.mycompany.com"
    imageName: string             // e.g. "mycompany/user-service"
    branchStrategy: 'gitflow' | 'trunk'
    environments: DeployEnvironment[]
  }
}

export interface EnvVarDefinition {
  name: string                    // e.g. "DB_PASSWORD"
  defaultValue?: string
  fromSecret?: string             // K8s secret name
  fromConfigMap?: string
  description?: string
}

export interface ResourceSpec {
  cpu: string                     // e.g. "250m"
  memory: string                  // e.g. "512Mi"
}

export interface ProbeDefinition {
  path: string
  port: number
  initialDelaySeconds: number
  periodSeconds: number
  failureThreshold?: number
}

export interface DeployEnvironment {
  name: 'dev' | 'staging' | 'prod'
  namespace: string
  valuesFile: string              // Helm values file e.g. "values-prod.yaml"
  autoDeployBranch?: string       // auto-deploy when this branch is pushed
  requiresApproval?: boolean
}

// ─────────────────────────────────────────────────────────────
// API GATEWAY DEFINITION
// ─────────────────────────────────────────────────────────────
export interface GatewayRouteDefinition {
  id: string
  predicates: {
    path: string                  // e.g. "/api/user/**"
    method?: HttpMethod[]
    headers?: Record<string, string>
  }
  targetServiceId: string         // references MicroserviceDefinition.id
  stripPrefix?: number            // strip N path segments before forwarding
  filters?: GatewayFilter[]
  rateLimit?: {
    replenishRate: number
    burstCapacity: number
  }
  circuitBreaker?: {
    name: string
    fallbackUri?: string
  }
}

export interface GatewayFilter {
  type: 'AddRequestHeader' | 'AddResponseHeader' | 'RewritePath'
         | 'RequestRateLimiter' | 'CircuitBreaker' | 'Retry'
  args?: Record<string, string>
}

export interface ApiGatewayDefinition {
  id: string
  artifactId: string              // e.g. "api-gateway"
  groupId: string
  version: string
  port: number                    // e.g. 8080
  routes: GatewayRouteDefinition[]
  globalCors: {
    allowedOrigins: string[]
    allowedMethods: HttpMethod[]
    allowedHeaders: string[]
    allowCredentials: boolean
  }
  auth: {
    jwtSecret: string             // placeholder
    tokenValidationPath?: string  // forward to auth service for validation
  }
  infra: InfraDefinition
}

// ─────────────────────────────────────────────────────────────
// FULL PROJECT SERVICE GRAPH
// ─────────────────────────────────────────────────────────────
export interface ServiceGraphDefinition {
  id: string
  projectId: string               // references FlutterForgeProject.id
  name: string
  gateway: ApiGatewayDefinition
  services: Record<string, MicroserviceDefinition>  // id → service
  sharedSchemas?: ApiSchemaDefinition[]
  kafka?: {
    bootstrapServers: string
    topics: KafkaTopicDefinition[]
  }
  createdAt: string
  updatedAt: string
}
