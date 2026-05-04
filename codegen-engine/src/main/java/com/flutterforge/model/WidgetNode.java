package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class WidgetNode {
    private String id;
    private String type;
    private String name;
    private Map<String, Object> props;
    private List<String> children;
    private Map<String, Object> geometry;
    private Map<String, Object> stateBinding;
    private Map<String, Object> serviceBinding;
    private Map<String, Object> apiBinding;   // { interfaceId, fieldPath, targetProp, format, formatArg, isListBinding, arrayPath }
    private WidgetEvents events;
    private String conditionalRender;
    private String repeatFor;
    private Map<String, Object> metadata;

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WidgetEvents {
        // Legacy flat format: onTap: { route: "/login" }
        private Object onTap;
        private Object onChanged;
        private Object onSubmitted;
        private Object onLongPress;
        // Current format: handlers: [{ event: "onPressed", actions: [{type,route,...}] }]
        private List<Map<String, Object>> handlers;

        /** Returns the first action for the given event name, or null. */
        public Map<String, Object> firstActionFor(String eventName) {
            if (handlers == null) return null;
            for (Map<String, Object> h : handlers) {
                if (eventName.equals(h.get("event"))) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> actions =
                        (List<Map<String, Object>>) h.get("actions");
                    if (actions != null && !actions.isEmpty()) return actions.get(0);
                }
            }
            return null;
        }

        /** Returns all actions for the given event name. */
        public List<Map<String, Object>> actionsFor(String eventName) {
            if (handlers == null) return List.of();
            for (Map<String, Object> h : handlers) {
                if (eventName.equals(h.get("event"))) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> actions =
                        (List<Map<String, Object>>) h.get("actions");
                    return actions != null ? actions : List.of();
                }
            }
            return List.of();
        }
    }
}
