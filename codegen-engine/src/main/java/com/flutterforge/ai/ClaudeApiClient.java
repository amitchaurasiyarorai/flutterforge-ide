package com.flutterforge.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;

/**
 * FlutterForge — Claude API Client
 *
 * Handles all communication with the Anthropic Claude API.
 * Supports both streaming (SSE) and blocking calls.
 *
 * Model routing:
 *   claude-sonnet-4-6  → screen gen, service scaffold, code review (quality tasks)
 *   claude-haiku-4-5   → autocomplete, widget hints, quick explain (latency tasks)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeApiClient {

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com";
    private static final String API_VERSION       = "2023-06-01";
    private static final String MODEL_QUALITY     = "claude-sonnet-4-6";
    private static final String MODEL_FAST        = "claude-haiku-4-5-20251001";
    private static final int    MAX_TOKENS        = 8192;
    private static final int    MAX_TOKENS_FAST   = 2048;

    @Value("${anthropic.api.key}")
    private String apiKey;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final PromptLibrary promptLibrary;

    // ────────────────────────────────────────────────────────
    // PUBLIC API — QUALITY (Sonnet)
    // ────────────────────────────────────────────────────────

    /**
     * Generate a Flutter screen widget tree from natural language description.
     * Streams tokens back via onToken callback for live IDE preview.
     *
     * @param description  "A login screen with email, password fields and a submit button"
     * @param projectContext  serialised relevant project state (current theme, existing screens)
     * @param onToken    callback fired for each streaming token
     * @return complete generated JSON string
     */
    public Mono<String> generateScreen(String description,
                                        String projectContext,
                                        Consumer<String> onToken) {
        String systemPrompt = promptLibrary.getScreenGenerationPrompt();
        String userMessage  = buildScreenGenMessage(description, projectContext);
        return streamCompletion(systemPrompt, userMessage, MODEL_QUALITY, MAX_TOKENS, onToken);
    }

    /**
     * Generate a complete microservice definition from natural language.
     *
     * @param description  "Auth service with JWT, refresh tokens, Google OAuth"
     * @param graphContext  existing service graph JSON (to avoid duplicates)
     * @param onToken  streaming callback
     */
    public Mono<String> generateMicroservice(String description,
                                              String graphContext,
                                              Consumer<String> onToken) {
        String systemPrompt = promptLibrary.getMicroserviceGenerationPrompt();
        String userMessage  = buildServiceGenMessage(description, graphContext);
        return streamCompletion(systemPrompt, userMessage, MODEL_QUALITY, MAX_TOKENS, onToken);
    }

    /**
     * Review generated Dart code for issues (null safety, lifecycle, perf).
     *
     * @param dartCode  generated Dart source
     * @return ReviewResult with issues and fixes
     */
    public Mono<String> reviewCode(String dartCode) {
        String systemPrompt = promptLibrary.getCodeReviewPrompt();
        String userMessage  = "Review this generated Flutter/Dart code:\n\n```dart\n" + dartCode + "\n```";
        return blockingCompletion(systemPrompt, userMessage, MODEL_QUALITY, MAX_TOKENS);
    }

    /**
     * Generate widget tests + integration tests for a screen.
     */
    public Mono<String> generateTests(String dartCode, String screenName) {
        String systemPrompt = promptLibrary.getTestGenerationPrompt();
        String userMessage  = "Generate Flutter widget tests for screen: " + screenName
                            + "\n\nSource:\n```dart\n" + dartCode + "\n```";
        return blockingCompletion(systemPrompt, userMessage, MODEL_QUALITY, MAX_TOKENS);
    }

    /**
     * Copilot chat — context-aware conversation with project knowledge.
     *
     * @param conversationHistory  full message history [{role, content}]
     * @param projectContext       current project state summary
     * @param onToken              streaming callback for live display
     */
    public Mono<String> chat(List<ChatMessage> conversationHistory,
                              String projectContext,
                              Consumer<String> onToken) {
        String systemPrompt = promptLibrary.getCopilotSystemPrompt(projectContext);
        return streamWithHistory(systemPrompt, conversationHistory, MODEL_QUALITY, MAX_TOKENS, onToken);
    }

    // ────────────────────────────────────────────────────────
    // PUBLIC API — FAST (Haiku)
    // ────────────────────────────────────────────────────────

    /**
     * Suggest next widget based on current canvas context.
     * Uses Haiku for low-latency response (<500ms target).
     *
     * @param currentWidgetType  type of widget being placed
     * @param parentWidgetType   parent container type
     * @param screenContext      brief screen description
     * @return list of suggested widget types
     */
    public Mono<String> suggestNextWidget(String currentWidgetType,
                                           String parentWidgetType,
                                           String screenContext) {
        String systemPrompt = promptLibrary.getWidgetSuggestionPrompt();
        String userMessage  = "Current: " + currentWidgetType
                            + "\nParent: " + parentWidgetType
                            + "\nScreen: " + screenContext
                            + "\nSuggest 5 next widgets as JSON array.";
        return blockingCompletion(systemPrompt, userMessage, MODEL_FAST, MAX_TOKENS_FAST);
    }

    /**
     * Explain a generated code block inline.
     */
    public Mono<String> explainCode(String codeSnippet) {
        String systemPrompt = "You are a Flutter expert. Explain code briefly in 2-3 sentences. Plain text, no markdown.";
        String userMessage  = "Explain: ```dart\n" + codeSnippet + "\n```";
        return blockingCompletion(systemPrompt, userMessage, MODEL_FAST, MAX_TOKENS_FAST);
    }

    /**
     * Autocomplete widget properties based on partial JSON.
     */
    public Mono<String> autocompleteProps(String widgetType, String partialProps) {
        String systemPrompt = promptLibrary.getPropAutocompletePrompt();
        String userMessage  = "Widget: " + widgetType
                            + "\nPartial props: " + partialProps
                            + "\nComplete the props JSON object.";
        return blockingCompletion(systemPrompt, userMessage, MODEL_FAST, MAX_TOKENS_FAST);
    }

    // ────────────────────────────────────────────────────────
    // CORE HTTP LAYER
    // ────────────────────────────────────────────────────────

    /**
     * Stream a completion — fires onToken for each text delta.
     * Returns Mono<String> of the complete response when done.
     */
    private Mono<String> streamCompletion(String systemPrompt,
                                           String userMessage,
                                           String model,
                                           int maxTokens,
                                           Consumer<String> onToken) {
        Map<String, Object> body = buildRequestBody(
                systemPrompt,
                List.of(Map.of("role", "user", "content", userMessage)),
                model, maxTokens, true
        );

        StringBuilder fullResponse = new StringBuilder();

        return webClient.post()
                .uri(ANTHROPIC_API_URL + "/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", API_VERSION)
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class).flatMap(err -> {
                            log.error("Claude API error {}: {}", response.statusCode(), err);
                            return Mono.error(new ClaudeApiException("Claude API error: " + err));
                        })
                )
                .bodyToFlux(String.class)
                .filter(line -> line.startsWith("data: ") && !line.equals("data: [DONE]"))
                .map(line -> line.substring(6))
                .flatMap(data -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> event = objectMapper.readValue(data, Map.class);
                        String type = (String) event.get("type");
                        if ("content_block_delta".equals(type)) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> delta = (Map<String, Object>) event.get("delta");
                            if (delta != null && "text_delta".equals(delta.get("type"))) {
                                String text = (String) delta.get("text");
                                if (text != null) {
                                    fullResponse.append(text);
                                    if (onToken != null) onToken.accept(text);
                                }
                            }
                        }
                        return Flux.empty();
                    } catch (Exception e) {
                        log.debug("Could not parse SSE event: {}", data);
                        return Flux.empty();
                    }
                })
                .then(Mono.fromCallable(fullResponse::toString))
                .timeout(Duration.ofSeconds(120))
                .doOnError(e -> log.error("Stream error: {}", e.getMessage()));
    }

    /**
     * Non-streaming completion — waits for full response.
     */
    private Mono<String> blockingCompletion(String systemPrompt,
                                             String userMessage,
                                             String model,
                                             int maxTokens) {
        Map<String, Object> body = buildRequestBody(
                systemPrompt,
                List.of(Map.of("role", "user", "content", userMessage)),
                model, maxTokens, false
        );

        return webClient.post()
                .uri(ANTHROPIC_API_URL + "/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", API_VERSION)
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class).flatMap(err ->
                                Mono.error(new ClaudeApiException("Claude API error: " + err)))
                )
                .bodyToMono(String.class)
                .flatMap(responseBody -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> parsed = objectMapper.readValue(responseBody, Map.class);
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> content = (List<Map<String, Object>>) parsed.get("content");
                        if (content != null && !content.isEmpty()) {
                            String text = (String) content.get(0).get("text");
                            return Mono.just(text != null ? text : "");
                        }
                        return Mono.just("");
                    } catch (Exception e) {
                        return Mono.error(new ClaudeApiException("Failed to parse Claude response: " + e.getMessage()));
                    }
                })
                .timeout(Duration.ofSeconds(60))
                .doOnError(e -> log.error("Blocking completion error: {}", e.getMessage()));
    }

    /**
     * Multi-turn chat with message history.
     */
    private Mono<String> streamWithHistory(String systemPrompt,
                                            List<ChatMessage> history,
                                            String model,
                                            int maxTokens,
                                            Consumer<String> onToken) {
        List<Map<String, Object>> messages = history.stream()
                .map(m -> Map.<String, Object>of("role", m.getRole(), "content", m.getContent()))
                .toList();

        Map<String, Object> body = buildRequestBody(systemPrompt, messages, model, maxTokens, true);

        StringBuilder fullResponse = new StringBuilder();

        return webClient.post()
                .uri(ANTHROPIC_API_URL + "/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", API_VERSION)
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .filter(line -> line.startsWith("data: ") && !line.equals("data: [DONE]"))
                .map(line -> line.substring(6))
                .flatMap(data -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> event = objectMapper.readValue(data, Map.class);
                        if ("content_block_delta".equals(event.get("type"))) {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> delta = (Map<String, Object>) event.get("delta");
                            if (delta != null) {
                                String text = (String) delta.get("text");
                                if (text != null) {
                                    fullResponse.append(text);
                                    if (onToken != null) onToken.accept(text);
                                }
                            }
                        }
                    } catch (Exception ignored) {}
                    return Flux.empty();
                })
                .then(Mono.fromCallable(fullResponse::toString))
                .timeout(Duration.ofSeconds(120));
    }

    // ────────────────────────────────────────────────────────
    // REQUEST BUILDERS
    // ────────────────────────────────────────────────────────

    private Map<String, Object> buildRequestBody(String systemPrompt,
                                                   List<Map<String, Object>> messages,
                                                   String model,
                                                   int maxTokens,
                                                   boolean stream) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("system", systemPrompt);
        body.put("messages", messages);
        if (stream) body.put("stream", true);
        return body;
    }

    private String buildScreenGenMessage(String description, String projectContext) {
        return """
               Generate a Flutter screen widget tree JSON for the following description:
               
               DESCRIPTION:
               %s
               
               PROJECT CONTEXT:
               %s
               
               Return ONLY valid JSON matching the ScreenDefinition schema. No markdown, no explanation.
               """.formatted(description, projectContext);
    }

    private String buildServiceGenMessage(String description, String graphContext) {
        return """
               Generate a Spring Boot microservice definition JSON for:
               
               DESCRIPTION:
               %s
               
               EXISTING SERVICES:
               %s
               
               Return ONLY valid JSON matching the MicroserviceDefinition schema. No markdown, no explanation.
               """.formatted(description, graphContext);
    }

    // ────────────────────────────────────────────────────────
    // VALUE OBJECTS
    // ────────────────────────────────────────────────────────

    public record ChatMessage(String role, String content) {
        public String getRole()    { return role; }
        public String getContent() { return content; }
    }

    public static class ClaudeApiException extends RuntimeException {
        public ClaudeApiException(String message) { super(message); }
    }
}
