package com.flutterforge.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ServiceGraphDefinition {
    private String id;
    private String projectId;
    private String name;
    private Map<String, Object> gateway;
    private Map<String, MicroserviceDefinition> services;
    private Map<String, Object> kafka;
    private String createdAt;
    private String updatedAt;
}
