package com.flutterforge.codegen.dart;

import com.flutterforge.model.ProviderDefinition;
import org.springframework.stereotype.Component;
import java.util.Collection;

/**
 * Generates Riverpod state providers from ProviderDefinition.
 * Full implementation in Session 2.
 */
@Component
public class DartStateCodegen {

    public String generateProvider(ProviderDefinition provider) {
        // TODO: Session 2 — full Riverpod provider generation
        return """
               import 'package:flutter_riverpod/flutter_riverpod.dart';

               // TODO: Generated provider for %s
               // Full implementation coming in Session 2
               final %s = StateProvider<dynamic>((ref) => null);
               """.formatted(provider.getName(), provider.getName());
    }

    public String generateBarrel(Collection<ProviderDefinition> providers) {
        StringBuilder sb = new StringBuilder("// Auto-generated providers barrel\n");
        providers.forEach(p ->
            sb.append("export '").append(toSnakeCase(p.getName())).append(".dart';\n")
        );
        return sb.toString();
    }

    private String toSnakeCase(String input) {
        return input.replaceAll("([A-Z])", "_$1").toLowerCase().replaceAll("^_", "");
    }
}
