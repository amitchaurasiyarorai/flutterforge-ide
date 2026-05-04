import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export interface ScreenCodeFile  { screenId: string; screenName: string; filename: string; route: string; dartCode: string; lastSaved: string }
export interface ServiceCodeFile { serviceId: string; serviceName: string; artifactId: string; javaCode: string; lastSaved: string }
export interface SharedCodeFile  { id: string; filename: string; lang: 'dart'|'java'; code: string; lastSaved: string }

export interface CodeState {
  screenFiles:  Record<string, ScreenCodeFile>
  serviceFiles: Record<string, ServiceCodeFile>
  sharedFiles:  SharedCodeFile[]
  activeScreenFileId:   string|null
  activeServiceFileId:  string|null
  activeSharedFileId:   string|null
  initScreenFile:       (screenId: string, screenName: string, route: string) => void
  updateScreenCode:     (screenId: string, code: string) => void
  renameScreenFile:     (screenId: string, filename: string) => void
  renameScreenCascade:  (screenId: string, newScreenName: string) => void
  deleteScreenFile:     (screenId: string) => void
  initServiceFile:      (serviceId: string, serviceName: string, artifactId: string, groupId: string) => void
  updateServiceCode:    (serviceId: string, code: string) => void
  deleteServiceFile:    (serviceId: string) => void
  addSharedFile:        (filename: string, lang: 'dart'|'java') => void
  updateSharedCode:     (id: string, code: string) => void
  renameSharedFile:     (id: string, filename: string) => void
  deleteSharedFile:     (id: string) => void
  setActiveScreenFile:  (id: string|null) => void
  setActiveServiceFile: (id: string|null) => void
  setActiveSharedFile:  (id: string|null) => void
}

// ─── Dart scaffold (blank linked file like your old IDE .js) ───

export function generateDartScaffold(screenName: string, route: string): string {
  const cls  = screenName.endsWith('Screen') ? screenName : screenName + 'Screen'
  const ctrl = cls.replace('Screen','Controller')
  const prov = lcFirst(cls.replace('Screen','')) + 'Provider'
  return `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ──────────────────────────────────────────────────────────
// ${cls} — Business Logic
// Route: ${route}
//
// Created by FlutterForge IDE.
// Write your business logic here.
// UI layout lives in the Canvas tab.
// ──────────────────────────────────────────────────────────


// ── State ─────────────────────────────────────────────────

class ${cls}State {
  final bool isLoading;
  final String? error;
  const ${cls}State({this.isLoading = false, this.error});
  ${cls}State copyWith({bool? isLoading, String? error}) =>
    ${cls}State(isLoading: isLoading ?? this.isLoading, error: error ?? this.error);
}


// ── Controller ────────────────────────────────────────────

class ${ctrl} extends StateNotifier<${cls}State> {
  ${ctrl}(this.ref) : super(const ${cls}State());
  final Ref ref;

  /// Called once when screen mounts
  Future<void> init() async {
    // TODO: load initial data
  }

  // Write your business logic methods below.
  //
  // Example — load list from API:
  // Future<void> loadItems() async {
  //   state = state.copyWith(isLoading: true);
  //   try {
  //     final items = await ref.read(apiClientProvider).get('/items');
  //     state = state.copyWith(isLoading: false);
  //   } catch (e) {
  //     state = state.copyWith(error: e.toString(), isLoading: false);
  //   }
  // }
  //
  // Example — handle button tap:
  // void onSubmitTapped() { /* validate, call API, navigate */ }
}


// ── Provider ──────────────────────────────────────────────

/// Use in your screen widget:
///   final state = ref.watch(${prov});
///   ref.read(${prov}.notifier).someMethod();
final ${prov} =
    StateNotifierProvider.autoDispose<${ctrl}, ${cls}State>(
  (ref) => ${ctrl}(ref)..init(),
);
`
}

// ─── Java scaffold (ServiceImpl per microservice) ───────────

