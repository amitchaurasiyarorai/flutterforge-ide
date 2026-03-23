package com.flutterforge.model;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class GenerationResult {
    private String projectId;
    private String projectName;
    private List<String> generatedFiles = new ArrayList<>();
    private List<String> warnings       = new ArrayList<>();
    private List<String> errors         = new ArrayList<>();

    public void addWarning(String warning) { warnings.add(warning); }
    public void addError(String error)     { errors.add(error); }
    public boolean hasErrors()             { return !errors.isEmpty(); }
}
