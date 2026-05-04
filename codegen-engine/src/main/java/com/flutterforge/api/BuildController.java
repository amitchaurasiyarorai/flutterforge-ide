package com.flutterforge.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flutterforge.codegen.dart.AppzillonSystemCodegen;
import com.flutterforge.codegen.dart.DartRouterCodegen;
import com.flutterforge.codegen.dart.DartThemeCodegen;
import com.flutterforge.codegen.dart.DartWidgetCodegen;
import com.flutterforge.model.ScreenDefinition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class BuildController {

    private final DartWidgetCodegen    dartWidgetCodegen;
    private final AppzillonSystemCodegen appzillonSystemCodegen;
    private final DartThemeCodegen     dartThemeCodegen;
    private final DartRouterCodegen    dartRouterCodegen;
    private final ObjectMapper         objectMapper;

    private final ExecutorService executor = Executors.newCachedThreadPool();

    // ─────────────────────────────────────────────────────────────────────────
    // BUILD ENDPOINT
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/build/start")
    public SseEmitter startBuild(@RequestBody BuildRequest req) {
        SseEmitter sink = new SseEmitter(0L);
        executor.submit(() -> {
            try {
                runBuild(req, sink);
                emitSse(sink, "[DONE]");
                sink.complete();
            } catch (Exception e) {
                log.error("Build failed", e);
                emitSse(sink, "[ERROR] " + e.getMessage());
                sink.complete();
            }
        });
        return sink;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN BUILD LOGIC
    // ─────────────────────────────────────────────────────────────────────────

    private void runBuild(BuildRequest req, SseEmitter sink) throws Exception {
        String snakePkg = toSnakeCase(req.projectName());

        // ── 1. Persistent workspace + flutter create (first build only) ──────
        // Workspace: {projectPath}/.appzillon_build/  — reused across builds.
        // flutter create runs ONCE on a clean empty dir → correct Android project.
        // lib/ is wiped on every build so dart files are always regenerated fresh.
        Path projectDir = Paths.get(req.projectPath()).resolve(".appzillon_build");
        log.info("Build workspace: {}", projectDir);

        Path androidDir = projectDir.resolve("android");
        if (!Files.exists(androidDir)) {
            emitSse(sink, "[Build] Initialising Flutter project (one-time, ~30s)…");
            // Wipe any partial state from previous failed attempts
            if (Files.exists(projectDir)) {
                log.info("Cleaning partial workspace before flutter create");
                deleteDir(projectDir);
            }
            Files.createDirectories(projectDir);
            String flutter = resolveFlutter(req.buildConfig());
            String pkg = req.packageName() != null ? req.packageName()
                    : "com." + snakePkg.replace("-", "_");
            String org = pkg.contains(".")
                    ? pkg.substring(0, pkg.lastIndexOf('.')) : pkg;
            runCommand(projectDir, sink,
                    flutter, "create",
                    "--org", org,
                    "--project-name", snakePkg,
                    "--platforms", "android",
                    ".");
            emitSse(sink, "  ✓ Flutter project initialised");
            log.info("flutter create completed for {}", snakePkg);
        } else {
            emitSse(sink, "[Build] Setting up Flutter project…");
            log.info("Reusing existing android/ for {}", snakePkg);
        }

        // Always refresh local.properties (flutter SDK path may have changed)
        if (req.buildConfig() != null && req.buildConfig().flutterPath() != null
                && !req.buildConfig().flutterPath().isBlank()) {
            String sdkPath = req.buildConfig().flutterPath().trim().replace('\\', '/');
            if (sdkPath.endsWith("/flutter.bat")) sdkPath = sdkPath.substring(0, sdkPath.length()-12);
            if (sdkPath.endsWith("/flutter"))     sdkPath = sdkPath.substring(0, sdkPath.length()-8);
            if (sdkPath.endsWith("/bin"))         sdkPath = sdkPath.substring(0, sdkPath.length()-4);
            String sdkDir = req.buildConfig().androidSdkPath() != null
                    ? req.buildConfig().androidSdkPath().replace('\\', '/') : "";
            Files.writeString(projectDir.resolve("local.properties"),
                    "flutter.sdk=" + sdkPath + "\n" + "sdk.dir=" + sdkDir + "\n");
        }

        // Patch android/app/build.gradle(.kts) after flutter create:
        //  1. Set correct applicationId (flutter create uses a generated name)
        //  2. Remove ndkVersion pin — flutter create pins it to the version bundled
        //     with the Flutter SDK (e.g. 27.0.12077973), but the developer's machine
        //     may have a different NDK installed (e.g. 28.2.13676358).
        //     Removing the pin lets Gradle use whatever NDK is present.
        try {
            String pkg = req.packageName() != null ? req.packageName()
                    : "com." + snakePkg.replace("-", "_");

            // flutter create generates build.gradle.kts (Kotlin DSL) in Flutter 3.x
            Path appGradleKts = projectDir.resolve("android/app/build.gradle.kts");
            Path appGradle    = projectDir.resolve("android/app/build.gradle");
            Path gradleFile   = Files.exists(appGradleKts) ? appGradleKts : appGradle;

            if (Files.exists(gradleFile)) {
                String g = Files.readString(gradleFile);

                // Patch applicationId
                g = g.replaceAll( "applicationId\\s+[\"'][^\"']+[\"']",
                        "applicationId \"" + pkg + "\"");

                // Remove ndkVersion line entirely — let Gradle use installed NDK
                // This prevents CXX1101 "did not have a source.properties file" errors
                // when the developer's NDK version differs from the Flutter SDK default
                g = g.replaceAll("(?m)^[ \t]*ndkVersion[^\n]*\n?", "");
                g = g.replaceFirst("(android\\s*\\{)", "$1\n    ndkVersion = \"28.2.13676358\"");

                Files.writeString(gradleFile, g);
                log.info("Patched {}: applicationId={}, ndkVersion=28.2.13676358",
                        gradleFile.getFileName(), pkg);
            }
        } catch (Exception e) { log.warn("Could not patch build.gradle: {}", e.getMessage()); }

        // Always wipe lib/ — regenerated fresh every build
        Path lib = projectDir.resolve("lib");
        if (Files.exists(lib)) deleteDir(lib);
        Files.createDirectories(lib.resolve("screens"));
        Files.createDirectories(lib.resolve("appzillon"));

        try {
            // ── 2. Write pubspec.yaml ─────────────────────────────────────
            emitSse(sink, "[Build] Writing pubspec.yaml…");
            Files.writeString(projectDir.resolve("pubspec.yaml"), buildPubspec(req));

            // ── 3. Inject Appzillon system files ─────────────────────────
            emitSse(sink, "[Build] Injecting Appzillon SDK files…");
            com.flutterforge.model.GenerationResult sysResult =
                    new com.flutterforge.model.GenerationResult();
            appzillonSystemCodegen.injectSystemFiles(lib.resolve("appzillon"),
                    req.packageName(), sysResult);
            sysResult.getGeneratedFiles().forEach(f -> emitSse(sink, "  ✓ " + f));
            if (sysResult.hasErrors()) sysResult.getErrors()
                    .forEach(e -> emitSse(sink, "  ⚠ " + e));

            // ── 4. Inject az_config.dart ──────────────────────────────────
            injectAzConfig(req, lib.resolve("appzillon"), sink);

            // ── 5. Write app_theme.dart ───────────────────────────────────
            if (req.appConfig() != null) {
                Path themeFile = lib.resolve("appzillon").resolve("app_theme.dart");
                com.flutterforge.model.FlutterForgeProject proj =
                        new com.flutterforge.model.FlutterForgeProject();
                proj.setName(req.projectName());
                proj.setPackageName(req.packageName());
                // Load theme from app.json if available
                Path appJsonPath = Paths.get(req.projectPath()).resolve("app.json");
                if (Files.exists(appJsonPath)) {
                    try {
                        com.flutterforge.model.FlutterForgeProject fromDisk =
                                objectMapper.readValue(appJsonPath.toFile(),
                                        com.flutterforge.model.FlutterForgeProject.class);
                        proj.setTheme(fromDisk.getTheme());
                    } catch (Exception ignored) {}
                }
                String themeDart = dartThemeCodegen.generate(proj.getTheme());
                Files.writeString(themeFile, themeDart);
                emitSse(sink, "  ✓ app_theme.dart");
            }

            // ── 6. Write shared dart files ────────────────────────────────
            emitSse(sink, "[Build] Copying shared files…");
            Path sharedProjectDir = Paths.get(req.projectPath()).resolve("shared");
            if (Files.exists(sharedProjectDir)) {
                Path sharedOut = lib.resolve("shared");
                Files.createDirectories(sharedOut);
                try (var files = Files.list(sharedProjectDir)) {
                    files.filter(f -> f.toString().endsWith(".dart")).forEach(dartFile -> {
                        try {
                            String src = Files.readString(dartFile);
                            // Rewrite shared class aliases
                            src = rewriteSharedClassAliases(src, sharedProjectDir);
                            Files.writeString(sharedOut.resolve(dartFile.getFileName()), src);
                            emitSse(sink, "  ✓ shared/" + dartFile.getFileName());
                        } catch (Exception e) {
                            log.warn("Could not copy shared file {}: {}", dartFile, e.getMessage());
                        }
                    });
                }
            }

            // ── 7. Write screen dart files ────────────────────────────────
            emitSse(sink, "[Build] Generating screen files…");

            List<String> screenNames = req.screenNames() != null
                    ? req.screenNames() : List.of();
            Path screensProjectDir = Paths.get(req.projectPath()).resolve("screens");

            // EN1 Item 1: Load interfaces once for URL injection
            java.util.Map<String, InterfaceDef> ifcMap = loadInterfacesMap(req.projectPath());

            for (String screenName : screenNames) {
                String fileName = toSnakeCase(screenName) + ".dart";
                Path dest = lib.resolve("screens").resolve(fileName);

                // Look for a real dart file in project/screens/ScreenName/
                Path screenFolder = screensProjectDir.resolve(screenName);
                Path realFile = null;
                if (Files.exists(screenFolder)) {
                    try (var files = java.nio.file.Files.list(screenFolder)) {
                        realFile = files
                                .filter(f -> f.getFileName().toString().endsWith(".dart"))
                                .findFirst().orElse(null);
                    } catch (Exception ignored) {}
                }

                if (realFile != null && Files.exists(realFile)) {
                    // Real dart file found — this is the CONTROLLER code.
                    // The Widget class is ALWAYS generated fresh from screen.json.
                    log.info("Reading controller: {}", realFile.toAbsolutePath());
                    try {
                        String controllerSrc = Files.readString(realFile);

                        // ── Sanity check: detect and self-heal duplicate methods ──
                        boolean hasDuplicateMethod = false;
                        java.util.Map<String, Integer> methodCounts = new java.util.LinkedHashMap<>();
                        for (String line : controllerSrc.split("\n")) {
                            java.util.regex.Matcher mm = java.util.regex.Pattern
                                    .compile("^\\s+(?:Future<\\w+>|void|bool|String|int)\\s+(\\w+)\\s*\\(")
                                    .matcher(line);
                            if (mm.find()) {
                                String mn = mm.group(1);
                                methodCounts.merge(mn, 1, Integer::sum);
                                if (methodCounts.get(mn) > 1) { hasDuplicateMethod = true; break; }
                            }
                        }
                        if (hasDuplicateMethod) {
                            log.warn("Duplicate method in {} — writing clean stub", realFile.getFileName());
                            // EN1 Item 1: pass ifcMap so the clean stub also gets real URLs
                            String stub = buildControllerStub(screenName, snakePkg,
                                    ifcMap, java.util.List.of());
                            Files.writeString(realFile, stub);
                            controllerSrc = stub;
                        }

                        // ── Package name rewrite ──────────────────────────────
                        Set<String> keepPackages = Set.of(
                                "flutter", "flutter_riverpod", "flutter_test",
                                "go_router", "riverpod", "http", "dart",
                                "shared_preferences", "device_info_plus",
                                "package_info_plus", "lottie", "fl_chart",
                                "local_auth", "intl", "image_picker",
                                "google_fonts", "path_provider", "url_launcher"
                        );
                        String oldPkg = null;
                        for (String line : controllerSrc.split("\n")) {
                            String trimmed = line.trim();
                            if (trimmed.startsWith("import 'package:")) {
                                int start = trimmed.indexOf("package:") + 8;
                                int end   = trimmed.indexOf("/", start);
                                if (end > start) {
                                    String candidate = trimmed.substring(start, end);
                                    if (!keepPackages.contains(candidate) && !candidate.equals(snakePkg)) {
                                        oldPkg = candidate;
                                        break;
                                    }
                                }
                            }
                        }
                        if (oldPkg != null && !oldPkg.equals(snakePkg)) {
                            controllerSrc = controllerSrc.replace(
                                    "package:" + oldPkg + "/", "package:" + snakePkg + "/");
                        }

                        // ── Shared class alias rewrite ────────────────────────
                        controllerSrc = rewriteSharedClassAliases(controllerSrc,
                                Paths.get(req.projectPath()).resolve("shared"));

                        // ── Generate Widget class from screen.json ────────────
                        String widgetCode = null;
                        Path screenJsonPath = screensProjectDir.resolve(screenName)
                                .resolve("screen.json");
                        if (Files.exists(screenJsonPath)) {
                            try {
                                // Resilient read: handles double-encoded screen.json
                                // (Electron frontend may JSON.stringify twice, producing a JSON string)
                                String _rawJson1 = Files.readString(screenJsonPath);
                                String _trimmed1 = _rawJson1.trim();
                                if (_trimmed1.startsWith("\"")) {
                                    _rawJson1 = objectMapper.readValue(_rawJson1, String.class);
                                }
                                com.flutterforge.model.ScreenDefinition screenDef =
                                        objectMapper.readValue(_rawJson1,
                                                com.flutterforge.model.ScreenDefinition.class);
                                com.flutterforge.model.FlutterForgeProject syntheticProject =
                                        new com.flutterforge.model.FlutterForgeProject();
                                syntheticProject.setName(req.projectName());
                                syntheticProject.setPackageName(req.packageName());
                                Path appJsonPath = Paths.get(req.projectPath()).resolve("app.json");
                                if (Files.exists(appJsonPath)) {
                                    try {
                                        com.flutterforge.model.FlutterForgeProject fromDisk =
                                                objectMapper.readValue(appJsonPath.toFile(),
                                                        com.flutterforge.model.FlutterForgeProject.class);
                                        syntheticProject.setTheme(fromDisk.getTheme());
                                        syntheticProject.setScreens(fromDisk.getScreens());
                                        syntheticProject.setDependencies(fromDisk.getDependencies());
                                    } catch (Exception ignored) {}
                                }
                                if (screenDef.getWidgets() != null && !screenDef.getWidgets().isEmpty()) {
                                    // EN1 Item 2: resolve onScreenLoad interfaces for initState
                                    java.util.List<String> boundIfcIds2 = resolveScreenBoundIfcIds(
                                            screenDef, ifcMap);
                                    java.util.List<String> onLoadMethods2 = buildOnLoadMethodNames(
                                            boundIfcIds2, ifcMap);
                                    String ctrlBase2 = screenName.replace("Screen", "") + "Controller";
                                    String provName2 = Character.toLowerCase(ctrlBase2.charAt(0))
                                            + ctrlBase2.substring(1) + "Provider";
                                    widgetCode = onLoadMethods2.isEmpty()
                                            ? dartWidgetCodegen.generateScreen(screenDef, syntheticProject)
                                            : dartWidgetCodegen.generateScreen(screenDef, syntheticProject,
                                            onLoadMethods2, provName2);
                                }
                            } catch (Exception e) {
                                log.debug("Could not generate widget from screen.json for {}: {}",
                                        screenName, e.getMessage());
                            }
                        }

                        // ── Assemble final dart file ──────────────────────────
                        // Strip any widget classes the developer's file may contain
                        // (e.g. LoginScreen was hand-written in full) — the fresh
                        // widget codegen provides them; duplicates cause compile errors.
                        Set<String> widgetClassNames = new HashSet<>(Set.of(
                                screenName, "_" + screenName + "State"));
                        String cleanControllerSrc = stripNamedClasses(controllerSrc, widgetClassNames);

                        String finalCode;
                        if (widgetCode != null) {
                            finalCode = mergeImportsAndClasses(widgetCode, cleanControllerSrc);
                            emitSse(sink, "  ✓ " + screenName + " (canvas widget + controller)");
                        } else {
                            String widgetClass = buildScreenWidgetClass(screenName, snakePkg);
                            finalCode = mergeImportsAndClasses(widgetClass, cleanControllerSrc);
                            emitSse(sink, "  ✓ " + screenName + " (placeholder widget + controller)");
                        }
                        Files.writeString(dest, finalCode);

                    } catch (Exception e) {
                        log.warn("Could not copy screen {}: {}", screenName, e.getMessage());
                        Files.writeString(dest, buildPlaceholder(screenName, snakePkg));
                        emitSse(sink, "  → " + screenName + " (placeholder — copy failed)");
                    }

                } else {
                    // No pre-written dart file — generate from screen.json
                    Path screenJsonPath = screensProjectDir.resolve(screenName)
                            .resolve("screen.json");
                    boolean generated = false;

                    if (Files.exists(screenJsonPath)) {
                        try {
                            // Resilient read: handles double-encoded screen.json
                            String _rawJson2 = Files.readString(screenJsonPath);
                            String _trimmed2 = _rawJson2.trim();
                            if (_trimmed2.startsWith("\"")) {
                                _rawJson2 = objectMapper.readValue(_rawJson2, String.class);
                            }
                            com.flutterforge.model.ScreenDefinition screenDef =
                                    objectMapper.readValue(_rawJson2,
                                            com.flutterforge.model.ScreenDefinition.class);

                            com.flutterforge.model.FlutterForgeProject syntheticProject =
                                    new com.flutterforge.model.FlutterForgeProject();
                            syntheticProject.setName(req.projectName());
                            syntheticProject.setPackageName(req.packageName());

                            Path appJsonPath = Paths.get(req.projectPath()).resolve("app.json");
                            if (Files.exists(appJsonPath)) {
                                try {
                                    com.flutterforge.model.FlutterForgeProject fromDisk =
                                            objectMapper.readValue(appJsonPath.toFile(),
                                                    com.flutterforge.model.FlutterForgeProject.class);
                                    syntheticProject.setTheme(fromDisk.getTheme());
                                    syntheticProject.setScreens(fromDisk.getScreens());
                                    syntheticProject.setDependencies(fromDisk.getDependencies());
                                } catch (Exception ignored) {
                                    log.debug("Could not load app.json: {}", ignored.getMessage());
                                }
                            }

                            if (screenDef.getWidgets() == null) {
                                throw new IllegalStateException("screen.json has no widgets");
                            }

                            // ── EN1 Item 1: collect bound interface IDs (id→InterfaceDef) ──
                            java.util.List<String> boundIfcIds = resolveScreenBoundIfcIds(
                                    screenDef, ifcMap);

                            // ── EN1 Item 2: which interfaces trigger on screen load? ──
                            java.util.List<String> onLoadMethodNames = buildOnLoadMethodNames(
                                    boundIfcIds, ifcMap);

                            // Provider name: "DashboardScreen" → "dashboardControllerProvider"
                            String ctrlBaseName = screenName.replace("Screen", "") + "Controller";
                            String providerName = Character.toLowerCase(ctrlBaseName.charAt(0))
                                    + ctrlBaseName.substring(1) + "Provider";

                            // ── Generate Widget class, injecting initState if needed ──
                            String widgetCode;
                            if (onLoadMethodNames.isEmpty()) {
                                widgetCode = dartWidgetCodegen.generateScreen(
                                        screenDef, syntheticProject);
                            } else {
                                widgetCode = dartWidgetCodegen.generateScreen(
                                        screenDef, syntheticProject, onLoadMethodNames, providerName);
                                log.info("Injected initState() for {} — {} on-load method(s): {}",
                                        screenName, onLoadMethodNames.size(), onLoadMethodNames);
                            }

                            // ── Generate controller with real URLs (EN1 Item 1) ──
                            String controllerCode = buildControllerStub(
                                    screenName, snakePkg, ifcMap, boundIfcIds);

                            // ── Merge and write ───────────────────────────────
                            String finalCode = mergeImportsAndClasses(widgetCode, controllerCode);
                            Files.writeString(dest, finalCode);
                            generated = true;
                            emitSse(sink, "  ✓ " + screenName + " (canvas widget"
                                    + (boundIfcIds.isEmpty() ? ""
                                    : " + " + boundIfcIds.size() + " interface(s)")
                                    + (onLoadMethodNames.isEmpty() ? ""
                                    : " + initState auto-trigger")
                                    + ")");

                        } catch (Exception e) {
                            log.warn("Could not generate dart for {} from screen.json: {}",
                                    screenName, e.getMessage());
                        }
                    }

                    if (!generated) {
                        Files.writeString(dest, buildPlaceholder(screenName, snakePkg));
                        emitSse(sink, "  → " + screenName + " (placeholder — no screen.json found)");
                    }
                }
            }

            // ── 8. Write main.dart ────────────────────────────────────────
            emitSse(sink, "[Build] Writing main.dart…");
            String snakeName = toSnakeCase(req.projectName());
            Files.writeString(lib.resolve("main.dart"), buildMainDart(req, snakeName));
            emitSse(sink, "  ✓ main.dart");

            // ── 8.5 Generate router.dart from navConnections (S7) ─────────────
            emitSse(sink, "[Build] Generating router.dart…");
            try {
                String routerDart = generateRouterDart(req, snakeName);
                Files.writeString(lib.resolve("router.dart"), routerDart);
                emitSse(sink, "  ✓ router.dart (GoRouter — " + countRoutes(req) + " routes)");
            } catch (Exception e) {
                log.warn("Could not generate router.dart: {}", e.getMessage());
                emitSse(sink, "  ⚠ router.dart skipped: " + e.getMessage());
            }

            // ── 9. Android project created by flutter create (step 1) ──────
            // writeAndroidConfig() not needed — flutter create handles it.

            // ── 10. Copy assets ───────────────────────────────────────────
            copyAssetsIfPresent(req.projectPath(), projectDir, sink);

            // ── 11. Run flutter pub get ───────────────────────────────────
            emitSse(sink, "[Build] Running flutter pub get…");
            runFlutterPubGet(projectDir, req.buildConfig(), sink);

            // ── 12. Run flutter build ─────────────────────────────────────
            String mode = req.buildConfig() != null
                    ? req.buildConfig().buildMode() : "debug";
            List<String> targets = req.buildConfig() != null && req.buildConfig().targets() != null
                    ? req.buildConfig().targets() : List.of("apk");

            for (String target : targets) {
                emitSse(sink, "[Build] Building " + target + " (" + mode + ")…");
                runFlutterBuild(projectDir, target, mode, req.buildConfig(), sink);

                // Copy output to project folder
                Path outputDir = Paths.get(req.projectPath()).resolve("build_output");
                Files.createDirectories(outputDir);
                copyBuildOutput(projectDir, target, mode, outputDir, sink);
            }

        } finally {
            // Persistent workspace — do NOT delete.
            // android/ preserved for fast subsequent builds.
            // lib/ is wiped at the start of each build.
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EN1 ITEM 1 — Interface definition record + loader
    // ─────────────────────────────────────────────────────────────────────────

    private record InterfaceDef(
            String id,
            String name,
            String method,       // get | post | put | patch | delete
            String urlPath,      // e.g. /api/v1/auth/login
            String triggerType,  // onScreenLoad | onButtonTap | manual | onPullRefresh
            java.util.List<java.util.Map<String, Object>> params
    ) {}

    /**
     * Reads {projectPath}/services/interfaces.json → id → InterfaceDef map.
     * Returns empty map if the file doesn't exist or fails to parse.
     */
    private java.util.Map<String, InterfaceDef> loadInterfacesMap(String projectPath) {
        try {
            Path ifcPath = Paths.get(projectPath).resolve("services").resolve("interfaces.json");
            if (!Files.exists(ifcPath)) {
                log.debug("interfaces.json not found at {}", ifcPath);
                return java.util.Map.of();
            }
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> root = objectMapper.readValue(
                    ifcPath.toFile(), java.util.Map.class);
            @SuppressWarnings("unchecked")
            java.util.List<java.util.Map<String, Object>> ifcList =
                    (java.util.List<java.util.Map<String, Object>>) root.getOrDefault(
                            "interfaces", java.util.List.of());

            java.util.Map<String, InterfaceDef> result = new java.util.LinkedHashMap<>();
            for (java.util.Map<String, Object> raw : ifcList) {
                String id      = (String) raw.get("id");
                String name    = (String) raw.getOrDefault("name", "");
                String method  = ((String) raw.getOrDefault("method", "GET")).toLowerCase();
                String urlPath = (String) raw.getOrDefault("urlPath", "/api/unknown");
                String trigger = (String) raw.getOrDefault("triggerType", "manual");
                @SuppressWarnings("unchecked")
                java.util.List<java.util.Map<String, Object>> params =
                        (java.util.List<java.util.Map<String, Object>>) raw.getOrDefault(
                                "params", java.util.List.of());
                if (id != null) {
                    result.put(id, new InterfaceDef(id, name, method, urlPath, trigger, params));
                }
            }
            log.info("Loaded {} interfaces from interfaces.json", result.size());
            return result;
        } catch (Exception e) {
            log.warn("Could not load interfaces.json: {}", e.getMessage());
            return java.util.Map.of();
        }
    }

    /**
     * Resolves bound interface IDs for a screen from its widget apiBindings.
     * Tries interfaceId first, then resolves interfaceName → id via ifcMap.
     */
    private java.util.List<String> resolveScreenBoundIfcIds(
            com.flutterforge.model.ScreenDefinition screenDef,
            java.util.Map<String, InterfaceDef> ifcMap) {
        java.util.List<String> result = new java.util.ArrayList<>();
        if (screenDef.getWidgets() == null) return result;
        for (com.flutterforge.model.WidgetNode wn : screenDef.getWidgets().values()) {
            if (wn.getApiBinding() != null) {
                String ifcId   = (String) wn.getApiBinding().get("interfaceId");
                String ifcName = (String) wn.getApiBinding().get("interfaceName");
                if (ifcId != null && !ifcId.isBlank()) {
                    if (!result.contains(ifcId)) result.add(ifcId);
                } else if (ifcName != null && !ifcName.isBlank()) {
                    String resolvedId = ifcMap.entrySet().stream()
                            .filter(e -> ifcName.equals(e.getValue().name()))
                            .map(java.util.Map.Entry::getKey)
                            .findFirst().orElse(ifcName);
                    if (!result.contains(resolvedId)) result.add(resolvedId);
                }
            }
        }
        return result;
    }

    /**
     * Filters bound interface IDs to those with triggerType "onScreenLoad"
     * and returns the corresponding load method names.
     */
    private java.util.List<String> buildOnLoadMethodNames(
            java.util.List<String> boundIfcIds,
            java.util.Map<String, InterfaceDef> ifcMap) {
        java.util.List<String> result = new java.util.ArrayList<>();
        for (String ifcId : boundIfcIds) {
            InterfaceDef ifc = ifcMap.get(ifcId);
            if (ifc != null && "onScreenLoad".equals(ifc.triggerType())) {
                String name = ifc.name();
                result.add("load" + Character.toUpperCase(name.charAt(0)) + name.substring(1));
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONTROLLER STUB BUILDERS (EN1 Item 1 — real URLs injected)
    // ─────────────────────────────────────────────────────────────────────────

    /** Convenience delegate — used by the duplicate-method fallback path. */
    private String buildControllerStub(String screenName, String snakePkg) {
        return buildControllerStub(screenName, snakePkg,
                java.util.Map.of(), java.util.List.of());
    }

    /**
     * Builds the controller stub for a screen.
     * When boundIfcIds is non-empty, generates one load method per interface
     * with the real URL + HTTP method from ifcMap instead of "/api/..." placeholder.
     */
    private String buildControllerStub(String screenName, String snakePkg,
                                       java.util.Map<String, InterfaceDef> ifcMap,
                                       java.util.List<String> boundIfcIds) {
        String ctrl  = screenName.replace("Screen", "") + "Controller";
        String state = screenName.replace("Screen", "") + "State";
        String prov  = Character.toLowerCase(ctrl.charAt(0)) + ctrl.substring(1) + "Provider";

        StringBuilder sb = new StringBuilder();
        sb.append("import 'package:flutter_riverpod/flutter_riverpod.dart';\n");
        sb.append("import 'package:").append(snakePkg).append("/appzillon/appzillon.dart';\n\n");
        sb.append("// ──────────────────────────────────────────────────────────────────────\n");
        sb.append("// ").append(screenName).append(" Controller\n");
        sb.append("// Auto-generated by Appzillon-New IDE — EDIT THIS FILE freely.\n");
        sb.append("// The Widget class above is regenerated each build — your logic is safe here.\n");
        sb.append("// ──────────────────────────────────────────────────────────────────────\n\n");

        sb.append("class ").append(ctrl)
                .append(" extends StateNotifier<").append(state).append("> {\n");
        sb.append("  ").append(ctrl).append("(this.ref) : super(").append(state).append("());\n");
        sb.append("  final Ref ref;\n\n");

        if (boundIfcIds.isEmpty()) {
            // Generic stub — no interfaces bound on this screen
            sb.append("  // ── Load data ──────────────────────────────────────────────────────\n");
            sb.append("  // Call this from initState or a button tap.\n");
            sb.append("  Future<void> loadData() async {\n");
            sb.append("    try {\n");
            sb.append("      final response = await AzServer.instance.get('/api/...');\n\n");
            sb.append("      if (!response.success) {\n");
            sb.append("        AzLogger.error('").append(screenName).append(" error: ${response.error}');\n");
            sb.append("        return;\n");
            sb.append("      }\n\n");
            sb.append("      final data = response.data;\n\n");
            sb.append("      AzPainter.paint(\n");
            sb.append("        screenId:    '").append(screenName).append("',\n");
            sb.append("        interfaceId: 'myInterface',\n");
            sb.append("        data:        data,\n");
            sb.append("      );\n");
            sb.append("    } catch (e) {\n");
            sb.append("      AzLogger.error('").append(screenName).append(" exception: $e');\n");
            sb.append("    }\n");
            sb.append("  }\n\n");
        } else {
            // One method per bound interface with real URL
            for (String ifcId : boundIfcIds) {
                InterfaceDef ifc  = ifcMap.get(ifcId);
                String ifcName    = ifc != null ? ifc.name()   : ifcId;
                String httpMethod = ifc != null ? ifc.method()  : "get";
                String urlPath    = ifc != null ? ifc.urlPath() : "/api/unknown";

                String methodName = "load"
                        + Character.toUpperCase(ifcName.charAt(0)) + ifcName.substring(1);
                String paramsExpr = buildParamsExpression(
                        ifc != null ? ifc.params() : java.util.List.of());

                sb.append("  // ── ").append(ifcName)
                        .append(" ──────────────────────────────────────────────────\n");
                sb.append("  // Fetches data from: ").append(httpMethod.toUpperCase())
                        .append(" ").append(urlPath).append("\n");
                sb.append("  Future<void> ").append(methodName).append("() async {\n");
                sb.append("    try {\n");
                sb.append("      // Step 1 — Call the server\n");
                if (paramsExpr.isEmpty()) {
                    sb.append("      final response = await AzServer.instance.")
                            .append(httpMethod).append("('").append(urlPath).append("');\n\n");
                } else {
                    sb.append("      final response = await AzServer.instance.")
                            .append(httpMethod).append("(\n");
                    sb.append("        '").append(urlPath).append("',\n");
                    sb.append("        ").append(paramsExpr).append(",\n");
                    sb.append("      );\n\n");
                }
                sb.append("      if (!response.success) {\n");
                sb.append("        AzLogger.error('").append(ifcName)
                        .append(" failed: ${response.error}');\n");
                sb.append("        return;\n");
                sb.append("      }\n\n");
                sb.append("      // Step 2 — Process the response however you need\n");
                sb.append("      final data = response.data;\n\n");
                sb.append("      // Step 3 — Paint: maps data to widgets bound to '")
                        .append(ifcName).append("'\n");
                sb.append("      AzPainter.paint(\n");
                sb.append("        screenId:    '").append(screenName).append("',\n");
                sb.append("        interfaceId: '").append(ifcName).append("',\n");
                sb.append("        data:        data,\n");
                sb.append("      );\n");
                sb.append("    } catch (e) {\n");
                sb.append("      AzLogger.error('").append(methodName).append(" exception: $e');\n");
                sb.append("    }\n");
                sb.append("  }\n\n");
            }
        }

        sb.append("}\n\n");
        sb.append("class ").append(state).append(" {\n");
        sb.append("  ").append(state).append("();\n");
        sb.append("}\n\n");
        sb.append("final ").append(prov)
                .append(" = StateNotifierProvider<").append(ctrl)
                .append(", ").append(state).append(">(\n");
        sb.append("  (ref) => ").append(ctrl).append("(ref),\n");
        sb.append(");\n");
        return sb.toString();
    }

    /**
     * Builds Dart params map literal from BODY params only.
     * e.g. [{name:"customerId", location:"body"}] → "{'customerId': _customerIdCtrl.text}"
     * Returns "" if no body params (caller skips the map argument).
     */
    private String buildParamsExpression(
            java.util.List<java.util.Map<String, Object>> params) {
        if (params == null || params.isEmpty()) return "";
        java.util.List<java.util.Map<String, Object>> bodyParams = params.stream()
                .filter(p -> "body".equalsIgnoreCase(
                        (String) p.getOrDefault("location", "body")))
                .collect(java.util.stream.Collectors.toList());
        if (bodyParams.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (java.util.Map<String, Object> p : bodyParams) {
            String name = (String) p.getOrDefault("name", "");
            if (name.isBlank()) continue;
            if (!first) sb.append(", ");
            first = false;
            sb.append("'").append(name).append("': _").append(name).append("Ctrl.text");
        }
        sb.append("}");
        return first ? "" : sb.toString();
    }

    /**
     * Backward-compat delegate: builds interface stub without URL injection.
     * Used by legacy call sites that don't have ifcMap available.
     */
    private String buildInterfaceControllerStub(String screenName, String snakePkg,
                                                java.util.List<String> boundIfcIds) {
        return buildControllerStub(screenName, snakePkg,
                java.util.Map.of(), boundIfcIds);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WIDGET CLASS + PLACEHOLDER BUILDERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generates a minimal compilable ConsumerStatefulWidget for a screen
     * when the developer's dart file only contains controller code.
     */
    private String buildScreenWidgetClass(String screenName, String snakePkg) {
        String title = screenName.replace("Screen", "");
        return "import 'package:flutter/material.dart';\n"
                + "import 'package:flutter_riverpod/flutter_riverpod.dart';\n"
                + "import 'package:go_router/go_router.dart';\n"
                + "import 'package:" + snakePkg + "/appzillon/appzillon.dart';\n\n"
                + "/// Auto-generated Widget class for " + screenName + ".\n"
                + "/// The business logic lives in the " + title + "Controller below.\n"
                + "class " + screenName + " extends ConsumerStatefulWidget {\n"
                + "  const " + screenName + "({super.key});\n"
                + "  @override\n"
                + "  ConsumerState<" + screenName + "> createState() => _" + screenName + "State();\n"
                + "}\n\n"
                + "class _" + screenName + "State extends ConsumerState<" + screenName + "> {\n"
                + "  @override\n"
                + "  Widget build(BuildContext context) {\n"
                + "    return Scaffold(\n"
                + "      backgroundColor: const Color(0xFF0F172A),\n"
                + "      appBar: AppBar(\n"
                + "        backgroundColor: const Color(0xFF0F172A),\n"
                + "        foregroundColor: Colors.white,\n"
                + "        title: const Text('" + title + "',\n"
                + "            style: TextStyle(fontWeight: FontWeight.w700)),\n"
                + "      ),\n"
                + "      body: const Center(\n"
                + "        child: Text('" + title + " — wire UI in Canvas tab',\n"
                + "            style: TextStyle(color: Colors.white54)),\n"
                + "      ),\n"
                + "    );\n"
                + "  }\n"
                + "}\n";
    }

    private String buildPlaceholder(String screenName, String snakePkg) {
        String title = screenName.replace("Screen", "");
        return "import 'package:flutter/material.dart';\n"
                + "import 'package:flutter_riverpod/flutter_riverpod.dart';\n"
                + "import 'package:" + snakePkg + "/appzillon/appzillon.dart';\n\n"
                + "class " + screenName + " extends ConsumerWidget {\n"
                + "  const " + screenName + "({super.key});\n"
                + "  @override\n"
                + "  Widget build(BuildContext context, WidgetRef ref) {\n"
                + "    return Scaffold(\n"
                + "      backgroundColor: const Color(0xFF060E1A),\n"
                + "      appBar: AppBar(\n"
                + "        backgroundColor: const Color(0xFF060E1A),\n"
                + "        foregroundColor: Colors.white,\n"
                + "        title: const Text('" + title + "', style: TextStyle(fontWeight: FontWeight.w700)),\n"
                + "      ),\n"
                + "      body: Center(\n"
                + "        child: Column(\n"
                + "          mainAxisAlignment: MainAxisAlignment.center,\n"
                + "          children: const [\n"
                + "            Icon(Icons.phone_android_outlined, size: 64, color: Color(0xFF1E6BFF)),\n"
                + "            SizedBox(height: 16),\n"
                + "            Text('" + title + "',\n"
                + "              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white)),\n"
                + "            SizedBox(height: 8),\n"
                + "            Text('Design in Canvas • Generate Code',\n"
                + "              style: TextStyle(color: Color(0xFF8892A4))),\n"
                + "          ],\n"
                + "        ),\n"
                + "      ),\n"
                + "    );\n"
                + "  }\n"
                + "}\n";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MERGE HELPER — clean, no deduplication hacks
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Produces the final dart file for a screen by merging two clean parts.
     *
     * widgetPart     — DartWidgetCodegen output: imports + widget classes only
     * controllerPart — buildControllerStub() or developer hand-written file:
     *                  imports + controller class + state class + provider
     *
     * Contract: the two parts NEVER contain overlapping class names.
     * Algorithm: dedup imports via LinkedHashSet, concatenate bodies as-is.
     * No regex scanning, no marker dedup, no signature dedup.
     */
    private String mergeImportsAndClasses(String widgetPart, String controllerPart) {
        Set<String> imports = new LinkedHashSet<>();
        StringBuilder widgetBody     = new StringBuilder();
        StringBuilder controllerBody = new StringBuilder();

        for (String line : widgetPart.split("\n", -1)) {
            String t = line.trim();
            if (t.startsWith("import ") || t.startsWith("part ") || t.startsWith("library ")) {
                imports.add(line);
            } else {
                widgetBody.append(line).append("\n");
            }
        }
        for (String line : controllerPart.split("\n", -1)) {
            String t = line.trim();
            if (t.startsWith("import ") || t.startsWith("part ") || t.startsWith("library ")) {
                imports.add(line);
            } else {
                controllerBody.append(line).append("\n");
            }
        }

        StringBuilder out = new StringBuilder();
        imports.forEach(imp -> out.append(imp).append("\n"));
        out.append("\n");
        out.append(widgetBody);
        out.append("\n");
        out.append(controllerBody);
        return out.toString();
    }

    /**
     * Removes named widget classes from a developer hand-written dart file
     * before merging with freshly generated widget code, preventing duplicate
     * class declarations (e.g. LoginScreen declared twice).
     *
     * Uses brace-depth tracking to skip entire class bodies by name.
     * Only called on the hand-written dart file path — generated-only screens
     * never need it.
     */
    private String stripNamedClasses(String src, Set<String> classNames) {
        if (classNames.isEmpty()) return src;
        String[] lines = src.split("\n", -1);
        StringBuilder out = new StringBuilder();
        boolean skipping = false;
        int depth = 0;

        for (String line : lines) {
            int opens = 0, closes = 0;
            for (char c : line.toCharArray()) {
                if (c == '{') opens++;
                else if (c == '}') closes++;
            }
            if (!skipping) {
                if (depth == 0) {
                    String trimmed = line.trim();
                    boolean isTarget = false;
                    for (String name : classNames) {
                        if (trimmed.startsWith("class " + name + " ")
                                || trimmed.startsWith("class " + name + "{")
                                || trimmed.startsWith("class " + name + "<")) {
                            isTarget = true;
                            break;
                        }
                    }
                    if (isTarget) {
                        skipping = true;
                        depth += opens - closes;
                        if (depth <= 0) skipping = false;
                        continue;
                    }
                }
                out.append(line).append("\n");
                depth += opens - closes;
            } else {
                depth += opens - closes;
                if (depth <= 0) { skipping = false; depth = 0; }
            }
        }
        return out.toString();
    }

    private boolean isValidDartId(String name) {
        if (name == null || name.isEmpty()) return false;
        Set<String> keywords = Set.of(
                "true","false","null","void","async","await","return","if","else",
                "for","while","new","const","final","static","late","class","extends",
                "implements","with","super","this","throw","try","catch","in","is","as");
        return !keywords.contains(name) && name.matches("[_a-zA-Z]\\w*");
    }

    private String rewriteSharedClassAliases(String src, Path sharedDir) {
        if (!Files.exists(sharedDir)) return src;
        try (var files = Files.list(sharedDir)) {
            List<String> dartFiles = files
                    .filter(f -> f.toString().endsWith(".dart"))
                    .map(f -> f.getFileName().toString().replace(".dart", ""))
                    .collect(Collectors.toList());
            for (String baseName : dartFiles) {
                String className = toCamelCase(baseName);
                src = src.replaceAll("\\b" + baseName + "\\b", className);
            }
        } catch (Exception ignored) {}
        return src;
    }

    private String toCamelCase(String snake) {
        StringBuilder sb = new StringBuilder();
        boolean cap = true;
        for (char c : snake.toCharArray()) {
            if (c == '_') { cap = true; }
            else { sb.append(cap ? Character.toUpperCase(c) : c); cap = false; }
        }
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AZ_CONFIG INJECTION
    // ─────────────────────────────────────────────────────────────────────────

    private void injectAzConfig(BuildRequest req, Path azDir,
                                SseEmitter sink) throws Exception {
        AppConfig cfg = req.appConfig();
        BuildConfig bld = req.buildConfig();
        String activeEnv = cfg.activeEnv() != null ? cfg.activeEnv() : "dev";
        AppConfig.EnvConfig env = cfg.environments() != null
                ? cfg.environments().getOrDefault(activeEnv,
                new AppConfig.EnvConfig("", "info", false))
                : new AppConfig.EnvConfig(cfg.baseUrl(), cfg.logLevel(), false);

        String baseUrl  = env.baseUrl().isBlank()  ? cfg.baseUrl()  : env.baseUrl();
        String logLevel = env.logLevel().isBlank()  ? cfg.logLevel() : env.logLevel();

        String azConfigDart = """
// ─────────────────────────────────────────────────────────────────────────────
// az_config.dart — AUTO-GENERATED by Appzillon-New IDE
// DO NOT EDIT — regenerated on every build
// ─────────────────────────────────────────────────────────────────────────────

class AzConfig {
  static const String  baseUrl           = '%s';
  static const String  aesKey            = '%s';
  static const bool    encryptValues     = %b;
  static const String  logLevel          = '%s';
  static const int     tokenExpiry       = %d;
  static const int     sessionTimeout    = %d;
  static const int     maxRetries        = %d;
  static const int     splashDuration    = %d;
  static const String  postSplashRoute   = '%s';
  static const bool    biometricEnabled  = %b;
  static const bool    analyticsEnabled  = %b;
  static const bool    debugMode         = %b;
  static const String  fcmSenderId       = '%s';
  static const String  activeEnv         = '%s';
}
""".formatted(
                baseUrl,
                cfg.aesKey() != null ? cfg.aesKey() : "",
                cfg.encryptValues() != null ? cfg.encryptValues() : true,
                logLevel,
                cfg.tokenExpiry() != null ? cfg.tokenExpiry() : 3600,
                cfg.sessionTimeout() != null ? cfg.sessionTimeout() : 1800,
                cfg.maxRetries() != null ? cfg.maxRetries() : 3,
                cfg.splashDuration() != null ? cfg.splashDuration() : 3,
                cfg.postSplashRoute() != null ? cfg.postSplashRoute() : "",
                cfg.biometricEnabled() != null ? cfg.biometricEnabled() : false,
                cfg.analyticsEnabled() != null ? cfg.analyticsEnabled() : false,
                cfg.debugMode() != null ? cfg.debugMode() : false,
                cfg.fcmSenderId() != null ? cfg.fcmSenderId() : "",
                activeEnv
        );
        Files.writeString(azDir.resolve("az_config.dart"), azConfigDart);
        emitSse(sink, "  ✓ az_config.dart (env=" + activeEnv + ", baseUrl=" + baseUrl + ")");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN.DART
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // S7 — ROUTER GENERATION HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds the arguments for DartRouterCodegen.generate() by reading
     * navConnections and screens from app.json, then delegates to DartRouterCodegen.
     */
    @SuppressWarnings("unchecked")
    private String generateRouterDart(BuildRequest req, String snakePkg) throws Exception {
        String initialRoute = req.initialRoute() != null ? req.initialRoute() : "/";

        // ── Load screens from app.json ────────────────────────────────────────
        // Each screen entry: { id, name, route }
        // We need id→route map to resolve navConnections fromId/toId
        java.util.Map<String, String> screenIdToRoute = new java.util.LinkedHashMap<>();
        java.util.Map<String, String> screenIdToName  = new java.util.LinkedHashMap<>();

        Path appJsonPath = Paths.get(req.projectPath()).resolve("app.json");
        java.util.Map<String, Object> appJsonRoot = java.util.Map.of();
        if (Files.exists(appJsonPath)) {
            appJsonRoot = objectMapper.readValue(appJsonPath.toFile(), java.util.Map.class);
        }

        // Parse screens map: screenId → { name, route }
        java.util.Map<String, Object> screensRaw =
                (java.util.Map<String, Object>) appJsonRoot.getOrDefault("screens", java.util.Map.of());
        for (java.util.Map.Entry<String, Object> e : screensRaw.entrySet()) {
            if (!(e.getValue() instanceof java.util.Map<?,?> s)) continue;
            String screenId = e.getKey();

            Map<?, ?> map = (Map<?, ?>) s;
            String name  = String.valueOf(map.containsKey("name") ? map.get("name") : "");
            String route = String.valueOf(map.containsKey("route") ? map.get("route") : "");

           // String name     = String.valueOf(((java.util.Map<?,?>)s).getOrDefault("name",  ""));
           // String route    = String.valueOf(((java.util.Map<?,?>)s).getOrDefault("route", ""));
            if (!name.isEmpty() && !route.isEmpty()) {
                screenIdToName.put(screenId, name);
                screenIdToRoute.put(screenId, route);
            }
        }

        // Build ordered screenEntries from req.screenNames() — canonical order
        List<java.util.Map<String, String>> screenEntries = new java.util.ArrayList<>();
        List<String> screenNames = req.screenNames() != null ? req.screenNames() : List.of();
        java.util.Set<String> addedNames = new java.util.LinkedHashSet<>();

        // First add screens that have entries in app.json screens map (have real routes)
        for (java.util.Map.Entry<String, String> e : screenIdToName.entrySet()) {
            String name  = e.getValue();
            String route = screenIdToRoute.get(e.getKey());
            if (addedNames.add(name)) {
                screenEntries.add(java.util.Map.of("name", name, "route", route));
            }
        }
        // Then add any screenNames from BuildRequest not in app.json screens map
        for (String sName : screenNames) {
            if (addedNames.add(sName)) {
                String route = "/" + sName.replace("Screen", "")
                        .replaceAll("([A-Z])", "-$1").toLowerCase()
                        .replaceAll("^-", "").replaceAll("--+", "-");
                screenEntries.add(java.util.Map.of("name", sName, "route", route));
            }
        }

        // ── Parse navConnections ──────────────────────────────────────────────
        @SuppressWarnings("unchecked")
        List<java.util.Map<String, Object>> navConnsRaw =
                (List<java.util.Map<String, Object>>) appJsonRoot.getOrDefault(
                        "navConnections", List.of());

        List<java.util.Map<String, String>> navConnections = new java.util.ArrayList<>();
        for (java.util.Map<String, Object> nc : navConnsRaw) {
            String fromId     = String.valueOf(nc.getOrDefault("fromId",     ""));
            String toId       = String.valueOf(nc.getOrDefault("toId",       ""));
            String label      = String.valueOf(nc.getOrDefault("label",      "Navigate"));
            String transition = String.valueOf(nc.getOrDefault("transition",  "push"));

            String fromName  = screenIdToName.get(fromId);
            String toName    = screenIdToName.get(toId);
            String toRoute   = screenIdToRoute.get(toId);

            if (fromName == null || toName == null || toRoute == null) {
                log.debug("navConnection skipped — unresolved screenId: fromId={} toId={}", fromId, toId);
                continue;
            }
            navConnections.add(java.util.Map.of(
                    "fromName",   fromName,
                    "toName",     toName,
                    "toRoute",    toRoute,
                    "label",      label,
                    "transition", transition
            ));
        }

        return dartRouterCodegen.generate(snakePkg, initialRoute, screenEntries, navConnections);
    }

    /** Returns the number of screens for the SSE log message. */
    private int countRoutes(BuildRequest req) {
        return req.screenNames() != null ? req.screenNames().size() : 0;
    }

    private String buildMainDart(BuildRequest req, String snakeName) {
        List<String> screenNames = req.screenNames() != null
                ? req.screenNames() : List.of();
        String initialRoute = (req.initialRoute() != null && !req.initialRoute().isBlank())
                ? req.initialRoute() : "/";
        AppConfig cfg = req.appConfig();
        String configuredPostSplash = (cfg != null && cfg.postSplashRoute() != null
                && !cfg.postSplashRoute().isBlank()) ? cfg.postSplashRoute().trim() : null;
        String splashRoute = null, homeRoute = initialRoute;
        String splashClass = null;
        for (int i = 0; i < screenNames.size(); i++) {
            String s = screenNames.get(i);
            if (s.toLowerCase().contains("splash")) {
                splashClass = s;
                splashRoute = "/" + s.replace("Screen","")
                        .replaceAll("([A-Z])", "-$1").toLowerCase()
                        .replaceAll("^-","").replaceAll("--+","-");
                if (configuredPostSplash != null) {
                    homeRoute = configuredPostSplash.startsWith("/")
                            ? configuredPostSplash : "/" + configuredPostSplash;
                } else if (i + 1 < screenNames.size()) {
                    String next = screenNames.get(i + 1);
                    homeRoute = "/" + next.replace("Screen","")
                            .replaceAll("([A-Z])", "-$1").toLowerCase()
                            .replaceAll("^-","").replaceAll("--+","-");
                }
                break;
            }
        }
        StringBuilder screenImports = new StringBuilder();
        StringBuilder routes = new StringBuilder();
        for (String screen : screenNames) {
            screenImports.append("import 'screens/").append(toSnakeCase(screen)).append(".dart';\n");
            String route = "/" + screen.replace("Screen","")
                    .replaceAll("([A-Z])", "-$1").toLowerCase()
                    .replaceAll("^-","").replaceAll("--+","-");
            routes.append("    GoRoute(\n      path: '").append(route).append("',\n");
            if (screen.equals(splashClass)) {
                routes.append("      builder: (context, state) => _AzSplashWrapper(child: const ")
                        .append(screen).append("()),\n    ),\n");
            } else {
                routes.append("      builder: (context, state) => const ")
                        .append(screen).append("(),\n    ),\n");
            }
        }
        if (screenNames.isEmpty()) {
            routes.append("    GoRoute(path: '/', builder: (c,s) => const Scaffold("
                    + "body: Center(child: Text('No screens')))),\n");
        }
        String hr = homeRoute;
        String wrapper = splashClass != null
                ? "\n// _AzSplashWrapper — injected by Appzillon-New IDE\n"
                + "// Sets splash duration from AzConfig and navigates to home route automatically.\n"
                + "class _AzSplashWrapper extends StatefulWidget {\n"
                + "  final Widget child;\n  const _AzSplashWrapper({required this.child});\n"
                + "  @override State<_AzSplashWrapper> createState() => _AzSplashWrapperState();\n}\n"
                + "class _AzSplashWrapperState extends State<_AzSplashWrapper> {\n"
                + "  @override void initState() {\n    super.initState();\n"
                + "    Future.delayed(Duration(seconds: AzConfig.splashDuration > 0 ? AzConfig.splashDuration : 3), () {\n"
                + "      if (mounted) context.go('" + hr + "');\n    });\n  }\n"
                + "  @override Widget build(BuildContext context) => widget.child;\n}\n"
                : "";
        StringBuilder sb = new StringBuilder();
        sb.append("import 'package:flutter/material.dart';\n"
                + "import 'package:flutter_riverpod/flutter_riverpod.dart';\n"
                + "import 'package:go_router/go_router.dart';\n"
                + "import 'appzillon/az_config.dart';\n"
                + "import 'appzillon/az_painter.dart';\n"
                + "import 'router.dart';\n");
        sb.append(screenImports);
        sb.append("\n// AUTO-GENERATED by Appzillon-New IDE\n\n"
                + "void main() {\n"
                + "  WidgetsFlutterBinding.ensureInitialized();\n"
                + "  // Initialise AzPainter so screens can call AzPainter.paint() from controllers\n"
                + "  final container = ProviderContainer();\n"
                + "  AzPainter.init(container);\n"
                + "  runApp(UncontrolledProviderScope(container: container, child: const AppRoot()));\n"
                + "}\n\n");
        // S7: appRouter is defined in the generated router.dart
        // main.dart just imports it
        sb.append("// appRouter is defined in router.dart (auto-generated by Appzillon-New IDE)\n");
        sb.append(wrapper);
        sb.append("\nclass AppRoot extends StatelessWidget {\n"
                + "  const AppRoot({super.key});\n"
                + "  @override\n"
                + "  Widget build(BuildContext context) {\n");
        sb.append("    return MaterialApp.router(\n"
                + "      title: '").append(req.projectName()).append("',\n");
        sb.append("      debugShowCheckedModeBanner: false,\n"
                + "      theme: ThemeData(useMaterial3: true, "
                + "colorSchemeSeed: const Color(0xFF1E6BFF), brightness: Brightness.dark),\n");
        sb.append("      routerConfig: appRouter,\n    );\n  }\n}\n");
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANDROID CONFIG
    // ─────────────────────────────────────────────────────────────────────────

    private void writeAndroidConfig(BuildRequest req, Path projectDir,
                                    String snakePkg, SseEmitter sink) throws Exception {
        String pkg = req.packageName() != null ? req.packageName()
                : "com." + snakePkg.replace("-","_");
        Path mainDir = projectDir.resolve("android/app/src/main");
        Files.createDirectories(mainDir.resolve("res/values"));
        Files.createDirectories(mainDir.resolve("res/drawable"));
        Files.createDirectories(mainDir.resolve("res/mipmap-xxxhdpi"));
        Path javaDir = mainDir.resolve("java");
        for (String part : pkg.split("\\.")) javaDir = javaDir.resolve(part);
        Files.createDirectories(javaDir);

        // strings.xml
        Files.writeString(mainDir.resolve("res/values/strings.xml"),
                "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<resources>\n"
                        + "    <string name=\"app_name\">" + req.projectName() + "</string>\n"
                        + "</resources>\n");

        // AndroidManifest.xml
        Files.writeString(mainDir.resolve("AndroidManifest.xml"),
                "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
                        + "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">\n"
                        + "    <uses-permission android:name=\"android.permission.INTERNET\"/>\n"
                        + "    <uses-permission android:name=\"android.permission.CAMERA\"/>\n"
                        + "    <application\n"
                        + "        android:label=\"@string/app_name\"\n"
                        + "        android:name=\"${applicationName}\"\n"
                        + "        android:icon=\"@mipmap/ic_launcher\">\n"
                        + "        <activity\n"
                        + "            android:name=\".MainActivity\"\n"
                        + "            android:exported=\"true\"\n"
                        + "            android:launchMode=\"singleTop\"\n"
                        + "            android:theme=\"@style/LaunchTheme\">\n"
                        + "            <intent-filter>\n"
                        + "                <action android:name=\"android.intent.action.MAIN\"/>\n"
                        + "                <category android:name=\"android.intent.category.LAUNCHER\"/>\n"
                        + "            </intent-filter>\n"
                        + "        </activity>\n"
                        + "    </application>\n"
                        + "</manifest>\n");

        // build.gradle (app)
        int versionCode = (req.buildConfig() != null && req.buildConfig().versionCode() != null)
                ? req.buildConfig().versionCode() : 1;
        String versionName = (req.buildConfig() != null && req.buildConfig().versionName() != null)
                ? req.buildConfig().versionName() : "1.0.0";
        Files.writeString(projectDir.resolve("android/app/build.gradle"),
                "plugins { id 'com.android.application'; id 'kotlin-android'; id 'dev.flutter.flutter-gradle-plugin' }\n"
                        + "android {\n  namespace '" + pkg + "'\n  compileSdk 34\n"
                        + "  defaultConfig {\n    applicationId '" + pkg + "'\n"
                        + "    minSdk 21\n    targetSdk 34\n"
                        + "    versionCode " + versionCode + "\n    versionName '" + versionName + "'\n  }\n"
                        + "  buildTypes { release { signingConfig signingConfigs.debug } }\n}\n"
                        + "flutter { source '../..' }\n");

        // build.gradle (root)
        Files.createDirectories(projectDir.resolve("android"));
        Files.writeString(projectDir.resolve("android/build.gradle"),
                "allprojects { repositories { google(); mavenCentral() } }\n");

        // MainActivity.kt
        Files.writeString(javaDir.resolve("MainActivity.kt"),
                "package " + pkg + "\nimport io.flutter.embedding.android.FlutterActivity\n"
                        + "class MainActivity : FlutterActivity()\n");

        // settings.gradle
        Files.writeString(projectDir.resolve("android/settings.gradle"),
                "include ':app'\nrootProject.name = '" + snakePkg + "'\n"
                        + "pluginManagement {\n  includeBuild '../build/cache/flutter_tools'\n"
                        + "  repositories { gradlePluginPortal(); google(); mavenCentral() }\n}\n");

        emitSse(sink, "  ✓ Android config");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ASSET COPYING
    // ─────────────────────────────────────────────────────────────────────────

    private void copyAssetsIfPresent(String projectPath, Path projectDir,
                                     SseEmitter sink) throws Exception {
        Path assetsIn = Paths.get(projectPath).resolve("assets");
        if (!Files.exists(assetsIn)) return;
        Path assetsOut = projectDir.resolve("assets");
        Files.createDirectories(assetsOut);
        copyDir(assetsIn, assetsOut);
        emitSse(sink, "  ✓ Assets copied");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FLUTTER COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    private void runFlutterPubGet(Path projectDir, BuildConfig config,
                                  SseEmitter sink) throws Exception {
        String flutter = resolveFlutter(config);
        runCommand(projectDir, sink, flutter, "pub", "get");
    }

    private void runFlutterBuild(Path projectDir, String target, String mode,
                                 BuildConfig config, SseEmitter sink) throws Exception {
        String flutter = resolveFlutter(config);
        String modeFlag = "release".equals(mode) ? "--release" : "--debug";
        runCommand(projectDir, sink, flutter, "build", target, modeFlag);
    }

    private static final boolean IS_WINDOWS =
            System.getProperty("os.name", "").toLowerCase().contains("win");

    /**
     * Resolves the flutter executable path for the current OS.
     *
     * Windows quirks handled:
     *  1. Config may send "...flutter" without ".bat" — ProcessBuilder cannot
     *     run a bare "flutter" on Windows (error=5 Access Denied). Always use
     *     "flutter.bat" on Windows.
     *  2. Config may send just the bin directory — append flutter(.bat).
     *  3. Falls back to "flutter" (on PATH) when no path is configured.
     */
    private String resolveFlutter(BuildConfig config) {
        String fp = (config != null && config.flutterPath() != null)
                ? config.flutterPath().trim() : "";

        if (fp.isBlank()) {
            return "flutter"; // rely on system PATH
        }

        char sep = java.io.File.separatorChar;
        String fpNorm = fp.replace('/', sep).replace('\\', sep);
        if (fpNorm.endsWith(String.valueOf(sep)))
            fpNorm = fpNorm.substring(0, fpNorm.length() - 1);

        if (!IS_WINDOWS) {
            if (Files.isDirectory(Paths.get(fpNorm)))
                return fpNorm + sep + "bin" + sep + "flutter";
            return fpNorm.endsWith(sep + "flutter") ? fpNorm : fpNorm + sep + "flutter";
        }

        // ── Windows: try candidates in order, return first found on disk ──
        // User's path can be any of:
        //   D:\SDK\flutter         ← "flutter" is the SDK ROOT FOLDER
        //   D:\SDK\flutter\bin\flutter.bat  ← full path already
        //   D:\SDK\flutter\bin    ← bin directory
        java.util.List<String> candidates = new java.util.ArrayList<>();

        if (fpNorm.endsWith("flutter.bat")) {
            // Already the exact path
            candidates.add(fpNorm);
        } else if (fpNorm.endsWith(sep + "flutter") || fpNorm.equalsIgnoreCase("flutter")) {
            // "flutter" could be the SDK ROOT directory or the binary name.
            // Check if it's a directory first — if so, binary is inside bin            candidates.add(fpNorm + sep + "bin" + sep + "flutter.bat");  // SDK root → bin            candidates.add(fpNorm + ".bat");                              // binary path → add .bat
            // Also try parentin\ in case it's the binlutter path
            int lastSep = fpNorm.lastIndexOf(sep);
            if (lastSep > 0)
                candidates.add(fpNorm.substring(0, lastSep) + sep + "bin" + sep + "flutter.bat");
        } else {
            // Directory or other path
            candidates.add(fpNorm + sep + "bin" + sep + "flutter.bat");
            candidates.add(fpNorm + sep + "flutter.bat");
            candidates.add(fpNorm + ".bat");
        }

        for (String c : candidates) {
            if (Files.exists(Paths.get(c))) {
                log.info("Flutter resolved: {}", c);
                return c;
            }
        }
        log.warn("Flutter not found at '{}'. Tried: {}. Using PATH.", fp, candidates);
        return "flutter";
    }


    /**
     * Runs an external command, streaming output to the SSE sink.
     *
     * Windows note: flutter.bat must be invoked via cmd.exe /c to correctly
     * inherit the shell environment (PATH, JAVA_HOME etc.) and to allow .bat
     * files to be executed by ProcessBuilder without Access Denied errors.
     */
    private void runCommand(Path dir, SseEmitter sink, String... cmd) throws Exception {
        ProcessBuilder pb;

        if (IS_WINDOWS) {
            // On Windows, build a single command string for cmd.exe /c.
            // This avoids the "not recognized" error that occurs when ProcessBuilder
            // passes a full backslash path as a separate array element to cmd.exe.
            // The outer quotes around the whole command are required by cmd.exe /c
            // when the executable path itself is quoted.
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < cmd.length; i++) {
                if (i > 0) sb.append(' ');
                // Quote arguments that contain spaces or backslashes (paths)
                String arg = cmd[i];
                if (arg.contains(" ") || arg.contains("\\")) {
                    sb.append('\"').append(arg).append('\"');
                } else {
                    sb.append(arg);
                }
            }
            String cmdLine = sb.toString();
            log.info("Running: cmd.exe /c {}", cmdLine);
            // cmd.exe /c "whole command string" — outer quotes required when inner quotes present
            pb = new ProcessBuilder("cmd.exe", "/c", cmdLine);

            // Propagate PATH and JAVA_HOME so flutter.bat can find the JDK
            java.util.Map<String, String> env = pb.environment();
            String sysPath = System.getenv("PATH");
            if (sysPath != null && !sysPath.isBlank()) env.put("PATH", sysPath);
            String javaHome = System.getProperty("java.home");
            if (javaHome != null) env.put("JAVA_HOME", javaHome);
        } else {
            log.info("Running: {}", String.join(" ", cmd));
            pb = new ProcessBuilder(cmd);
        }

        pb.directory(dir.toFile());
        pb.redirectErrorStream(true);

        Process proc = pb.start();
        StringBuilder outputCapture = new StringBuilder();
        try (var reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(proc.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                log.info("[flutter] {}", line);
                outputCapture.append(line).append("\n");
                if (!line.contains("w: file://") && !line.contains("Note: ")) {
                    emitSse(sink, line);
                }
            }
        }
        int exit = proc.waitFor();
        if (exit != 0) {
            log.error("Command failed (exit {}). Full output:\n{}", exit, outputCapture);
            throw new RuntimeException("Command failed (exit " + exit + "): "
                    + String.join(" ", cmd));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OUTPUT COPY
    // ─────────────────────────────────────────────────────────────────────────

    private void copyBuildOutput(Path projectDir, String target, String mode,
                                 Path outputDir,
                                 SseEmitter sink) {
        try {
            Path src = switch (target) {
                case "apk"  -> projectDir.resolve("build/app/outputs/flutter-apk");
                case "aab"  -> projectDir.resolve("build/app/outputs/bundle/"
                        + mode + "Release");
                case "ipa"  -> projectDir.resolve("build/ios/archive");
                case "web"  -> projectDir.resolve("build/web");
                default     -> projectDir.resolve("build");
            };
            if (Files.exists(src)) {
                Path dest = outputDir.resolve(target);
                Files.createDirectories(dest);
                copyDir(src, dest);
                emitSse(sink, "  ✓ Output copied to " + dest);
            }
        } catch (Exception e) { log.warn("Copy output error: {}", e.getMessage()); }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBSPEC
    // ─────────────────────────────────────────────────────────────────────────

    private String buildPubspec(BuildRequest req) {
        String snakeName = toSnakeCase(req.projectName());
        String version   = (req.buildConfig() != null && req.buildConfig().versionName() != null)
                ? req.buildConfig().versionName() : "1.0.0";
        int vCode = (req.buildConfig() != null && req.buildConfig().versionCode() != null)
                ? req.buildConfig().versionCode() : 1;
        StringBuilder sb = new StringBuilder();
        sb.append("name: ").append(snakeName).append("\n");
        sb.append("description: ").append(req.projectName())
                .append(" — built with Appzillon-New IDE\n");
        sb.append("version: ").append(version).append("+").append(vCode).append("\n");
        sb.append("publish_to: none\n\nenvironment:\n"
                + "  sdk: '>=3.0.0 <4.0.0'\n  flutter: '>=3.10.0'\n\n");
        sb.append("dependencies:\n  flutter:\n    sdk: flutter\n");
        sb.append("  flutter_riverpod: ^2.4.9\n  go_router: ^12.1.3\n");
        sb.append("  shared_preferences: ^2.2.2\n  http: ^1.2.0\n  crypto: ^3.0.3\n");
        sb.append("  image_picker: ^1.0.7\n");
        sb.append("  google_fonts: ^6.1.0\n");
        sb.append("  intl: ^0.19.0\n");
        sb.append("  device_info_plus: ^9.1.2\n");
        sb.append("  package_info_plus: ^5.0.1\n");
        sb.append("  lottie: ^3.0.0\n");
        sb.append("  fl_chart: ^0.67.0\n");
        sb.append("  local_auth: ^2.1.8\n\n");
        // Extra dependencies from project
        if (req.projectDependencies() != null) {
            req.projectDependencies().forEach((k, v) -> {
                if (!Set.of("flutter","flutter_riverpod","go_router","shared_preferences",
                        "http","crypto","image_picker","google_fonts","intl",
                        "device_info_plus","package_info_plus","lottie","fl_chart",
                        "local_auth").contains(k)) {
                    sb.append("  ").append(k).append(": ^").append(v).append("\n");
                }
            });
        }
        sb.append("\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n");
        sb.append("  flutter_lints: ^3.0.0\n\nflutter:\n  uses-material-design: true\n");
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    private static void copyDir(Path src, Path dest) throws IOException {
        Files.walkFileTree(src, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs)
                    throws IOException {
                Files.createDirectories(dest.resolve(src.relativize(dir)));
                return FileVisitResult.CONTINUE;
            }
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                    throws IOException {
                Files.copy(file, dest.resolve(src.relativize(file)),
                        StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void deleteDir(Path dir) {
        try {
            Files.walkFileTree(dir, new SimpleFileVisitor<>() {
                @Override public FileVisitResult visitFile(Path f, BasicFileAttributes a)
                        throws IOException { Files.delete(f); return FileVisitResult.CONTINUE; }
                @Override public FileVisitResult postVisitDirectory(Path d, IOException e)
                        throws IOException { Files.delete(d); return FileVisitResult.CONTINUE; }
            });
        } catch (Exception ignored) {}
    }

    private static String toSnakeCase(String name) {
        return name.replaceAll("[^a-zA-Z0-9]", "_")
                .replaceAll("([A-Z])", "_$1")
                .toLowerCase()
                .replaceAll("^_", "")
                .replaceAll("__+", "_");
    }

    private static void emitSse(SseEmitter sink, String data) {
        try {
            sink.send(SseEmitter.event().data("data: " + data + "\n\n"));
        } catch (Exception ignored) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REQUEST / RESPONSE RECORDS
    // ─────────────────────────────────────────────────────────────────────────

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record BuildRequest(
            String projectPath,
            String projectName,
            String packageName,
            AppConfig appConfig,
            BuildConfig buildConfig,
            List<String> screenNames,
            String initialRoute,
            Map<String, String> projectDependencies
    ) {}

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record AppConfig(
            String  baseUrl,
            String  aesKey,
            Boolean encryptValues,
            String  logLevel,
            Integer tokenExpiry,
            Integer sessionTimeout,
            Integer maxRetries,
            Integer splashDuration,
            String  postSplashRoute,
            Boolean biometricEnabled,
            Boolean analyticsEnabled,
            Boolean debugMode,
            String  fcmSenderId,
            String  activeEnv,
            Map<String, EnvConfig> environments
    ) {
        public record EnvConfig(String baseUrl, String logLevel, boolean mockMode) {}
    }

    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record BuildConfig(
            // Tool paths
            String  flutterPath,
            String  androidSdkPath,
            String  javaHome,
            String  xcodePath,
            String  mavenPath,
            String  antPath,
            // Build settings
            String  buildMode,
            List<String> targets,
            // Versioning
            String  versionName,
            Integer versionCode,
            // Android signing
            String  keystore,
            String  keystoreAlias,
            String  keystorePassword,
            String  keyPassword,
            // iOS signing
            String  provisioningProfile,
            String  appleTeamId,
            // Output
            Boolean debugMode,
            String  outputDir
    ) {}
}