export function generateJavaScaffold(serviceName: string, artifactId: string, groupId: string): string {
  const pkg    = groupId + '.' + artifactId.replace(/-/g,'')
  const entity = serviceName.replace(/Service$/i,'')
  const evar   = lcFirst(entity)
  const repo   = evar + 'Repository'
  return `package ${pkg}.service.impl;

import ${pkg}.dto.${entity}Request;
import ${pkg}.dto.${entity}Response;
import ${pkg}.dto.PagedResponse;
import ${pkg}.entity.${entity}Entity;
import ${pkg}.exception.${entity}NotFoundException;
import ${pkg}.repository.${entity}Repository;
import ${pkg}.service.${entity}Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

// ──────────────────────────────────────────────────────────
// ${serviceName} — Business Logic
// Service: ${artifactId}
//
// Created by FlutterForge IDE.
// Write your business logic here.
// The scaffold (Controller, Repository, Entity, DTOs)
// is auto-generated when you click Generate.
// ──────────────────────────────────────────────────────────

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ${serviceName}Impl implements ${entity}Service {

    private final ${entity}Repository ${repo};

    @Override
    public PagedResponse<${entity}Response> findAll(Pageable pageable) {
        // TODO: add search / filter logic here
        return PagedResponse.of(${repo}.findAll(pageable).map(this::toResponse));
    }

    @Override
    public ${entity}Response findById(UUID id) {
        return ${repo}.findById(id).map(this::toResponse)
            .orElseThrow(() -> new ${entity}NotFoundException(id));
    }

    @Override
    @Transactional
    public ${entity}Response create(${entity}Request request) {
        // TODO: add validation, side-effects (email, events, etc.)
        ${entity}Entity entity = toEntity(request);
        entity = ${repo}.save(entity);
        log.info("Created ${entity} id={}", entity.getId());
        return toResponse(entity);
    }

    @Override
    @Transactional
    public ${entity}Response update(UUID id, ${entity}Request request) {
        ${entity}Entity entity = ${repo}.findById(id).orElseThrow(() -> new ${entity}NotFoundException(id));
        updateEntity(entity, request);
        return toResponse(${repo}.save(entity));
    }

    @Override
    @Transactional
    public void delete(UUID id) {
        if (!${repo}.existsById(id)) throw new ${entity}NotFoundException(id);
        ${repo}.deleteById(id);
        log.info("Deleted ${entity} id={}", id);
    }

    // ── Mappers ───────────────────────────────────────────

    private ${entity}Response toResponse(${entity}Entity e) {
        return ${entity}Response.builder()
            .id(e.getId()).createdAt(e.getCreatedAt()).updatedAt(e.getUpdatedAt())
            // TODO: .name(e.getName())
            .build();
    }

    private ${entity}Entity toEntity(${entity}Request r) {
        return ${entity}Entity.builder()
            // TODO: .name(r.getName())
            .build();
    }

    private void updateEntity(${entity}Entity e, ${entity}Request r) {
        // TODO: e.setName(r.getName());
    }

    // ── Custom business methods ───────────────────────────
    // Add your own methods below.
}
`
}

// ─── Shared file templates (project-wide helpers) ──────────

export function generateSharedDartTemplate(filename: string): string {
  return `import 'package:flutter_riverpod/flutter_riverpod.dart';

// ──────────────────────────────────────────────────────────
// ${filename} — Shared Project Logic
//
// Use for logic shared across all screens:
//   - API client setup
//   - External SDK initialisation (Firebase, Stripe, etc.)
//   - Connectivity helpers
//   - Common utilities & constants
// ──────────────────────────────────────────────────────────

// Example — API client provider
// final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(
//   baseUrl: const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:9876'),
// ));

// Example — connectivity helper
// final connectivityProvider = StreamProvider<bool>((ref) async* {
//   yield* Connectivity().onConnectivityChanged.map((r) => r != ConnectivityResult.none);
// });
`
}

export function generateSharedJavaTemplate(filename: string): string {
  const cls = filename.replace('.java','')
  const pkg = filename.replace('.java','').toLowerCase()
  return `package \${pkg}.shared;

import org.springframework.stereotype.Component;

// ──────────────────────────────────────────────────────────
// ${filename} — Shared Project Logic
//
// Use for logic shared across all services:
//   - Common utilities
//   - External SDK wrappers (Stripe, Twilio, etc.)
//   - Shared event publishers
//   - Cross-service constants
// ──────────────────────────────────────────────────────────

@Component
public class ${cls} {

    // TODO: add shared project-wide logic here

}
`
}

// ─── Utilities ──────────────────────────────────────────────

function lcFirst(s: string) { return s.charAt(0).toLowerCase() + s.slice(1) }

// Used inside store (not exported to avoid conflict with component version)
function toSnakeCaseStore(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
}

// ─── Store ──────────────────────────────────────────────────

