package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProviderDefinition {
    private String id;
    private String name;
    private String type;
    private String stateType;
    private String initialValue;
    private Map<String, String> serviceBinding;
}
