package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MicroserviceDefinition {
    private String id;
    private String name;
    private String artifactId;
    private String groupId;
    private String version;
    private String description;
    private Integer port;
    private List<String> springProfiles;
    private String javaVersion;
    private String springBootVersion;
    private String apiBasePath;
    private List<Map<String, Object>> endpoints;
    private List<Map<String, Object>> schemas;
    private Map<String, Object> security;
    private Map<String, Object> database;
    private List<Map<String, Object>> kafkaTopics;
    private String kafkaGroupId;
    private List<Map<String, Object>> dependencies;
    private InfraDefinition infra;
    private Map<String, Object> metadata;

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InfraDefinition {
        private DockerDefinition docker;
        private Map<String, Object> kubernetes;
        private Map<String, Object> cicd;

        @Data @JsonIgnoreProperties(ignoreUnknown = true)
        public static class DockerDefinition {
            private String baseImage;
            private Integer exposedPort;
            private String healthCheckPath;
            private List<Map<String, String>> envVars;
            private Map<String, String> labels;
        }
    }
}
