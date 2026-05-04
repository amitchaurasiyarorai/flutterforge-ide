package com.flutterforge.codegen.dart;

import com.flutterforge.model.ServiceDefinition;
import com.flutterforge.model.ServiceDefinition.ServiceOperation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Collection;
import java.util.List;

/**
 * Session 2 — DartApiClientCodegen
 * Generates typed Dart Dio API clients + model classes from ServiceDefinition.
 *
 * Output per service:
 *   {service_name}_client.dart  — Dio HTTP client with typed methods
 *   {service_name}_models.dart  — Request/Response model classes
 *   services.dart               — Barrel export
 */
@Slf4j
@Component
public class DartApiClientCodegen {

    public String generateClient(ServiceDefinition service) {
        log.debug("Generating API client for: {}", service.getName());
        String className = capitalize(service.getName()) + "Client";
        StringBuilder sb = new StringBuilder();

        sb.append("import 'package:dio/dio.dart';\n");
        sb.append("import 'package:flutter_riverpod/flutter_riverpod.dart';\n");
        sb.append("import '").append(toSnakeCase(service.getName())).append("_models.dart';\n\n");

        // Provider for DI
        sb.append("/// Riverpod provider for [").append(className).append("]\n");
        sb.append("final ").append(lcFirst(service.getName())).append("ClientProvider");
        sb.append(" = Provider<").append(className).append(">((ref) {\n");
        sb.append("  return ").append(className).append("(\n");
        sb.append("    Dio(BaseOptions(baseUrl: '").append(service.getBaseUrl() != null ? service.getBaseUrl() : "http://localhost:8080").append("')),\n");
        sb.append("  );\n});\n\n");

        // Client class
        sb.append("/// [").append(className).append("] — auto-generated API client\n");
        sb.append("class ").append(className).append(" {\n");
        sb.append("  final Dio _dio;\n\n");
        sb.append("  ").append(className).append("(this._dio) {\n");
        sb.append("    _dio.interceptors.add(LogInterceptor(responseBody: true));\n");
        sb.append("  }\n\n");

        // Generate method per operation
        if (service.getOperations() != null) {
            for (ServiceOperation op : service.getOperations()) {
                sb.append(generateOperation(op));
            }
        }

        sb.append("}\n");
        return sb.toString();
    }

    public String generateModels(ServiceDefinition service) {
        log.debug("Generating models for: {}", service.getName());
        StringBuilder sb = new StringBuilder();
        sb.append("import 'package:json_annotation/json_annotation.dart';\n\n");
        sb.append("part '").append(toSnakeCase(service.getName())).append("_models.g.dart';\n\n");

        // Generate model per operation response/request
        if (service.getOperations() != null) {
            for (ServiceOperation op : service.getOperations()) {
                String modelName = capitalize(op.getName()) + "Response";
                sb.append("@JsonSerializable()\n");
                sb.append("class ").append(modelName).append(" {\n");
                sb.append("  // TODO: add typed fields from OpenAPI schema\n");
                sb.append("  final Map<String, dynamic> data;\n\n");
                sb.append("  const ").append(modelName).append("({required this.data});\n\n");
                sb.append("  factory ").append(modelName).append(".fromJson(Map<String, dynamic> json) =>\n");
                sb.append("      _$").append(modelName).append("FromJson(json);\n\n");
                sb.append("  Map<String, dynamic> toJson() => _$").append(modelName).append("ToJson(this);\n}\n\n");
            }
        }

        // Generic API response wrapper
        sb.append("/// Generic paginated list response\n");
        sb.append("@JsonSerializable(genericArgumentFactories: true)\n");
        sb.append("class PagedResponse<T> {\n");
        sb.append("  final List<T> content;\n");
        sb.append("  final int totalElements;\n");
        sb.append("  final int totalPages;\n");
        sb.append("  final int page;\n");
        sb.append("  final int size;\n\n");
        sb.append("  const PagedResponse({\n");
        sb.append("    required this.content,\n");
        sb.append("    required this.totalElements,\n");
        sb.append("    required this.totalPages,\n");
        sb.append("    required this.page,\n");
        sb.append("    required this.size,\n");
        sb.append("  });\n\n");
        sb.append("  factory PagedResponse.fromJson(\n");
        sb.append("    Map<String, dynamic> json,\n");
        sb.append("    T Function(Object? json) fromJsonT,\n");
        sb.append("  ) => _$PagedResponseFromJson(json, fromJsonT);\n}\n");

        return sb.toString();
    }

