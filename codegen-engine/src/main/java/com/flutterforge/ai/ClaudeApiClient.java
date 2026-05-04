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
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClaudeApiClient {

    private static final String API_URL      = "https://api.anthropic.com/v1/messages";
    private static final String API_VERSION  = "2023-06-01";
    private static final String MODEL_SONNET = "claude-sonnet-4-6";
    private static final String MODEL_HAIKU  = "claude-haiku-4-5-20251001";

    @Value("${anthropic.api.key}")
    private String apiKey;

    private final WebClient    webClient;
    private final ObjectMapper objectMapper;
    private final PromptLibrary promptLibrary;

    // ─────────────────────────────────────────────────────
    // PUBLIC STREAMING API
    // These return Flux<String> — each emitted String is one
    // text token from Claude, to be forwarded as SSE to client.
    // ─────────────────────────────────────────────────────

    public Flux<String> chatStream(List<ChatMessage> history, String ctx) {
        String system  = promptLibrary.getCopilotSystemPrompt(ctx);
        List<Map<String, Object>> msgs = cleanMessages(toMsgList(history));
        return streamFlux(system, msgs, MODEL_SONNET, 4096);
    }

    public Flux<String> generateScreenStream(String description, String ctx) {
        return streamFlux(
            promptLibrary.getScreenGenerationPrompt(),
            List.of(msg("user", "Generate screen for: " + description + "\n\nProject:\n" + ctx)),
            MODEL_SONNET, 8192
        );
    }

    /**
     * Vision: generate a Flutter screen widget tree from a screenshot image.
     * The image is passed as base64 + mediaType alongside an optional text prompt.
     */
    public Flux<String> generateScreenFromImageStream(
            String base64Image, String mediaType, String description, String ctx) {
        // Build a multimodal message: image block + text block
        Map<String, Object> imageSource = new LinkedHashMap<>();
        imageSource.put("type",       "base64");
        imageSource.put("media_type", mediaType);
        imageSource.put("data",       base64Image);

        Map<String, Object> imageBlock = new LinkedHashMap<>();
        imageBlock.put("type",   "image");
        imageBlock.put("source", imageSource);

        String textPrompt = "Analyse this UI screenshot and generate a Flutter widget tree that recreates it.\n"
                + (description != null && !description.isBlank() ? "Additional instructions: " + description + "\n" : "")
                + "\nProject context:\n" + ctx;

        Map<String, Object> textBlock = new LinkedHashMap<>();
        textBlock.put("type", "text");
        textBlock.put("text", textPrompt);

        Map<String, Object> userMsg = new LinkedHashMap<>();
        userMsg.put("role",    "user");
        userMsg.put("content", List.of(imageBlock, textBlock));

        return streamFlux(
            promptLibrary.getScreenGenerationPrompt(),
            List.of(userMsg),
            MODEL_SONNET, 8192
        );
    }

    public Flux<String> generateMicroserviceStream(String description, String ctx) {
        return streamFlux(
            promptLibrary.getMicroserviceGenerationPrompt(),
            List.of(msg("user", "Generate microservice: " + description + "\n\nExisting:\n" + ctx)),
            MODEL_SONNET, 8192
        );
    }

    public Flux<String> generateCodeStream(String description, String lang,
                                            String fileContext, String projectContext) {
        String system = promptLibrary.getCodeGenerationPrompt(lang);
        String user   = """
                Generate %s code for the following request:

                REQUEST:
                %s

                EXISTING FILE CONTEXT (do not repeat, only add new code):
                ```%s
                %s
                ```

                PROJECT CONTEXT:
                %s

                Return ONLY the new code to add. No explanations. No markdown fences.
                """.formatted(lang, description, lang, fileContext, projectContext);
        return streamFlux(system, List.of(msg("user", user)), MODEL_SONNET, 4096);
    }

    // ─────────────────────────────────────────────────────
    // PUBLIC BLOCKING API
    // ─────────────────────────────────────────────────────

    public Mono<String> reviewCode(String code) {
        return blocking(promptLibrary.getCodeReviewPrompt(),
                "Review this code:\n```\n" + code + "\n```",
                MODEL_SONNET, 4096);
    }

    public Mono<String> generateTests(String code, String screenName) {
        return blocking(promptLibrary.getTestGenerationPrompt(),
                "Generate tests for " + screenName + ":\n```\n" + code + "\n```",
                MODEL_SONNET, 4096);
    }

    public Mono<String> explainCode(String code) {
        return blocking(
                "You are a Flutter/Dart expert. Explain code in 2-3 plain sentences. No markdown.",
                "Explain:\n```\n" + code + "\n```",
                MODEL_HAIKU, 512);
    }

    public Mono<String> suggestNextWidget(String current, String parent, String screen) {
        return blocking(promptLibrary.getWidgetSuggestionPrompt(),
                "Current: " + current + "\nParent: " + parent + "\nScreen: " + screen,
                MODEL_HAIKU, 1024);
    }

    public Mono<String> autocompleteProps(String widgetType, String partial) {
        return blocking(promptLibrary.getPropAutocompletePrompt(),
                "Widget: " + widgetType + "\nPartial: " + partial,
                MODEL_HAIKU, 512);
    }

    public Mono<String> autocompleteCode(String currentCode, String lang, String fileContext) {
        String system = promptLibrary.getCodeAutocompletePrompt(lang);
        String user   = """
                Complete the following %s code. Continue from where it ends.
                FILE PURPOSE: %s
                CODE:
                ```%s
                %s
                ```
                Return ONLY the completion. No explanations. No markdown fences.
                """.formatted(lang, fileContext, lang, currentCode);
        return blocking(system, user, MODEL_HAIKU, 1024);
    }

    // ─────────────────────────────────────────────────────
    // LEGACY: keep Consumer-based signatures for any callers
    // that haven't been updated yet — they just subscribe.
    // ─────────────────────────────────────────────────────

    public Mono<String> chat(List<ChatMessage> history, String ctx, Consumer<String> onToken) {
        StringBuilder full = new StringBuilder();
        return chatStream(history, ctx)
                .doOnNext(token -> { full.append(token); if (onToken != null) onToken.accept(token); })
                .then(Mono.fromCallable(full::toString));
    }

    public Mono<String> generateScreen(String description, String ctx, Consumer<String> onToken) {
        StringBuilder full = new StringBuilder();
        return generateScreenStream(description, ctx)
                .doOnNext(token -> { full.append(token); if (onToken != null) onToken.accept(token); })
                .then(Mono.fromCallable(full::toString));
    }

    public Mono<String> generateMicroservice(String description, String ctx, Consumer<String> onToken) {
        StringBuilder full = new StringBuilder();
        return generateMicroserviceStream(description, ctx)
                .doOnNext(token -> { full.append(token); if (onToken != null) onToken.accept(token); })
                .then(Mono.fromCallable(full::toString));
    }

    public Mono<String> generateCode(String description, String lang,
                                      String fileContext, String projectContext,
                                      Consumer<String> onToken) {
        StringBuilder full = new StringBuilder();
        return generateCodeStream(description, lang, fileContext, projectContext)
                .doOnNext(token -> { full.append(token); if (onToken != null) onToken.accept(token); })
                .then(Mono.fromCallable(full::toString));
    }

    // ─────────────────────────────────────────────────────
    // CORE: REACTIVE STREAMING — returns Flux<String>
    // Each emission is one text token from Claude.
    // This is the FIXED version — no Consumer callback,
    // pure reactive chain so Spring can flush tokens immediately.
    // ─────────────────────────────────────────────────────

    private Flux<String> streamFlux(String system,
                                     List<Map<String, Object>> messages,
                                     String model, int maxTokens) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("system",     system);
        body.put("messages",   messages);
        body.put("stream",     true);

        log.debug("Streaming request: model={} messages={}", model, messages.size());

        return webClient.post()
                .uri(API_URL)
                .header("x-api-key",         apiKey)
                .header("anthropic-version", API_VERSION)
                .header("Content-Type",      "application/json")
                .header("Accept",            "text/event-stream")
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class).flatMap(err -> {
                            log.error("Claude API {} error: {}", response.statusCode(), err);
                            return Mono.error(new ClaudeApiException("Claude error: " + err));
                        })
                )
                .bodyToFlux(String.class)
                // bodyToFlux(String.class) already strips SSE framing ("data: " prefix)
                // Each emitted string is the raw JSON event from Anthropic
                // We just need to filter out non-content events and parse the JSON
                .map(String::trim)
                .filter(data -> !data.isEmpty() && data.startsWith("{"))
                // Parse each SSE event and emit ONLY the text tokens
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
                                if (text != null && !text.isEmpty()) {
                                    return Flux.just(text);   // ← EMIT token to caller
                                }
                            }
                        }
                        return Flux.empty();   // skip non-text events
                    } catch (Exception e) {
                        log.debug("SSE parse skip: {}", e.getMessage());
                        return Flux.empty();
                    }
                })
                .timeout(Duration.ofSeconds(120))
                .doOnError(e -> log.error("Stream error: {}", e.getMessage()));
    }

    // ─────────────────────────────────────────────────────
    // BLOCKING
    // ─────────────────────────────────────────────────────

    private Mono<String> blocking(String system, String userMessage,
                                   String model, int maxTokens) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model",      model);
        body.put("max_tokens", maxTokens);
        body.put("system",     system);
        body.put("messages",   List.of(msg("user", userMessage)));

        log.debug("Blocking request: model={}", model);

        return webClient.post()
                .uri(API_URL)
                .header("x-api-key",         apiKey)
                .header("anthropic-version", API_VERSION)
                .header("Content-Type",      "application/json")
                .bodyValue(body)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                        response.bodyToMono(String.class).flatMap(err -> {
                            log.error("Claude API {} error: {}", response.statusCode(), err);
                            return Mono.error(new ClaudeApiException("Claude error: " + err));
                        })
                )
                .bodyToMono(String.class)
                .flatMap(raw -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> parsed = objectMapper.readValue(raw, Map.class);
                        @SuppressWarnings("unchecked")
                        List<Map<String, Object>> content =
                                (List<Map<String, Object>>) parsed.get("content");
                        if (content != null && !content.isEmpty()) {
                            Object text = content.get(0).get("text");
                            return Mono.just(text != null ? text.toString() : "");
                        }
                        return Mono.just("");
                    } catch (Exception e) {
                        return Mono.error(new ClaudeApiException("Parse error: " + e.getMessage()));
                    }
                })
                .timeout(Duration.ofSeconds(60))
                .doOnError(e -> log.error("Blocking error: {}", e.getMessage()));
    }

    // ─────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────

    private static Map<String, Object> msg(String role, String content) {
        return Map.of("role", role, "content", content);
    }

    private static List<Map<String, Object>> toMsgList(List<ChatMessage> history) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ChatMessage m : history) result.add(msg(m.getRole(), m.getContent()));
        return result;
    }

    private static List<Map<String, Object>> cleanMessages(List<Map<String, Object>> messages) {
        List<Map<String, Object>> result = new ArrayList<>();
        String lastRole = null;
        for (Map<String, Object> m : messages) {
            String role = (String) m.get("role");
            if (role == null) continue;
            if (role.equals(lastRole)) {
                if (!result.isEmpty()) {
                    Map<String, Object> prev = result.get(result.size() - 1);
                    String merged = prev.get("content") + "\n" + m.get("content");
                    result.set(result.size() - 1, msg(role, merged));
                }
            } else {
                result.add(m);
                lastRole = role;
            }
        }
        if (!result.isEmpty() && !"user".equals(result.get(0).get("role"))) result.remove(0);
        if (result.isEmpty()) result.add(msg("user", "Hello"));
        return result;
    }

    // ─────────────────────────────────────────────────────
    // VALUE OBJECTS
    // ─────────────────────────────────────────────────────

    public static class ChatMessage {
        private String role;
        private String content;
        public ChatMessage() {}
        public ChatMessage(String role, String content) { this.role = role; this.content = content; }
        public String getRole()    { return role; }
        public String getContent() { return content; }
        public void setRole(String role)       { this.role = role; }
        public void setContent(String content) { this.content = content; }
    }

    public static class ClaudeApiException extends RuntimeException {
        public ClaudeApiException(String message) { super(message); }
    }
}
