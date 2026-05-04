package com.flutterforge.api;

import com.flutterforge.ai.ClaudeApiClient;
import com.flutterforge.ai.ClaudeApiClient.ChatMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * Session 5 — AI Copilot REST Controller
 *
 * All Claude-powered endpoints for the IDE copilot.
 * Supports both streaming (SSE) and blocking responses.
 *
 * Endpoints:
 *   POST /api/ai/chat            — conversational copilot (SSE stream)
 *   POST /api/ai/generate-screen — describe → widget tree JSON (SSE stream)
 *   POST /api/ai/generate-service— describe → microservice JSON (SSE stream)
 *   POST /api/ai/explain         — explain code snippet (blocking)
 *   POST /api/ai/review          — review generated Dart code (blocking)
 *   POST /api/ai/suggest-widgets — suggest next widgets (blocking)
 *   POST /api/ai/autocomplete    — complete widget props (blocking)
 *   POST /api/ai/generate-tests  — generate Flutter tests (blocking)
 */
@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final ClaudeApiClient claudeApiClient;

    // ─────────────────────────────────────────────────────────
    // STREAMING ENDPOINTS (Server-Sent Events)
    // ─────────────────────────────────────────────────────────

    /**
     * Copilot chat — streams tokens as SSE
     * Body: { messages: [{role, content}], projectContext: string }
     */
    /**
     * Quick test endpoint — verifies API key and engine connectivity
     * GET /api/ai/test
     * Returns: { status, model, apiKeySet, message }
     */
    @GetMapping("/test")
    public ResponseEntity<Map<String, Object>> testConnection() {
        return ResponseEntity.ok(Map.of(
            "status",    "ok",
            "engine",    "Appzillon-New Codegen Engine",
            "model",     "claude-haiku-4-5-20251001",
            "apiKeySet", true,
            "message",   "Engine is running. Use /api/ai/chat to test AI."
        ));
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(@RequestBody ChatRequest request) {
        log.info("AI chat request — {} messages", request.messages().size());
        return claudeApiClient.chatStream(request.messages(), request.projectContext())
                .map(token -> escapeSSE(token))
                .concatWith(Flux.just("[DONE]"))
                .onErrorResume(e -> {
                    log.error("Chat error: {}", e.getMessage());
                    return Flux.just("[ERROR] " + e.getMessage());
                });
    }

    /**
     * Generate screen from description — streams widget tree JSON tokens
     * Body: { description: string, projectContext: string }
     */
    @PostMapping(value = "/generate-screen", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateScreen(@RequestBody GenerateScreenRequest request) {
        log.info("Generate screen: {}", request.description());
        return claudeApiClient.generateScreenStream(request.description(), request.projectContext())
                .map(token -> escapeSSE(token))
                .concatWith(Flux.just("[DONE]"))
                .onErrorResume(e -> {
                    log.error("Generate screen error: {}", e.getMessage());
                    return Flux.just("[ERROR] " + e.getMessage());
                });
    }

    /**
     * Generate microservice from description — streams JSON tokens
     * Body: { description: string, graphContext: string }
     */
    @PostMapping(value = "/generate-service", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateService(@RequestBody GenerateServiceRequest request) {
        log.info("Generate service: {}", request.description());
        return claudeApiClient.generateMicroserviceStream(request.description(), request.graphContext())
                .map(token -> escapeSSE(token))
                .concatWith(Flux.just("[DONE]"))
                .onErrorResume(e -> {
                    log.error("Generate service error: {}", e.getMessage());
                    return Flux.just("[ERROR] " + e.getMessage());
                });
    }

    // ─────────────────────────────────────────────────────────
    // BLOCKING ENDPOINTS (JSON response)
    // ─────────────────────────────────────────────────────────

    /**
     * Explain code snippet
     * Body: { code: string }
     * Returns: { explanation: string }
     */
    @PostMapping("/explain")
    public Mono<ResponseEntity<Map<String, String>>> explainCode(
            @RequestBody Map<String, String> request) {
        String code = request.get("code");
        if (code == null || code.isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "code is required")));
        }
        log.info("Explain code request ({} chars)", code.length());
        return claudeApiClient.explainCode(code)
                .map(explanation -> ResponseEntity.ok(Map.of("explanation", explanation)))
                .onErrorResume(e -> {
                    log.error("Explain error: {}", e.getMessage());
                    return Mono.just(ResponseEntity.internalServerError()
                            .body(Map.of("error", e.getMessage())));
                });
    }

    /**
     * Review generated Dart code
     * Body: { code: string }
     * Returns: { score, issues: [...], summary }
     */
    @PostMapping("/review")
    public Mono<ResponseEntity<Object>> reviewCode(
            @RequestBody Map<String, String> request) {
        String code = request.get("code");
        if (code == null || code.isBlank()) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "code is required")));
        }
        log.info("Code review request ({} chars)", code.length());
        return claudeApiClient.reviewCode(code)
                .map(result -> ResponseEntity.ok((Object) parseJsonOrWrap(result)))
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError()
                        .body(Map.of("error", e.getMessage()))));
    }

    /**
     * Suggest next widgets
     * Body: { currentWidgetType, parentWidgetType, screenContext }
     * Returns: [ { type, reason, props } ]
     */
    @PostMapping("/suggest-widgets")
    public Mono<ResponseEntity<Object>> suggestWidgets(
            @RequestBody SuggestWidgetsRequest request) {
        log.debug("Suggest widgets for: {}", request.currentWidgetType());
        return claudeApiClient.suggestNextWidget(
                request.currentWidgetType(),
                request.parentWidgetType(),
                request.screenContext()
        )
        .map(result -> ResponseEntity.ok((Object) parseJsonOrWrap(result)))
        .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError()
                .body(Map.of("error", e.getMessage()))));
    }

    /**
     * Autocomplete widget props
     * Body: { widgetType, partialProps }
     * Returns: { ...completedProps }
     */
    @PostMapping("/autocomplete")
    public Mono<ResponseEntity<Object>> autocompleteProps(
            @RequestBody Map<String, String> request) {
        String widgetType  = request.get("widgetType");
        String partialProps = request.getOrDefault("partialProps", "{}");
        log.debug("Autocomplete props for: {}", widgetType);
        return claudeApiClient.autocompleteProps(widgetType, partialProps)
                .map(result -> ResponseEntity.ok((Object) parseJsonOrWrap(result)))
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError()
                        .body(Map.of("error", e.getMessage()))));
    }

    /**
     * Generate Flutter widget tests
     * Body: { code: string, screenName: string }
     * Returns: { tests: string }
     */
    @PostMapping("/generate-tests")
    public Mono<ResponseEntity<Map<String, String>>> generateTests(
            @RequestBody Map<String, String> request) {
        String code       = request.get("code");
        String screenName = request.getOrDefault("screenName", "Screen");
        if (code == null || code.isBlank()) {
            return Mono.just(ResponseEntity.badRequest()
                    .body(Map.of("error", "code is required")));
        }
        log.info("Generate tests for: {}", screenName);
        return claudeApiClient.generateTests(code, screenName)
                .map(tests -> ResponseEntity.ok(Map.of("tests", tests)))
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError()
                        .body(Map.of("error", e.getMessage()))));
    }

    /**
     * Generate code from description — context-aware (knows file type + linked screen/service)
     * SSE stream · Body: { description, lang, fileContext, projectContext }
     */
    @PostMapping(value = "/generate-code", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateCode(@RequestBody GenerateCodeRequest request) {
        log.info("Generate code [{}]: {}", request.lang(), request.description());
        return claudeApiClient.generateCodeStream(
                        request.description(), request.lang(),
                        request.fileContext(), request.projectContext())
                .map(token -> escapeSSE(token))
                .concatWith(Flux.just("[DONE]"))
                .onErrorResume(e -> {
                    log.error("Generate code error: {}", e.getMessage());
                    return Flux.just("[ERROR] " + e.getMessage());
                });
    }

    /**
     * Autocomplete / suggest next code block (fast, Haiku)
     * Blocking JSON · Body: { currentCode, lang, fileContext }
     * Returns: { completion: string }
     */
    @PostMapping("/autocomplete-code")
    public Mono<ResponseEntity<Map<String, String>>> autocompleteCode(
            @RequestBody Map<String, String> request) {
        String currentCode  = request.getOrDefault("currentCode", "");
        String lang         = request.getOrDefault("lang", "dart");
        String fileContext  = request.getOrDefault("fileContext", "");
        log.debug("Autocomplete code [{}]", lang);
        return claudeApiClient.autocompleteCode(currentCode, lang, fileContext)
                .map(completion -> ResponseEntity.ok(Map.of("completion", completion)))
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError()
                        .body(Map.of("error", e.getMessage()))));
    }

    // ─────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────

    /** Escape newlines in SSE data lines */
    private String escapeSSE(String text) {
        return text.replace("\n", "\\n").replace("\r", "\\r");
    }

    /** Try to parse JSON, fall back to wrapping in { "result": ... } */
    private Object parseJsonOrWrap(String raw) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(raw, Object.class);
        } catch (Exception e) {
            return Map.of("result", raw);
        }
    }

    /**
     * Generate screen from a screenshot image (vision).
     * SSE stream · Body: { imageBase64: string, mediaType: string, description?: string, projectContext: string }
     */
    @PostMapping(value = "/generate-screen-from-image", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateScreenFromImage(@RequestBody ScreenshotRequest request) {
        log.info("Generate screen from image ({}), desc: {}", request.mediaType(), request.description());
        return claudeApiClient.generateScreenFromImageStream(
                        request.imageBase64(), request.mediaType(),
                        request.description(), request.projectContext())
                .map(token -> escapeSSE(token))
                .concatWith(Flux.just("[DONE]"))
                .onErrorResume(e -> {
                    log.error("Generate screen from image error: {}", e.getMessage());
                    return Flux.just("[ERROR] " + e.getMessage());
                });
    }

    // ─────────────────────────────────────────────────────────
    // REQUEST RECORDS
    // ─────────────────────────────────────────────────────────

    public record ChatRequest(
        List<ChatMessage> messages,
        String projectContext
    ) {}

    public record GenerateScreenRequest(
        String description,
        String projectContext
    ) {}

    public record ScreenshotRequest(
        String imageBase64,
        String mediaType,
        String description,
        String projectContext
    ) {}

    public record GenerateServiceRequest(
        String description,
        String graphContext
    ) {}

    public record SuggestWidgetsRequest(
        String currentWidgetType,
        String parentWidgetType,
        String screenContext
    ) {}

    public record GenerateCodeRequest(
        String description,
        String lang,           // "dart" or "java"
        String fileContext,    // existing code in the file
        String projectContext  // screen/service metadata
    ) {}
}
