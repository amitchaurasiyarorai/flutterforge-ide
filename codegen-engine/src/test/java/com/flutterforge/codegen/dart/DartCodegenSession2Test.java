package com.flutterforge.codegen.dart;

import com.flutterforge.codegen.validator.DartCodegenValidator;
import com.flutterforge.model.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.*;

import static org.assertj.core.api.Assertions.*;

/**
 * Session 2 — Dart Codegen Tests
 * Verifies that generated Dart code is valid and contains expected patterns.
 */
@SpringBootTest
@DisplayName("Session 2 — Dart Codegen Tests")
class DartCodegenSession2Test {

    @Autowired DartStateCodegen     stateCodegen;
    @Autowired DartApiClientCodegen apiClientCodegen;
    @Autowired DartRouterCodegen    routerCodegen;
    @Autowired DartThemeCodegen     themeCodegen;
    @Autowired DartCodegenValidator validator;

    // ─────────────────────────────────────────────────────────
    // DartStateCodegen Tests
    // ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DartStateCodegen")
    class StateCodegenTests {

        @Test
        @DisplayName("generates StateProvider with correct name and type")
        void stateProvider_correctNameAndType() {
            ProviderDefinition p = new ProviderDefinition();
            p.setName("counterProvider");
            p.setType("state");
            p.setStateType("int");
            p.setInitialValue("0");

            String code = stateCodegen.generateProvider(p);

            assertThat(code).contains("final counterProvider");
            assertThat(code).contains("StateProvider<int>");
            assertThat(code).contains("return 0;");
            assertThat(code).contains("flutter_riverpod");
        }

        @Test
        @DisplayName("generates StateNotifierProvider with notifier class")
        void stateNotifierProvider_hasNotifierClass() {
            ProviderDefinition p = new ProviderDefinition();
            p.setName("userProvider");
            p.setType("stateNotifier");
            p.setStateType("String");
            p.setInitialValue("''");

            String code = stateCodegen.generateProvider(p);

            assertThat(code).contains("StateNotifierProvider<UserNotifier, String>");
            assertThat(code).contains("class UserNotifier extends StateNotifier<String>");
            assertThat(code).contains("void update(String newState)");
            assertThat(code).contains("void reset()");
        }

        @Test
        @DisplayName("generates AsyncNotifierProvider with build method")
        void asyncNotifierProvider_hasBuildMethod() {
            ProviderDefinition p = new ProviderDefinition();
            p.setName("productsProvider");
            p.setType("asyncNotifier");
            p.setStateType("Product");

            String code = stateCodegen.generateProvider(p);

            assertThat(code).contains("AsyncNotifierProvider<ProductsNotifier, Product>");
            assertThat(code).contains("Future<Product> build()");
            assertThat(code).contains("Future<void> refresh()");
            assertThat(code).contains("AsyncValue.loading()");
            assertThat(code).contains("AsyncValue.guard");
        }

        @Test
        @DisplayName("generates FutureProvider")
        void futureProvider_generated() {
            ProviderDefinition p = new ProviderDefinition();
            p.setName("ordersProvider");
            p.setType("future");
            p.setStateType("Order");

            String code = stateCodegen.generateProvider(p);

            assertThat(code).contains("FutureProvider<List<Order>>");
            assertThat(code).contains("async");
        }

        @Test
        @DisplayName("generates barrel file with all provider exports")
        void barrel_containsAllExports() {
            List<ProviderDefinition> providers = List.of(
                providerDef("authProvider", "state", "bool"),
                providerDef("userProvider", "stateNotifier", "User"),
                providerDef("ordersProvider", "future", "Order")
            );

            String barrel = stateCodegen.generateBarrel(providers);

            assertThat(barrel).contains("export 'auth_provider.dart'");
            assertThat(barrel).contains("export 'user_provider.dart'");
            assertThat(barrel).contains("export 'orders_provider.dart'");
        }

        @Test
        @DisplayName("generated StateProvider passes validation")
        void stateProvider_passesValidation() {
            ProviderDefinition p = providerDef("testProvider", "state", "String");
            p.setInitialValue("''");
            String code = stateCodegen.generateProvider(p);
            var result = validator.validate(code, "test_provider.dart");
            assertThat(result.errors()).isEmpty();
        }
    }

    // ─────────────────────────────────────────────────────────
    // DartApiClientCodegen Tests
    // ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DartApiClientCodegen")
    class ApiClientCodegenTests {

