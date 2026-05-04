package com.flutterforge.api;

import com.flutterforge.ai.ClaudeApiClient;
import com.flutterforge.codegen.FlutterForgeCodegenEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FlutterForgeController {

    private final FlutterForgeCodegenEngine codegenEngine;
    private final ClaudeApiClient claudeApiClient;

    // ── Health ───────────────────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "FlutterForge Codegen Engine"));
    }

    // ── Codegen endpoints ────────────────────────────────────

    @PostMapping("/codegen/flutter-app")
    public ResponseEntity<Map<String, Object>> generateFlutterApp(
            @RequestBody Map<String, String> request) {
        try {
            String payload   = request.get("payload");
            String outputDir = request.get("outputDir");
            var result = codegenEngine.generateFlutterApp(payload, Path.of(outputDir));
            return ResponseEntity.ok(Map.of(
                "success", true,
                "files",   result.getGeneratedFiles(),
                "project", result.getProjectName()
            ));
        } catch (Exception e) {
            log.error("Flutter app generation failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/codegen/microservice")
    public ResponseEntity<Map<String, Object>> generateMicroservice(
            @RequestBody Map<String, String> request) {
        try {
            String payload   = request.get("payload");
            String outputDir = request.get("outputDir");
            var result = codegenEngine.generateMicroservice(payload, Path.of(outputDir));
            return ResponseEntity.ok(Map.of(
                "success", true,
                "files",   result.getGeneratedFiles(),
                "project", result.getProjectName()
            ));
        } catch (Exception e) {
            log.error("Microservice generation failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/codegen/service-graph")
    public ResponseEntity<Map<String, Object>> generateServiceGraph(
            @RequestBody Map<String, String> request) {
        try {
            String payload   = request.get("payload");
            String outputDir = request.get("outputDir");
            var result = codegenEngine.generateServiceGraph(payload, Path.of(outputDir));
            return ResponseEntity.ok(Map.of(
                "success", true,
                "files",   result.getGeneratedFiles()
            ));
        } catch (Exception e) {
            log.error("Service graph generation failed", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }
/*
    // ── AI endpoints ─────────────────────────────────────────

    @PostMapping(value = "/ai/generate-screen", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateScreen(@RequestBody Map<String, String> request) {
        String description    = request.get("description");
        String projectContext = request.getOrDefault("projectContext", "{}");
        return Flux.create(sink ->
            claudeApiClient.generateScreen(description, projectContext, sink::next)
                .doOnSuccess(full -> sink.complete())
                .doOnError(sink::error)
                .subscribe()
        );
    }

    @PostMapping(value = "/ai/generate-service", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> generateService(@RequestBody Map<String, String> request) {
        String description  = request.get("description");
        String graphContext = request.getOrDefault("graphContext", "{}");
        return Flux.create(sink ->
            claudeApiClient.generateMicroservice(description, graphContext, sink::next)
                .doOnSuccess(full -> sink.complete())
                .doOnError(sink::error)
                .subscribe()
        );
    }

    @PostMapping(value = "/ai/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<Map<String, String>> rawMessages =
                (List<Map<String, String>>) request.get("messages");
        String projectContext = (String) request.getOrDefault("projectContext", "");

        List<ClaudeApiClient.ChatMessage> messages = rawMessages.stream()
                .map(m -> new ClaudeApiClient.ChatMessage(m.get("role"), m.get("content")))
                .toList();

        return Flux.create(sink ->
            claudeApiClient.chat(messages, projectContext, sink::next)
                .doOnSuccess(full -> sink.complete())
                .doOnError(sink::error)
                .subscribe()
        );
    }

    @PostMapping("/ai/explain")
    public Mono<ResponseEntity<Map<String, String>>> explainCode(
            @RequestBody Map<String, String> request) {
        String code = request.get("code");
        return claudeApiClient.explainCode(code)
                .map(explanation -> ResponseEntity.ok(Map.of("explanation", explanation)))
                .onErrorReturn(ResponseEntity.internalServerError()
                        .body(Map.of("explanation", "Failed to explain code")));
    }

    @PostMapping("/ai/review")
    public Mono<ResponseEntity<String>> reviewCode(
            @RequestBody Map<String, String> request) {
        String code = request.get("code");
        return claudeApiClient.reviewCode(code)
                .map(review -> ResponseEntity.ok(review))
                .onErrorReturn(ResponseEntity.internalServerError().body("{}"));
    }

    @PostMapping("/ai/suggest-widget")
    public Mono<ResponseEntity<String>> suggestWidget(
            @RequestBody Map<String, String> request) {
        return claudeApiClient.suggestNextWidget(
                request.get("currentWidgetType"),
                request.get("parentWidgetType"),
                request.getOrDefault("screenContext", ""))
                .map(ResponseEntity::ok)
                .onErrorReturn(ResponseEntity.internalServerError().body("[]"));
    }

 */
}