export const useCodeStore = create<CodeState>()(
  persist(
    immer((set) => ({
      screenFiles: {}, serviceFiles: {}, sharedFiles: [],
      activeScreenFileId: null, activeServiceFileId: null, activeSharedFileId: null,

      initScreenFile: (screenId, screenName, route) => set((s) => {
        if (!s.screenFiles[screenId]) {
          // Issue 2 fix: filename matches screen name exactly e.g. LoginScreen → login_screen.dart
          const filename = toSnakeCaseStore(screenName) + '.dart'
          s.screenFiles[screenId] = { screenId, screenName, filename, route, dartCode: generateDartScaffold(screenName, route), lastSaved: new Date().toISOString() }
        }
        s.activeScreenFileId = screenId; s.activeServiceFileId = null; s.activeSharedFileId = null
      }),
      updateScreenCode: (screenId, code) => set((s) => {
        if (s.screenFiles[screenId]) { s.screenFiles[screenId].dartCode = code; s.screenFiles[screenId].lastSaved = new Date().toISOString() }
      }),
      // Issue 1 fix: rename screen dart file
      renameScreenFile: (screenId, filename) => set((s) => {
        if (s.screenFiles[screenId]) {
          const ext = filename.endsWith('.dart') ? filename : filename + '.dart'
          s.screenFiles[screenId].filename = ext
        }
      }),

      // Called when a screen is renamed in the Canvas tab — cascades name + filename
      renameScreenCascade: (screenId: string, newScreenName: string) => set((s) => {
        if (!s.screenFiles[screenId]) return
        const newFilename = toSnakeCaseStore(newScreenName) + '.dart'
        s.screenFiles[screenId].screenName = newScreenName
        s.screenFiles[screenId].filename   = newFilename
        // Note: we don't regenerate dartCode — developer may have written logic already
        // Just update the comment header to reflect the new name
        const current = s.screenFiles[screenId].dartCode
        const updated = current.replace(
          /\/\/ .+Screen — Business Logic/,
          `// ${newScreenName.endsWith('Screen') ? newScreenName : newScreenName + 'Screen'} — Business Logic`
        )
        s.screenFiles[screenId].dartCode   = updated
        s.screenFiles[screenId].lastSaved  = new Date().toISOString()
      }),
      deleteScreenFile: (screenId) => set((s) => {
        delete s.screenFiles[screenId]; if (s.activeScreenFileId === screenId) s.activeScreenFileId = null
      }),

      initServiceFile: (serviceId, serviceName, artifactId, groupId) => set((s) => {
        if (!s.serviceFiles[serviceId]) {
          s.serviceFiles[serviceId] = { serviceId, serviceName, artifactId, javaCode: generateJavaScaffold(serviceName, artifactId, groupId), lastSaved: new Date().toISOString() }
        }
        s.activeServiceFileId = serviceId; s.activeScreenFileId = null; s.activeSharedFileId = null
      }),
      updateServiceCode: (serviceId, code) => set((s) => {
        if (s.serviceFiles[serviceId]) { s.serviceFiles[serviceId].javaCode = code; s.serviceFiles[serviceId].lastSaved = new Date().toISOString() }
      }),
      deleteServiceFile: (serviceId) => set((s) => {
        delete s.serviceFiles[serviceId]; if (s.activeServiceFileId === serviceId) s.activeServiceFileId = null
      }),

      addSharedFile: (filename, lang) => set((s) => {
        const id = 'shared_' + Date.now()
        const code = lang === 'dart' ? generateSharedDartTemplate(filename) : generateSharedJavaTemplate(filename)
        s.sharedFiles.push({ id, filename, lang, code, lastSaved: new Date().toISOString() })
        s.activeSharedFileId = id; s.activeScreenFileId = null; s.activeServiceFileId = null
      }),
      updateSharedCode: (id, code) => set((s) => {
        const f = s.sharedFiles.find(f => f.id === id)
        if (f) { f.code = code; f.lastSaved = new Date().toISOString() }
      }),
      // Issue 1 fix: rename shared file
      renameSharedFile: (id, filename) => set((s) => {
        const f = s.sharedFiles.find(f => f.id === id)
        if (f) f.filename = filename
      }),
      deleteSharedFile: (id) => set((s) => {
        s.sharedFiles = s.sharedFiles.filter(f => f.id !== id)
        if (s.activeSharedFileId === id) s.activeSharedFileId = null
      }),

      setActiveScreenFile:  (id) => set((s) => { s.activeScreenFileId  = id; s.activeServiceFileId = null; s.activeSharedFileId = null }),
      setActiveServiceFile: (id) => set((s) => { s.activeServiceFileId = id; s.activeScreenFileId  = null; s.activeSharedFileId = null }),
      setActiveSharedFile:  (id) => set((s) => { s.activeSharedFileId  = id; s.activeScreenFileId  = null; s.activeServiceFileId = null }),
    })),
    { name: 'ff-code-files', version: 1 }
  )
)