        @Test
        @DisplayName("generates client class with correct name")
        void client_hasCorrectClassName() {
            ServiceDefinition svc = buildService();
            String code = apiClientCodegen.generateClient(svc);

            assertThat(code).contains("class UserServiceClient");
            assertThat(code).contains("final Dio _dio");
            assertThat(code).contains("Provider<UserServiceClient>");
        }

        @Test
        @DisplayName("generates method per operation")
        void client_hasMethodPerOperation() {
            ServiceDefinition svc = buildService();
            String code = apiClientCodegen.generateClient(svc);

            assertThat(code).contains("Future<GetUsersResponse> getUsers");
            assertThat(code).contains("Future<GetUserByIdResponse> getUserById");
            assertThat(code).contains("_dio.get(");
        }

        @Test
        @DisplayName("generates path parameters correctly")
        void client_interpolatesPathParams() {
            ServiceDefinition svc = buildService();
            String code = apiClientCodegen.generateClient(svc);

            assertThat(code).contains("required String id");
            assertThat(code).contains("/users/$id");
        }

        @Test
        @DisplayName("generates model classes")
        void models_generated() {
            ServiceDefinition svc = buildService();
            String code = apiClientCodegen.generateModels(svc);

            assertThat(code).contains("@JsonSerializable()");
            assertThat(code).contains("class GetUsersResponse");
            assertThat(code).contains("fromJson");
            assertThat(code).contains("toJson");
            assertThat(code).contains("class PagedResponse<T>");
        }

        @Test
        @DisplayName("generates barrel with client and model exports")
        void barrel_hasClientAndModelExports() {
            ServiceDefinition svc = buildService();
            String barrel = apiClientCodegen.generateBarrel(List.of(svc));

            assertThat(barrel).contains("user_service_client.dart");
            assertThat(barrel).contains("user_service_models.dart");
        }
    }

    // ─────────────────────────────────────────────────────────
    // DartRouterCodegen Tests
    // ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DartRouterCodegen")
    class RouterCodegenTests {

        @Test
        @DisplayName("generates appRouter with all screen routes")
        void router_hasAllRoutes() {
            FlutterForgeProject project = buildProject();
            String code = routerCodegen.generate(project);

            assertThat(code).contains("final appRouter = GoRouter(");
            assertThat(code).contains("initialLocation: '/home'");
            assertThat(code).contains("path: '/home'");
            assertThat(code).contains("path: '/login'");
        }

        @Test
        @DisplayName("generates AppRoutes constants class")
        void router_hasRouteConstants() {
            FlutterForgeProject project = buildProject();
            String code = routerCodegen.generate(project);

            assertThat(code).contains("abstract class AppRoutes");
            assertThat(code).contains("static const String");
        }

        @Test
        @DisplayName("generates routerProvider for Riverpod")
        void router_hasRiverpodProvider() {
            FlutterForgeProject project = buildProject();
            String code = routerCodegen.generate(project);

            assertThat(code).contains("final routerProvider = Provider<GoRouter>");
        }

        @Test
        @DisplayName("generates 404 fallback route")
        void router_has404Fallback() {
            FlutterForgeProject project = buildProject();
            String code = routerCodegen.generate(project);

            assertThat(code).contains("path: '/404'");
            assertThat(code).contains("_NotFoundScreen");
            assertThat(code).contains("errorBuilder:");
        }

        @Test
        @DisplayName("generates slide transition when configured")
        void router_slideTransition() {
            FlutterForgeProject project = buildProject();
            project.getScreens().values().iterator().next().setTransitions("slide");
            String code = routerCodegen.generate(project);

            assertThat(code).contains("SlideTransition");
            assertThat(code).contains("CustomTransitionPage");
        }
    }

    // ─────────────────────────────────────────────────────────
    // DartThemeCodegen Tests
    // ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DartThemeCodegen")
    class ThemeCodegenTests {

        @Test
        @DisplayName("generates light and dark themes")
        void theme_hasLightAndDark() {
            FlutterForgeProject.AppTheme theme = new FlutterForgeProject.AppTheme();
            theme.setPrimaryColor(Map.of("hex", "#6200EA"));
            theme.setUseMaterial3(true);

            String code = themeCodegen.generate(theme);

            assertThat(code).contains("get lightTheme");
            assertThat(code).contains("get darkTheme");
            assertThat(code).contains("useMaterial3: true");
            assertThat(code).contains("Brightness.light");
            assertThat(code).contains("Brightness.dark");
        }

        @Test
        @DisplayName("uses correct primary color hex")
        void theme_correctPrimaryColor() {
            FlutterForgeProject.AppTheme theme = new FlutterForgeProject.AppTheme();
            theme.setPrimaryColor(Map.of("hex", "#FF5722"));
            theme.setUseMaterial3(true);

            String code = themeCodegen.generate(theme);

            assertThat(code).contains("Color(0xFFFF5722)");
        }

