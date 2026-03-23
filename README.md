# FlutterForge IDE

> A next-generation low-code IDE for building Flutter apps and Spring Boot microservices —
> with AI-powered code generation via Claude (Anthropic).

---

## What is FlutterForge?

FlutterForge is a desktop IDE (Electron) that lets developers **drag-and-drop Flutter widgets**
on a visual canvas and generates production-ready code for:

- **Flutter apps** — iOS, Android, Web, Desktop from a single codebase
- **Spring Boot microservices** — with OpenAPI contracts, Flyway DB migrations, Kafka events
- **API Gateway** — Spring Cloud Gateway replacing a monolith interface
- **Full infrastructure** — Dockerfile, Helm charts, CI/CD pipelines, docker-compose

AI acceleration via **Claude API** means developers can describe a screen or service in plain
English and get complete, compilable code instantly.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| IDE Shell | Electron 28 + React 18 + TypeScript | Desktop application |
| Canvas State | Zustand + Immer | Widget tree state management |
| Code Generation | Java 21 + Spring Boot 3.2 + JTE | Dart/Flutter + Spring Boot output |
| Flutter Output | Flutter 3.x / Dart | iOS, Android, Web, Desktop apps |
| Microservices | Spring Boot 3.2 + Spring Cloud Gateway | Backend services |
| AI Layer | Claude API — Sonnet 4.6 + Haiku 4.5 | Screen gen, service design, copilot |
| Infrastructure | Docker + Helm + K8s / OpenShift | Deployment targets |

---

## Repository Structure

```
flutterforge-ide/
│
├── electron-shell/                          # Electron + React IDE
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts                     # Main process + IPC handlers
│   │   │   └── preload.ts                   # Secure renderer bridge
│   │   └── renderer/src/
│   │       ├── components/                  # React UI components
│   │       │   ├── canvas/                  # Drag-drop canvas
│   │       │   ├── palette/                 # Widget palette
│   │       │   ├── properties/              # Properties panel
│   │       │   └── copilot/                 # AI copilot sidebar
│   │       ├── store/
│   │       │   └── canvas.store.ts          # Zustand canvas state
│   │       └── types/
│   │           ├── widget.schema.ts         # Flutter widget JSON schema
│   │           └── service.schema.ts        # Microservice JSON schema
│   └── package.json
│
├── codegen-engine/                          # Java Spring Boot codegen service
│   ├── src/main/java/com/flutterforge/
│   │   ├── codegen/
│   │   │   ├── FlutterForgeCodegenEngine.java   # Main orchestrator
│   │   │   └── dart/
│   │   │       └── DartWidgetCodegen.java        # Flutter/Dart generator
│   │   └── ai/
│   │       ├── ClaudeApiClient.java              # Anthropic API + streaming
│   │       └── PromptLibrary.java                # All Claude system prompts
│   ├── src/main/resources/
│   │   └── application.yml
│   └── pom.xml
│
├── .gitignore
├── .gitlab-ci.yml                           # CI/CD pipeline
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Java 21 (JDK)
- Maven 3.9+
- Flutter 3.x SDK (for preview feature)
- An [Anthropic API key](https://console.anthropic.com)

### 1. Start the Codegen Engine

```bash
cd codegen-engine

# Add your Anthropic API key
echo "anthropic.api.key=YOUR_KEY_HERE" >> src/main/resources/application-local.yml

# Run
mvn spring-boot:run -Dspring.profiles.active=ide,local
```

Engine starts on `http://localhost:9876`

### 2. Start the Electron IDE

```bash
cd electron-shell
npm install
npm run dev
```

IDE launches as a desktop application.

---

## Development Sessions

Each session adds a complete, compilable module:

| Session | Module | Status |
|---|---|---|
| **Session 1** | Widget schema + Service schema + Codegen engine + AI layer + Electron shell | ✅ Complete |
| Session 2 | State codegen (Riverpod) + API client codegen + Router codegen | 🔜 Next |
| Session 3 | Spring Boot service generator + Gateway generator | 🔜 Planned |
| Session 4 | React canvas component + Widget palette + Properties panel | 🔜 Planned |
| Session 5 | AI Copilot sidebar + Screen generation UI | 🔜 Planned |
| Session 6 | Infra generator (Helm + CI/CD + docker-compose) | 🔜 Planned |

---

## Branch Strategy

```
main          ← stable, tagged releases
develop       ← integration branch
feature/*     ← individual features (e.g. feature/dart-state-codegen)
session/*     ← generated session commits (e.g. session/2-state-codegen)
fix/*         ← bug fixes
```

---

## AI Features

| Feature | Model | Trigger |
|---|---|---|
| Screen generation from description | claude-sonnet-4-6 | "Describe screen" prompt bar |
| Microservice design from description | claude-sonnet-4-6 | Service designer panel |
| Widget autocomplete | claude-haiku-4-5 | Drag from palette |
| Code review of generated Dart | claude-sonnet-4-6 | Pre-export step |
| Test generation | claude-sonnet-4-6 | Build settings toggle |
| AI Copilot chat | claude-sonnet-4-6 | Right sidebar |
| Inline code explain | claude-haiku-4-5 | Hover on code block |

---

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `anthropic.api.key` | `application-local.yml` | Claude API key |
| `server.port` | `application.yml` | Codegen engine port (default 9876) |
| `ELECTRON_RENDERER_URL` | Auto-set by electron-vite | Dev server URL |

---

## Contributing

1. Branch from `develop`: `git checkout -b feature/your-feature develop`
2. Commit with conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
3. Open a merge request into `develop`
4. Sessions generated by Claude are committed directly to `session/*` branches

---

## License

Proprietary — All rights reserved.
