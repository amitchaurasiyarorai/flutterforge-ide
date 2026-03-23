package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.Map;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FlutterForgeProject {
    private String id;
    private String name;
    private String packageName;
    private String version;
    private String description;
    private String initialRoute;
    private Map<String, ScreenDefinition> screens;
    private Map<String, ServiceDefinition> services;
    private Map<String, ProviderDefinition> stateProviders;
    private List<AssetDefinition> assets;
    private Map<String, String> dependencies;
    private AppTheme theme;
    private String createdAt;
    private String updatedAt;
    private ProjectMetadata metadata;

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AppTheme {
        private Map<String, Object> primaryColor;
        private Map<String, Object> secondaryColor;
        private boolean useMaterial3 = true;
        private String brightness = "system";
        private String fontFamily;
    }

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProjectMetadata {
        private List<String> targetPlatforms;
        private Integer minSdkVersion;
        private Integer targetSdkVersion;
    }
}
