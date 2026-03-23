package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScreenDefinition {
    private String id;
    private String name;
    private String route;
    private String title;
    private String rootWidgetId;
    private Map<String, WidgetNode> widgets;
    private List<String> stateProviders;
    private List<RouteGuard> guards;
    private String transitions;

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RouteGuard {
        private String type;
        private String redirectTo;
        private String role;
        private String customCondition;
    }
}
