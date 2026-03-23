package com.flutterforge.codegen.dart;

import com.flutterforge.model.ServiceDefinition;
import org.springframework.stereotype.Component;
import java.util.Collection;

/**
 * Generates typed Dart Dio API clients from ServiceDefinition.
 * Full implementation in Session 2.
 */
@Component
public class DartApiClientCodegen {

    public String generateClient(ServiceDefinition service) {
        return """
               import 'package:dio/dio.dart';

               // TODO: Generated API client for %s
               // Full implementation coming in Session 2
               class %sClient {
                 final Dio _dio;
                 %sClient(this._dio);
               }
               """.formatted(service.getName(), service.getName(), service.getName());
    }

    public String generateModels(ServiceDefinition service) {
        return "// TODO: Generated models for " + service.getName() + " — Session 2\n";
    }

    public String generateBarrel(Collection<ServiceDefinition> services) {
        StringBuilder sb = new StringBuilder("// Auto-generated services barrel\n");
        services.forEach(s ->
            sb.append("export '").append(toSnakeCase(s.getName())).append("_client.dart';\n")
        );
        return sb.toString();
    }

    private String toSnakeCase(String input) {
        return input.replaceAll("([A-Z])", "_$1").toLowerCase().replaceAll("^_", "");
    }
}
