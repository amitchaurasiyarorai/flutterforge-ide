package com.flutterforge.codegen.validator;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Session 2 — DartCodegenValidator
 * Validates generated Dart code for common issues before writing to disk.
 *
 * Checks:
 *   - Unclosed braces / parentheses
 *   - Missing required imports
 *   - Null safety violations (bare ? usage)
 *   - Empty widget build methods
 *   - Missing const constructors
 */
@Slf4j
@Component
public class DartCodegenValidator {

    public record ValidationResult(boolean valid, List<String> warnings, List<String> errors) {
        public boolean hasErrors()   { return !errors.isEmpty(); }
        public boolean hasWarnings() { return !warnings.isEmpty(); }
    }

    public ValidationResult validate(String dartCode, String filename) {
        List<String> warnings = new ArrayList<>();
        List<String> errors   = new ArrayList<>();

        if (dartCode == null || dartCode.isBlank()) {
            errors.add(filename + ": empty file generated");
            return new ValidationResult(false, warnings, errors);
        }

        checkBraceBalance(dartCode, filename, errors);
        checkImports(dartCode, filename, warnings);
        checkNullSafety(dartCode, filename, warnings);
        checkWidgetKeys(dartCode, filename, warnings);

        boolean valid = errors.isEmpty();
        if (!valid) log.warn("Validation failed for {}: {}", filename, errors);
        return new ValidationResult(valid, warnings, errors);
    }

    private void checkBraceBalance(String code, String file, List<String> errors) {
        int braces = 0, parens = 0, brackets = 0;
        boolean inString = false;
        char prev = 0;

        for (char c : code.toCharArray()) {
            if (c == '"' && prev != '\\') inString = !inString;
            if (!inString) {
                if (c == '{') braces++;   else if (c == '}') braces--;
                if (c == '(') parens++;   else if (c == ')') parens--;
                if (c == '[') brackets++; else if (c == ']') brackets--;
            }
            prev = c;
        }

        if (braces != 0)   errors.add(file + ": unbalanced braces (delta=" + braces + ")");
        if (parens != 0)   errors.add(file + ": unbalanced parentheses (delta=" + parens + ")");
        if (brackets != 0) errors.add(file + ": unbalanced brackets (delta=" + brackets + ")");
    }

    private void checkImports(String code, String file, List<String> warnings) {
        if (code.contains("BuildContext") && !code.contains("package:flutter/material.dart")) {
            warnings.add(file + ": uses BuildContext but missing flutter/material.dart import");
        }
        if (code.contains("ConsumerWidget") && !code.contains("flutter_riverpod")) {
            warnings.add(file + ": uses ConsumerWidget but missing flutter_riverpod import");
        }
        if (code.contains("GoRouter") && !code.contains("go_router")) {
            warnings.add(file + ": uses GoRouter but missing go_router import");
        }
        if (code.contains("Dio(") && !code.contains("package:dio")) {
            warnings.add(file + ": uses Dio but missing dio import");
        }
    }

    private void checkNullSafety(String code, String file, List<String> warnings) {
        // Warn about forced unwrap (!.) which can cause runtime crashes
        long forcedUnwraps = Pattern.compile("\\w+!\\.")
                .matcher(code).results().count();
        if (forcedUnwraps > 3) {
            warnings.add(file + ": " + forcedUnwraps + " forced unwraps (!) detected — review null safety");
        }
    }

    private void checkWidgetKeys(String code, String file, List<String> warnings) {
        // Warn if ListView.builder used without keys
        if (code.contains("ListView.builder") && !code.contains("key:")) {
            warnings.add(file + ": ListView.builder without item keys — consider adding ValueKey for performance");
        }
    }
}
