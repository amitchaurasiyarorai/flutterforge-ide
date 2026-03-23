package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ServiceDefinition {
    private String id;
    private String name;
    private String baseUrl;
    private List<ServiceOperation> operations;
    private String auth;
    private Integer timeout;

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ServiceOperation {
        private String id;
        private String name;
        private String method;
        private String path;
        private List<Map<String, Object>> pathParams;
        private List<Map<String, Object>> queryParams;
        private Map<String, Object> requestBody;
        private Map<String, Object> responseSchema;
        private Boolean requiresAuth;
    }
}
