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
    private WidgetEvents events;
    private String conditionalRender;
    private String repeatFor;
    private Map<String, Object> metadata;

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WidgetEvents {
        private Object onTap;
        private Object onChanged;
        private Object onSubmitted;
        private Object onLongPress;
    }
}
