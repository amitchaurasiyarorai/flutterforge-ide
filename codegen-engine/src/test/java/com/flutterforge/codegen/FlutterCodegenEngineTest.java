package com.flutterforge.codegen;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flutterforge.codegen.engine.FlutterCodegenEngine;
import com.flutterforge.codegen.model.ScreenDef;
import com.flutterforge.codegen.model.WidgetNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FlutterCodegenEngineTest
 *
 * Verifies the codegen engine produces valid Dart output
 * for every major widget type.
 *
 * Run with: mvn test
 */
class FlutterCodegenEngineTest {

    private FlutterCodegenEngine engine;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        engine = new FlutterCodegenEngine();
        objectMapper = new ObjectMapper();
    }

    // ── Widget rendering tests ────────────────────────────

    @Test
    @DisplayName("Text widget with string props generates valid Dart")
    void textWidget() {
        WidgetNode node = node("Text", Map.of("text", "Hello FlutterForge"));
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("Text(");
        assertThat(dart).contains("Hello FlutterForge");
    }

    @Test
    @DisplayName("Text widget with state binding uses ref.watch")
    void textWidgetWithStateBinding() {
        WidgetNode node = node("Text", Map.of("text", ""));
        WidgetNode.StateBinding binding = new WidgetNode.StateBinding();
        binding.setProvider("userProfileProvider");
        binding.setField("user.name");
        binding.setWatchOrRead("watch");
        node.setStateBinding(binding);
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("ref.watch(userProfileProvider).user.name");
    }

    @Test
    @DisplayName("ElevatedButton generates onPressed lambda")
    void elevatedButton() {
        WidgetNode node = node("ElevatedButton", Map.of("label", "Sign In"));
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("ElevatedButton(");
        assertThat(dart).contains("onPressed:");
        assertThat(dart).contains("Sign In");
    }

    @Test
    @DisplayName("Column with children renders children list")
    void columnWithChildren() {
        WidgetNode child1 = node("Text", Map.of("text", "First"));
        WidgetNode child2 = node("Text", Map.of("text", "Second"));
        WidgetNode column = node("Column", Map.of("mainAxisAlignment", "center"));
        column.setChildren(List.of(child1, child2));
        String dart = engine.renderWidget(column, 0);
        assertThat(dart).contains("Column(");
        assertThat(dart).contains("mainAxisAlignment: MainAxisAlignment.center");
        assertThat(dart).contains("children: [");
        assertThat(dart).contains("First");
        assertThat(dart).contains("Second");
    }

    @Test
    @DisplayName("Container with color generates Color object")
    void containerWithColor() {
        WidgetNode node = node("Container", Map.of(
                "color", Map.of("hex", "#2196F3"),
                "padding", Map.of("all", 16)
        ));
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("Container(");
        assertThat(dart).contains("0xFF2196F3");
        assertThat(dart).contains("EdgeInsets.all(16");
    }

    @Test
    @DisplayName("TextField generates InputDecoration with label and hint")
    void textField() {
        WidgetNode node = node("TextField", Map.of(
                "label", "Email address",
                "hint", "you@example.com",
                "keyboardType", "email",
                "prefixIcon", "email"
        ));
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("TextField(");
        assertThat(dart).contains("labelText: 'Email address'");
        assertThat(dart).contains("hintText: 'you@example.com'");
        assertThat(dart).contains("keyboardType: TextInputType.email");
        assertThat(dart).contains("prefixIcon: Icon(Icons.email)");
    }

    @Test
    @DisplayName("Scaffold finds AppBar child and places it correctly")
    void scaffoldWithAppBar() {
        WidgetNode appBar = node("AppBar", Map.of("title", "My Screen", "centerTitle", true));
        WidgetNode body = node("Center", Map.of());
        WidgetNode scaffold = node("Scaffold", Map.of());
        scaffold.setChildren(List.of(appBar, body));
        String dart = engine.renderWidget(scaffold, 0);
        assertThat(dart).contains("Scaffold(");
        assertThat(dart).contains("appBar: AppBar(");
        assertThat(dart).contains("body: Center(");
        assertThat(dart).contains("title: Text('My Screen')");
        assertThat(dart).contains("centerTitle: true");
    }

    @Test
    @DisplayName("SizedBox with infinity renders double.infinity")
    void sizedBoxInfinity() {
        WidgetNode node = node("SizedBox", Map.of("width", "infinity", "height", 48));
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("width: double.infinity");
        assertThat(dart).contains("height: 48");
    }

    @Test
    @DisplayName("Icon renders correct Material icon name")
    void iconWidget() {
        WidgetNode node = node("Icon", Map.of("icon", "accountCircle", "size", 32));
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("Icons.account_circle");
        assertThat(dart).contains("size: 32");
    }

    @Test
    @DisplayName("Card with elevation and borderRadius")
    void cardWidget() {
        WidgetNode child = node("Text", Map.of("text", "Card content"));
        WidgetNode card = node("Card", Map.of("elevation", 4, "borderRadius", 12));
        card.setChildren(List.of(child));
        String dart = engine.renderWidget(card, 0);
        assertThat(dart).contains("Card(");
        assertThat(dart).contains("elevation: 4");
        assertThat(dart).contains("BorderRadius.circular(12");
    }

    @Test
    @DisplayName("Unknown widget type returns safe fallback")
    void unknownWidgetType() {
        WidgetNode node = node("UnknownWidget", Map.of());
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("SizedBox.shrink()");
        assertThat(dart).contains("unknown: UnknownWidget");
    }

    @Test
    @DisplayName("Conditional render wraps widget in if expression")
    void conditionalRender() {
        WidgetNode node = node("Text", Map.of("text", "Only when logged in"));
        WidgetNode.ConditionalRender cr = new WidgetNode.ConditionalRender();
        cr.setProvider("authProvider");
        cr.setField("isLoggedIn");
        cr.setCondition("truthy");
        node.setConditionalRender(cr);
        String dart = engine.renderWidget(node, 0);
        assertThat(dart).contains("if (ref.watch(authProvider).isLoggedIn)");
    }

    // ── Screen generation tests ───────────────────────────

    @Test
    @DisplayName("Full screen generates class with ConsumerStatefulWidget")
    void fullScreenGeneration() {
        ScreenDef screen = new ScreenDef();
        screen.setId("scr_login01");
        screen.setName("LoginScreen");
        screen.setRoutePath("/login");

        WidgetNode scaffold = node("Scaffold", Map.of("backgroundColor", Map.of("hex", "#FFFFFF")));
        WidgetNode appBar = node("AppBar", Map.of("title", "Sign In"));
        scaffold.setChildren(List.of(appBar));
        screen.setRootWidget(scaffold);

        String dart = engine.generateScreen(screen);

        assertThat(dart).contains("class LoginScreen extends ConsumerStatefulWidget");
        assertThat(dart).contains("class _LoginScreenState extends ConsumerState<LoginScreen>");
        assertThat(dart).contains("import 'package:flutter/material.dart'");
        assertThat(dart).contains("import 'package:flutter_riverpod/flutter_riverpod.dart'");
        assertThat(dart).contains("Widget build(BuildContext context)");
        assertThat(dart).contains("Scaffold(");
    }

    @Test
    @DisplayName("Screen with route params generates constructor params")
    void screenWithRouteParams() {
        ScreenDef screen = new ScreenDef();
        screen.setId("scr_profile01");
        screen.setName("ProfileScreen");
        screen.setRoutePath("/profile/:userId");
        screen.setRouteParams(List.of("userId"));
        screen.setRootWidget(node("Scaffold", Map.of()));

        String dart = engine.generateScreen(screen);
        assertThat(dart).contains("final String userId");
        assertThat(dart).contains("required this.userId");
    }

    // ── Helper ────────────────────────────────────────────

    private WidgetNode node(String type, Map<String, Object> props) {
        WidgetNode n = new WidgetNode();
        n.setId("wgt_test01");
        n.setType(type);
        n.setProps(props);
        return n;
    }
}