        @Test
        @DisplayName("generates themeModeFromString helper")
        void theme_hasModeHelper() {
            String code = themeCodegen.generate(null);
            assertThat(code).contains("themeModeFromString");
            assertThat(code).contains("ThemeMode.light");
            assertThat(code).contains("ThemeMode.dark");
            assertThat(code).contains("ThemeMode.system");
        }

        @Test
        @DisplayName("generated theme passes validation")
        void theme_passesValidation() {
            FlutterForgeProject.AppTheme theme = new FlutterForgeProject.AppTheme();
            theme.setPrimaryColor(Map.of("hex", "#2196F3"));
            theme.setUseMaterial3(true);

            String code = themeCodegen.generate(theme);
            var result = validator.validate(code, "app_theme.dart");
            assertThat(result.errors()).isEmpty();
        }
    }

    // ─────────────────────────────────────────────────────────
    // DartCodegenValidator Tests
    // ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("DartCodegenValidator")
    class ValidatorTests {

        @Test
        @DisplayName("detects unbalanced braces")
        void validator_detectsUnbalancedBraces() {
            String badCode = "class Foo { void bar() { return; }";
            var result = validator.validate(badCode, "foo.dart");
            assertThat(result.errors()).anyMatch(e -> e.contains("unbalanced braces"));
        }

        @Test
        @DisplayName("passes valid Dart")
        void validator_passesValidDart() {
            String goodCode = """
                    import 'package:flutter/material.dart';
                    class MyWidget extends StatelessWidget {
                      const MyWidget({super.key});
                      @override
                      Widget build(BuildContext context) {
                        return const Text('Hello');
                      }
                    }
                    """;
            var result = validator.validate(goodCode, "my_widget.dart");
            assertThat(result.errors()).isEmpty();
        }

        @Test
        @DisplayName("warns about missing flutter import")
        void validator_warnsMissingImport() {
            String code = "class Foo extends StatelessWidget { Widget build(BuildContext c) => Text(''); }";
            var result = validator.validate(code, "foo.dart");
            assertThat(result.warnings()).anyMatch(w -> w.contains("flutter/material.dart"));
        }
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────

    private ProviderDefinition providerDef(String name, String type, String stateType) {
        ProviderDefinition p = new ProviderDefinition();
        p.setName(name);
        p.setType(type);
        p.setStateType(stateType);
        return p;
    }

    private ServiceDefinition buildService() {
        ServiceDefinition svc = new ServiceDefinition();
        svc.setId("svc_user");
        svc.setName("UserService");
        svc.setBaseUrl("http://localhost:8081");

        ServiceDefinition.ServiceOperation listOp = new ServiceDefinition.ServiceOperation();
        listOp.setId("op_list"); listOp.setName("getUsers");
        listOp.setMethod("GET"); listOp.setPath("/api/v1/users");

        ServiceDefinition.ServiceOperation getOp = new ServiceDefinition.ServiceOperation();
        getOp.setId("op_get"); getOp.setName("getUserById");
        getOp.setMethod("GET"); getOp.setPath("/api/v1/users/{id}");
        getOp.setPathParams(List.of(Map.of("name","id","type","UUID","required",true)));

        svc.setOperations(List.of(listOp, getOp));
        return svc;
    }

    private FlutterForgeProject buildProject() {
        FlutterForgeProject project = new FlutterForgeProject();
        project.setId("proj_test");
        project.setName("TestApp");
        project.setPackageName("com.test.app");
        project.setVersion("1.0.0");
        project.setInitialRoute("/home");

        ScreenDefinition homeScreen = new ScreenDefinition();
        homeScreen.setId("screen_home");
        homeScreen.setName("HomeScreen");
        homeScreen.setRoute("/home");

        ScreenDefinition loginScreen = new ScreenDefinition();
        loginScreen.setId("screen_login");
        loginScreen.setName("LoginScreen");
        loginScreen.setRoute("/login");

        Map<String, ScreenDefinition> screens = new LinkedHashMap<>();
        screens.put("screen_home",  homeScreen);
        screens.put("screen_login", loginScreen);
        project.setScreens(screens);

        FlutterForgeProject.AppTheme theme = new FlutterForgeProject.AppTheme();
        theme.setPrimaryColor(Map.of("hex","#6200EA"));
        theme.setUseMaterial3(true);
        project.setTheme(theme);

        return project;
    }
}