    public String generateBarrel(Collection<ServiceDefinition> services) {
        StringBuilder sb = new StringBuilder("// Auto-generated services barrel\n\n");
        services.forEach(s -> {
            sb.append("export '").append(toSnakeCase(s.getName())).append("_client.dart';\n");
            sb.append("export '").append(toSnakeCase(s.getName())).append("_models.dart';\n");
        });
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────
    // OPERATION GENERATOR
    // ─────────────────────────────────────────────────────────

    private String generateOperation(ServiceOperation op) {
        if (op == null || op.getName() == null) return "";
        StringBuilder sb  = new StringBuilder();
        String method     = op.getMethod() != null ? op.getMethod().toLowerCase() : "get";
        String path       = op.getPath() != null ? op.getPath() : "/";
        String returnType = capitalize(op.getName()) + "Response";
        boolean hasBody   = "post".equals(method) || "put".equals(method) || "patch".equals(method);

        // Method signature
        sb.append("  /// ").append(op.getMethod() != null ? op.getMethod() : "GET").append(" ").append(path).append("\n");
        sb.append("  Future<").append(returnType).append("> ").append(op.getName()).append("({\n");

        // Path params
        if (op.getPathParams() != null) {
            for (var param : op.getPathParams()) {
                String pName = param.get("name") != null ? param.get("name").toString() : "id";
                String pType = dartType(param.get("type") != null ? param.get("type").toString() : "String");
                sb.append("    required ").append(pType).append(" ").append(pName).append(",\n");
            }
        }

        // Query params
        if (op.getQueryParams() != null) {
            for (var param : op.getQueryParams()) {
                String pName = param.get("name") != null ? param.get("name").toString() : "param";
                String pType = dartType(param.get("type") != null ? param.get("type").toString() : "String");
                boolean required = Boolean.TRUE.equals(param.get("required"));
                if (required) sb.append("    required ").append(pType).append(" ").append(pName).append(",\n");
                else          sb.append("    ").append(pType).append("? ").append(pName).append(",\n");
            }
        }

        if (hasBody) sb.append("    required Map<String, dynamic> body,\n");
        sb.append("  }) async {\n");

        // Build path with interpolation
        String dartPath = path.replaceAll("\\{(\\w+)\\}", "\\$$1");
        sb.append("    final response = await _dio.").append(method).append("(\n");
        sb.append("      '").append(dartPath).append("',\n");
        if (hasBody) sb.append("      data: body,\n");

        // Query params map
        if (op.getQueryParams() != null && !op.getQueryParams().isEmpty()) {
            sb.append("      queryParameters: {\n");
            for (var param : op.getQueryParams()) {
                String pName = param.get("name") != null ? param.get("name").toString() : "param";
                sb.append("        if (").append(pName).append(" != null) '").append(pName).append("': ").append(pName).append(",\n");
            }
            sb.append("      },\n");
        }

        sb.append("    );\n");
        sb.append("    return ").append(returnType).append(".fromJson(\n");
        sb.append("      response.data as Map<String, dynamic>,\n");
        sb.append("    );\n");
        sb.append("  }\n\n");
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────

    private String dartType(String javaType) {
        if (javaType == null) return "dynamic";
        return switch (javaType) {
            case "String"        -> "String";
            case "Integer","int" -> "int";
            case "Long","long"   -> "int";
            case "Double","double","Float","float" -> "double";
            case "Boolean","bool" -> "bool";
            case "UUID"          -> "String";
            case "LocalDate","LocalDateTime" -> "DateTime";
            case "BigDecimal"    -> "double";
            default -> javaType;
        };
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String lcFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toLowerCase(s.charAt(0)) + s.substring(1);
    }

    private String toSnakeCase(String input) {
        if (input == null || input.isBlank()) return input;
        return input.replaceAll("([A-Z]+)([A-Z][a-z])","$1_$2")
                .replaceAll("([a-z0-9])([A-Z])","$1_$2").toLowerCase()
                .replaceAll("[^a-z0-9_]","_").replaceAll("_+","_").replaceAll("^_|_$","");
    }
}
