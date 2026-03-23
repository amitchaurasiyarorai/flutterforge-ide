package com.flutterforge.codegen;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flutterforge.codegen.dart.*;
import com.flutterforge.codegen.service.*;
import com.flutterforge.codegen.infra.*;
import com.flutterforge.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FlutterForgeCodegenEngine {

    private final ObjectMapper          objectMapper;
    private final DartWidgetCodegen     dartWidgetCodegen;
    private final DartStateCodegen      dartStateCodegen;
    private final DartApiClientCodegen  dartApiClientCodegen;
    private final DartRouterCodegen     dartRouterCodegen;
    private final DartThemeCodegen      dartThemeCodegen;
    private final SpringBootCodegen     springBootCodegen;
    private final GatewayCodegen        gatewayCodegen;
    private final DockerCodegen         dockerCodegen;
    private final HelmCodegen           helmCodegen;
    private final CiCdCodegen           ciCdCodegen;
    private final DockerComposeCodegen  dockerComposeCodegen;

    public GenerationResult generateFlutterApp(String projectJson, Path outputDir) throws IOException {
        log.info("Generating Flutter app -> {}", outputDir);
        FlutterForgeProject project = objectMapper.readValue(projectJson, FlutterForgeProject.class);
        GenerationResult result = new GenerationResult();
        result.setProjectId(project.getId());
        result.setProjectName(project.getName());
        generateProjectScaffold(project, outputDir, result);
        generateTheme(project, outputDir, result);
        generateRouter(project, outputDir, result);
        generateStateProviders(project, outputDir, result);
        generateApiClients(project, outputDir, result);
        generateScreens(project, outputDir, result);
        log.info("Flutter generation complete - {} files", result.getGeneratedFiles().size());
        return result;
    }

    public GenerationResult generateMicroservice(String serviceJson, Path outputDir) throws IOException {
        log.info("Generating microservice -> {}", outputDir);
        MicroserviceDefinition service = objectMapper.readValue(serviceJson, MicroserviceDefinition.class);
        GenerationResult result = new GenerationResult();
        result.setProjectId(service.getId());
        result.setProjectName(service.getName());
        springBootCodegen.generateProject(service, outputDir, result);
        MicroserviceDefinition.InfraDefinition.DockerDefinition docker =
            service.getInfra() != null ? service.getInfra().getDocker() : null;
        dockerCodegen.generate(docker, service, outputDir, result);
        helmCodegen.generate(service, outputDir, result);
        ciCdCodegen.generate(service, outputDir, result);
        log.info("Microservice generation complete - {} files", result.getGeneratedFiles().size());
        return result;
    }

    public GenerationResult generateServiceGraph(String graphJson, Path outputDir) throws IOException {
        log.info("Generating service graph -> {}", outputDir);
        ServiceGraphDefinition graph = objectMapper.readValue(graphJson, ServiceGraphDefinition.class);
        GenerationResult result = new GenerationResult();
        result.setProjectId(graph.getId());
        result.setProjectName(graph.getName());
        if (graph.getGateway() != null) {
            gatewayCodegen.generate(graph.getGateway(), outputDir.resolve("api-gateway"), result);
        }
        if (graph.getServices() != null) {
            for (MicroserviceDefinition svc : graph.getServices().values()) {
                Path svcDir = outputDir.resolve(svc.getArtifactId());
                springBootCodegen.generateProject(svc, svcDir, result);
                MicroserviceDefinition.InfraDefinition.DockerDefinition docker =
                    svc.getInfra() != null ? svc.getInfra().getDocker() : null;
                dockerCodegen.generate(docker, svc, svcDir, result);
                helmCodegen.generate(svc, svcDir, result);
                ciCdCodegen.generate(svc, svcDir, result);
            }
        }
        dockerComposeCodegen.generate(graph, outputDir, result);
        log.info("Service graph generation complete - {} files", result.getGeneratedFiles().size());
        return result;
    }

    private void generateProjectScaffold(FlutterForgeProject project, Path outputDir, GenerationResult result) throws IOException {
        Path libDir = outputDir.resolve("lib");
        Files.createDirectories(libDir.resolve("screens"));
        Files.createDirectories(libDir.resolve("widgets/shared"));
        Files.createDirectories(libDir.resolve("providers"));
        Files.createDirectories(libDir.resolve("services"));
        Files.createDirectories(libDir.resolve("models"));
        Files.createDirectories(libDir.resolve("utils"));
        Files.createDirectories(outputDir.resolve("test"));
        Files.createDirectories(outputDir.resolve("assets/images"));
        Files.createDirectories(outputDir.resolve("assets/fonts"));
        writeFile(outputDir.resolve("pubspec.yaml"), buildPubspec(project), result);
        writeFile(libDir.resolve("main.dart"), buildMainDart(project), result);
        writeFile(outputDir.resolve("analysis_options.yaml"), buildAnalysisOptions(), result);
        writeFile(outputDir.resolve(".gitignore"), buildFlutterGitignore(), result);
    }

    private void generateTheme(FlutterForgeProject project, Path outputDir, GenerationResult result) throws IOException {
        writeFile(outputDir.resolve("lib/utils/app_theme.dart"), dartThemeCodegen.generate(project.getTheme()), result);
    }

    private void generateRouter(FlutterForgeProject project, Path outputDir, GenerationResult result) throws IOException {
        writeFile(outputDir.resolve("lib/utils/app_router.dart"), dartRouterCodegen.generate(project), result);
    }

    private void generateStateProviders(FlutterForgeProject project, Path outputDir, GenerationResult result) throws IOException {
        if (project.getStateProviders() == null || project.getStateProviders().isEmpty()) return;
        for (ProviderDefinition provider : project.getStateProviders().values()) {
            writeFile(outputDir.resolve("lib/providers/" + toSnakeCase(provider.getName()) + ".dart"),
                dartStateCodegen.generateProvider(provider), result);
        }
        writeFile(outputDir.resolve("lib/providers/providers.dart"),
            dartStateCodegen.generateBarrel(project.getStateProviders().values()), result);
    }

    private void generateApiClients(FlutterForgeProject project, Path outputDir, GenerationResult result) throws IOException {
        if (project.getServices() == null || project.getServices().isEmpty()) return;
        for (ServiceDefinition svc : project.getServices().values()) {
            writeFile(outputDir.resolve("lib/services/" + toSnakeCase(svc.getName()) + "_client.dart"),
                dartApiClientCodegen.generateClient(svc), result);
            writeFile(outputDir.resolve("lib/models/" + toSnakeCase(svc.getName()) + "_models.dart"),
                dartApiClientCodegen.generateModels(svc), result);
        }
        writeFile(outputDir.resolve("lib/services/services.dart"),
            dartApiClientCodegen.generateBarrel(project.getServices().values()), result);
    }

    private void generateScreens(FlutterForgeProject project, Path outputDir, GenerationResult result) throws IOException {
        if (project.getScreens() == null || project.getScreens().isEmpty()) return;
        for (ScreenDefinition screen : project.getScreens().values()) {
            writeFile(outputDir.resolve("lib/screens/" + toSnakeCase(screen.getName()) + ".dart"),
                dartWidgetCodegen.generateScreen(screen, project), result);
        }
    }

    private String buildPubspec(FlutterForgeProject project) {
        String name = toSnakeCase(project.getName());
        StringBuilder sb = new StringBuilder();
        sb.append("name: ").append(name).append("\n");
        sb.append("description: ").append(project.getDescription() != null ? project.getDescription() : "Generated by FlutterForge").append("\n");
        sb.append("version: ").append(project.getVersion()).append("+1\n\n");
        sb.append("environment:\n  sdk: '>=3.0.0 <4.0.0'\n  flutter: '>=3.10.0'\n\n");
        sb.append("dependencies:\n  flutter:\n    sdk: flutter\n");
        sb.append("  flutter_riverpod: ^2.4.9\n  riverpod_annotation: ^2.3.3\n");
        sb.append("  go_router: ^12.1.3\n  dio: ^5.4.0\n");
        sb.append("  freezed_annotation: ^2.4.1\n  json_annotation: ^4.8.1\n");
        sb.append("  shared_preferences: ^2.2.2\n  flutter_secure_storage: ^9.0.0\n");
        if (project.getDependencies() != null) {
            project.getDependencies().forEach((pkg, ver) -> sb.append("  ").append(pkg).append(": ").append(ver).append("\n"));
        }
        sb.append("\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n");
        sb.append("  build_runner: ^2.4.7\n  riverpod_generator: ^2.3.9\n");
        sb.append("  freezed: ^2.4.5\n  json_serializable: ^6.7.1\n  flutter_lints: ^3.0.0\n\n");
        sb.append("flutter:\n  uses-material-design: true\n");
        if (project.getAssets() != null && !project.getAssets().isEmpty()) {
            sb.append("  assets:\n");
            project.getAssets().forEach(a -> sb.append("    - ").append(a.getPath()).append("\n"));
        }
        return sb.toString();
    }

    private String buildMainDart(FlutterForgeProject project) {
        String snakeName = toSnakeCase(project.getName());
        String appName = project.getName();
        return "import 'package:" + snakeName + "/utils/app_router.dart';\n" +
               "import 'package:" + snakeName + "/utils/app_theme.dart';\n" +
               "import 'package:flutter/material.dart';\n" +
               "import 'package:flutter_riverpod/flutter_riverpod.dart';\n\n" +
               "void main() {\n  WidgetsFlutterBinding.ensureInitialized();\n" +
               "  runApp(const ProviderScope(child: " + appName + "App()));\n}\n\n" +
               "class " + appName + "App extends ConsumerWidget {\n" +
               "  const " + appName + "App({super.key});\n\n" +
               "  @override\n  Widget build(BuildContext context, WidgetRef ref) {\n" +
               "    return MaterialApp.router(\n      title: '" + appName + "',\n" +
               "      theme: AppTheme.lightTheme,\n      darkTheme: AppTheme.darkTheme,\n" +
               "      themeMode: ThemeMode.system,\n      routerConfig: appRouter,\n" +
               "      debugShowCheckedModeBanner: false,\n    );\n  }\n}\n";
    }

    private String buildAnalysisOptions() {
        return "include: package:flutter_lints/flutter.yaml\nlinter:\n  rules:\n" +
               "    - always_declare_return_types\n    - avoid_print\n" +
               "    - prefer_const_constructors\nanalyzer:\n  errors:\n" +
               "    invalid_annotation_target: ignore\n  exclude:\n" +
               "    - \"**/*.g.dart\"\n    - \"**/*.freezed.dart\"\n";
    }

    private String buildFlutterGitignore() {
        return ".dart_tool/\n.flutter-plugins\n.pub-cache/\nbuild/\n*.g.dart\n*.freezed.dart\n.DS_Store\n";
    }

    private void writeFile(Path path, String content, GenerationResult result) throws IOException {
        Files.createDirectories(path.getParent());
        Files.writeString(path, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        result.getGeneratedFiles().add(path.toString());
        log.debug("Generated: {}", path);
    }

    public static String toSnakeCase(String input) {
        if (input == null || input.isBlank()) return input;
        return input.replaceAll("([A-Z]+)([A-Z][a-z])", "$1_$2")
                .replaceAll("([a-z0-9])([A-Z])", "$1_$2")
                .toLowerCase().replaceAll("[^a-z0-9_]", "_")
                .replaceAll("_+", "_").replaceAll("^_|_$", "");
    }
}
