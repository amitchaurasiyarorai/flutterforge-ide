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

    @Data
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class AppTheme {
        // -- Seed colors --------------------------------------
        private Map<String, Object> primaryColor;
        private Map<String, Object> secondaryColor;
        private Map<String, Object> tertiaryColor;
        private Map<String, Object> errorColor;
        private Map<String, Object> backgroundColor;
        private Map<String, Object> surfaceColor;
        private Map<String, Object> onPrimaryColor;
        private Map<String, Object> onSecondaryColor;
        private Map<String, Object> onBackgroundColor;
        private Map<String, Object> onSurfaceColor;
        private Map<String, Object> onErrorColor;

        // -- Typography ----------------------------------------
        private String  fontFamily      = "Roboto";
        private Integer displayFontSize  = 57;
        private Integer headlineFontSize = 32;
        private Integer titleFontSize    = 22;
        private Integer bodyFontSize     = 14;
        private Integer labelFontSize    = 12;
        private Integer fontWeightBold   = 700;
        private Integer fontWeightNormal = 400;

        // -- Shape ---------------------------------------------
        private Integer borderRadiusSmall  = 8;
        private Integer borderRadiusMedium = 12;
        private Integer borderRadiusLarge  = 28;
        private Integer borderRadiusFull   = 50;

        // -- Components ----------------------------------------
        private Integer appBarElevation  = 0;
        private Integer cardElevation    = 2;
        private Integer buttonHeight     = 48;
        private String  inputBorderStyle = "outline";

        // -- Mode ----------------------------------------------
        private boolean useMaterial3 = true;
        private String  brightness   = "system";
    }

    @Data @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProjectMetadata {
        private List<String> targetPlatforms;
        private Integer minSdkVersion;
        private Integer targetSdkVersion;
    }
}
