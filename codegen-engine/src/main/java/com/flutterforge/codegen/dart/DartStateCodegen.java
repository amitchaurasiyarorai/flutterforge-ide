package com.flutterforge.codegen.dart;

import com.flutterforge.model.ProviderDefinition;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.Collection;

/**
 * Session 2 — DartStateCodegen
 * Generates Riverpod state providers from ProviderDefinition JSON.
 * Types: state | stateNotifier | asyncNotifier | future | stream | computed
 */
@Slf4j
@Component
public class DartStateCodegen {

    public String generateProvider(ProviderDefinition provider) {
        log.debug("Generating provider: {} type={}", provider.getName(), provider.getType());
        if (provider.getType() == null) return generateStateProvider(provider);
        return switch (provider.getType()) {
            case "stateNotifier" -> generateStateNotifierProvider(provider);
            case "asyncNotifier" -> generateAsyncNotifierProvider(provider);
            case "future"        -> generateFutureProvider(provider);
            case "stream"        -> generateStreamProvider(provider);
            case "computed"      -> generateComputedProvider(provider);
            default              -> generateStateProvider(provider);
        };
    }

    public String generateBarrel(Collection<ProviderDefinition> providers) {
        StringBuilder sb = new StringBuilder("// Auto-generated providers barrel\n\n");
        providers.forEach(p -> sb.append("export '").append(toSnakeCase(p.getName())).append(".dart';\n"));
        return sb.toString();
    }

    private String generateStateProvider(ProviderDefinition p) {
        String type    = p.getStateType() != null ? p.getStateType() : "dynamic";
        String initial = p.getInitialValue() != null ? p.getInitialValue() : defaultValue(type);
        return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n"
             + "final " + p.getName() + " = StateProvider<" + type + ">((ref) {\n"
             + "  return " + initial + ";\n});\n";
    }

    private String generateStateNotifierProvider(ProviderDefinition p) {
        String type    = p.getStateType() != null ? p.getStateType() : "dynamic";
        String nName   = capitalize(p.getName().replace("Provider","")) + "Notifier";
        String initial = p.getInitialValue() != null ? p.getInitialValue() : defaultValue(type);
        return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n"
             + "final " + p.getName() + " = StateNotifierProvider<" + nName + ", " + type + ">((ref) {\n"
             + "  return " + nName + "();\n});\n\n"
             + "class " + nName + " extends StateNotifier<" + type + "> {\n"
             + "  " + nName + "() : super(" + initial + ");\n\n"
             + "  void update(" + type + " newState) => state = newState;\n"
             + "  void reset() => state = " + initial + ";\n}\n";
    }

    private String generateAsyncNotifierProvider(ProviderDefinition p) {
        String type  = p.getStateType() != null ? p.getStateType() : "dynamic";
        String nName = capitalize(p.getName().replace("Provider","")) + "Notifier";
        return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n"
             + "final " + p.getName() + " = AsyncNotifierProvider<" + nName + ", " + type + ">(() {\n"
             + "  return " + nName + "();\n});\n\n"
             + "class " + nName + " extends AsyncNotifier<" + type + "> {\n"
             + "  @override\n  Future<" + type + "> build() async => _fetch();\n\n"
             + "  Future<" + type + "> _fetch() async {\n"
             + "    // TODO: implement data fetch in Session 3\n"
             + "    throw UnimplementedError();\n  }\n\n"
             + "  Future<void> refresh() async {\n"
             + "    state = const AsyncValue.loading();\n"
             + "    state = await AsyncValue.guard(_fetch);\n  }\n}\n";
    }

    private String generateFutureProvider(ProviderDefinition p) {
        String type = p.getStateType() != null ? p.getStateType() : "dynamic";
        return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n"
             + "final " + p.getName() + " = FutureProvider<List<" + type + ">>((ref) async {\n"
             + "  // TODO: implement fetch in Session 3\n  return [];\n});\n";
    }

    private String generateStreamProvider(ProviderDefinition p) {
        String type = p.getStateType() != null ? p.getStateType() : "dynamic";
        return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n"
             + "final " + p.getName() + " = StreamProvider<List<" + type + ">>((ref) async* {\n"
             + "  // TODO: connect to real-time data source\n  yield [];\n});\n";
    }

    private String generateComputedProvider(ProviderDefinition p) {
        String type    = p.getStateType() != null ? p.getStateType() : "dynamic";
        String initial = p.getInitialValue() != null ? p.getInitialValue() : defaultValue(type);
        return "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n"
             + "final " + p.getName() + " = Provider<" + type + ">((ref) {\n"
             + "  // TODO: derive from other providers\n  return " + initial + ";\n});\n";
    }

    private String defaultValue(String type) {
        if (type == null) return "null";
        return switch (type) {
            case "String"  -> "''";
            case "int"     -> "0";
            case "double"  -> "0.0";
            case "bool"    -> "false";
            default -> type.startsWith("List") ? "const []" : type.startsWith("Map") ? "const {}" : "null";
        };
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String toSnakeCase(String input) {
        if (input == null || input.isBlank()) return input;
        return input.replaceAll("([A-Z]+)([A-Z][a-z])","$1_$2")
                .replaceAll("([a-z0-9])([A-Z])","$1_$2").toLowerCase()
                .replaceAll("[^a-z0-9_]","_").replaceAll("_+","_").replaceAll("^_|_$","");
    }
}
