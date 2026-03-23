package com.flutterforge.codegen.dart;

import com.flutterforge.model.*;
import com.flutterforge.model.FlutterForgeProject;
import com.flutterforge.model.ScreenDefinition;
import com.flutterforge.model.WidgetNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Generates Dart/Flutter screen code from ScreenDefinition + WidgetNode tree.
 *
 * Each screen becomes a ConsumerStatefulWidget (Riverpod).
 * Widget tree is rendered recursively from the rootWidgetId.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DartWidgetCodegen {

    private static final String INDENT = "  ";

    // ────────────────────────────────────────────────────────
    // SCREEN GENERATION
    // ────────────────────────────────────────────────────────

    public String generateScreen(ScreenDefinition screen, FlutterForgeProject project) {
        StringBuilder sb = new StringBuilder();
        String className = screen.getName();
        String snakeName = toSnakeCase(className);
        String pkgName   = toSnakeCase(project.getName());

        // Imports
        appendImports(sb, pkgName, screen, project);
        sb.append("\n");

        // Screen class
        sb.append("class ").append(className)
          .append(" extends ConsumerStatefulWidget {\n");
        sb.append("  const ").append(className).append("({super.key});\n\n");
        sb.append("  @override\n");
        sb.append("  ConsumerState<").append(className).append("> createState() =>\n");
        sb.append("      _").append(className).append("State();\n");
        sb.append("}\n\n");

        // State class
        sb.append("class _").append(className).append("State")
          .append(" extends ConsumerState<").append(className).append("> {\n\n");

        // TextEditingControllers for TextFields
        appendControllerDeclarations(sb, screen);

        // initState / dispose
        appendLifecycleMethods(sb, screen);

        // build method
        sb.append("  @override\n");
        sb.append("  Widget build(BuildContext context) {\n");

        // Provider watches
        appendProviderWatches(sb, screen, project);

        // root widget
        WidgetNode root = screen.getWidgets().get(screen.getRootWidgetId());
        if (root != null) {
            sb.append("    return ").append(generateWidget(root, screen, 2)).append(";\n");
        } else {
            sb.append("    return const Scaffold(body: Center(child: Text('Empty screen')));\n");
        }

        sb.append("  }\n\n");

        // Helper methods
        appendHelperMethods(sb, screen, project);

        sb.append("}\n");

        return sb.toString();
    }

    // ────────────────────────────────────────────────────────
    // WIDGET TREE RENDERER
    // ────────────────────────────────────────────────────────

    public String generateWidget(WidgetNode node, ScreenDefinition screen, int indentLevel) {
        if (node == null) return "const SizedBox.shrink()";

        String indent = INDENT.repeat(indentLevel);

        return switch (node.getType()) {
            case "flutter.widgets.Scaffold"             -> genScaffold(node, screen, indentLevel);
            case "flutter.widgets.AppBar"               -> genAppBar(node, screen, indentLevel);
            case "flutter.widgets.Container"            -> genContainer(node, screen, indentLevel);
            case "flutter.widgets.Row"                  -> genRowColumn("Row", node, screen, indentLevel);
            case "flutter.widgets.Column"               -> genRowColumn("Column", node, screen, indentLevel);
            case "flutter.widgets.Stack"                -> genStack(node, screen, indentLevel);
            case "flutter.widgets.Expanded"             -> genExpanded(node, screen, indentLevel);
            case "flutter.widgets.Padding"              -> genPadding(node, screen, indentLevel);
            case "flutter.widgets.Center"               -> genCenter(node, screen, indentLevel);
            case "flutter.widgets.SizedBox"             -> genSizedBox(node, indentLevel);
            case "flutter.widgets.Text"                 -> genText(node, indentLevel);
            case "flutter.widgets.TextField"            -> genTextField(node, indentLevel);
            case "flutter.widgets.ElevatedButton"       -> genButton("ElevatedButton", node, screen, indentLevel);
            case "flutter.widgets.TextButton"           -> genButton("TextButton", node, screen, indentLevel);
            case "flutter.widgets.OutlinedButton"       -> genButton("OutlinedButton", node, screen, indentLevel);
            case "flutter.widgets.IconButton"           -> genIconButton(node, indentLevel);
            case "flutter.widgets.Icon"                 -> genIcon(node, indentLevel);
            case "flutter.widgets.Image"                -> genImage(node, indentLevel);
            case "flutter.widgets.Card"                 -> genCard(node, screen, indentLevel);
            case "flutter.widgets.ListView"             -> genListView(node, screen, indentLevel);
            case "flutter.widgets.GridView"             -> genGridView(node, screen, indentLevel);
            case "flutter.widgets.ListTile"             -> genListTile(node, screen, indentLevel);
            case "flutter.widgets.Checkbox"             -> genCheckbox(node, indentLevel);
            case "flutter.widgets.Switch"               -> genSwitch(node, indentLevel);
            case "flutter.widgets.Slider"               -> genSlider(node, indentLevel);
            case "flutter.widgets.CircleAvatar"         -> genCircleAvatar(node, indentLevel);
            case "flutter.widgets.Divider"              -> genDivider(node, indentLevel);
            case "flutter.widgets.FloatingActionButton" -> genFAB(node, indentLevel);
            case "flutter.widgets.BottomNavigationBar"  -> genBottomNav(node, indentLevel);
            case "flutter.widgets.TabBar"               -> genTabBar(node, indentLevel);
            case "flutter.widgets.FutureBuilder"        -> genFutureBuilder(node, screen, indentLevel);
            case "flutter.widgets.StreamBuilder"        -> genStreamBuilder(node, screen, indentLevel);
            default -> indent + "const SizedBox.shrink() /* unknown: " + node.getType() + " */";
        };
    }

    // ────────────────────────────────────────────────────────
    // INDIVIDUAL WIDGET GENERATORS
    // ────────────────────────────────────────────────────────

    private String genScaffold(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        StringBuilder sb = new StringBuilder("Scaffold(\n");

        // appBar child
        getChildOfType(node, screen, "flutter.widgets.AppBar").ifPresent(appBar ->
            sb.append(i(ind+1)).append("appBar: ").append(generateWidget(appBar, screen, ind+1)).append(",\n")
        );

        // body — first non-AppBar, non-BottomNav child
        getBodyChild(node, screen).ifPresent(body ->
            sb.append(i(ind+1)).append("body: ").append(generateWidget(body, screen, ind+1)).append(",\n")
        );

        // bottomNavigationBar
        getChildOfType(node, screen, "flutter.widgets.BottomNavigationBar").ifPresent(nav ->
            sb.append(i(ind+1)).append("bottomNavigationBar: ").append(generateWidget(nav, screen, ind+1)).append(",\n")
        );

        // floatingActionButton
        getChildOfType(node, screen, "flutter.widgets.FloatingActionButton").ifPresent(fab ->
            sb.append(i(ind+1)).append("floatingActionButton: ").append(generateWidget(fab, screen, ind+1)).append(",\n")
        );

        if (props.containsKey("backgroundColor")) {
            sb.append(i(ind+1)).append("backgroundColor: ").append(colorExpr(props.get("backgroundColor"))).append(",\n");
        }

        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genAppBar(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        StringBuilder sb = new StringBuilder("AppBar(\n");

        if (props.containsKey("title")) {
            sb.append(i(ind+1)).append("title: Text(").append(strLiteral(props.get("title"))).append("),\n");
        }
        if (props.containsKey("backgroundColor")) {
            sb.append(i(ind+1)).append("backgroundColor: ").append(colorExpr(props.get("backgroundColor"))).append(",\n");
        }
        if (Boolean.TRUE.equals(props.get("centerTitle"))) {
            sb.append(i(ind+1)).append("centerTitle: true,\n");
        }
        if (props.containsKey("elevation")) {
            sb.append(i(ind+1)).append("elevation: ").append(props.get("elevation")).append(",\n");
        }

        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genContainer(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        boolean hasChild = node.getChildren() != null && !node.getChildren().isEmpty();
        StringBuilder sb = new StringBuilder("Container(\n");

        if (props.containsKey("width"))   sb.append(i(ind+1)).append("width: ").append(numExpr(props.get("width"))).append(",\n");
        if (props.containsKey("height"))  sb.append(i(ind+1)).append("height: ").append(numExpr(props.get("height"))).append(",\n");
        if (props.containsKey("padding")) sb.append(i(ind+1)).append("padding: ").append(edgeInsetsExpr(props.get("padding"))).append(",\n");
        if (props.containsKey("margin"))  sb.append(i(ind+1)).append("margin: ").append(edgeInsetsExpr(props.get("margin"))).append(",\n");
        if (props.containsKey("alignment")) sb.append(i(ind+1)).append("alignment: ").append(alignmentExpr(props.get("alignment"))).append(",\n");

        if (props.containsKey("decoration")) {
            sb.append(i(ind+1)).append("decoration: ").append(decorationExpr(props.get("decoration"))).append(",\n");
        } else if (props.containsKey("color")) {
            sb.append(i(ind+1)).append("color: ").append(colorExpr(props.get("color"))).append(",\n");
        }

        if (hasChild) {
            WidgetNode child = getFirstChild(node, screen);
            if (child != null) {
                sb.append(i(ind+1)).append("child: ").append(generateWidget(child, screen, ind+1)).append(",\n");
            }
        }

        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genRowColumn(String type, WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        StringBuilder sb = new StringBuilder(type + "(\n");

        String maa = (String) props.getOrDefault("mainAxisAlignment", "start");
        String caa = (String) props.getOrDefault("crossAxisAlignment", "center");
        sb.append(i(ind+1)).append("mainAxisAlignment: MainAxisAlignment.").append(maa).append(",\n");
        sb.append(i(ind+1)).append("crossAxisAlignment: CrossAxisAlignment.").append(caa).append(",\n");

        if (props.containsKey("mainAxisSize")) {
            sb.append(i(ind+1)).append("mainAxisSize: MainAxisSize.").append(props.get("mainAxisSize")).append(",\n");
        }

        sb.append(i(ind+1)).append("children: [\n");
        appendChildren(sb, node, screen, ind+2);
        sb.append(i(ind+1)).append("],\n");
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genStack(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        StringBuilder sb = new StringBuilder("Stack(\n");
        if (props.containsKey("alignment")) {
            sb.append(i(ind+1)).append("alignment: ").append(alignmentExpr(props.get("alignment"))).append(",\n");
        }
        sb.append(i(ind+1)).append("children: [\n");
        appendChildren(sb, node, screen, ind+2);
        sb.append(i(ind+1)).append("],\n");
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genExpanded(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        WidgetNode child = getFirstChild(node, screen);
        int flex = props.containsKey("flex") ? ((Number) props.get("flex")).intValue() : 1;
        return "Expanded(\n" + i(ind+1) + "flex: " + flex + ",\n" +
               i(ind+1) + "child: " + (child != null ? generateWidget(child, screen, ind+1) : "const SizedBox.shrink()") + ",\n" +
               i(ind) + ")";
    }

    private String genPadding(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        WidgetNode child = getFirstChild(node, screen);
        String padding = props.containsKey("padding")
                ? edgeInsetsExpr(props.get("padding"))
                : "const EdgeInsets.all(8)";
        return "Padding(\n" + i(ind+1) + "padding: " + padding + ",\n" +
               i(ind+1) + "child: " + (child != null ? generateWidget(child, screen, ind+1) : "const SizedBox.shrink()") + ",\n" +
               i(ind) + ")";
    }

    private String genCenter(WidgetNode node, ScreenDefinition screen, int ind) {
        WidgetNode child = getFirstChild(node, screen);
        return "Center(\n" + i(ind+1) + "child: " +
               (child != null ? generateWidget(child, screen, ind+1) : "const SizedBox.shrink()") +
               ",\n" + i(ind) + ")";
    }

    private String genSizedBox(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String w = props.containsKey("width")  ? "width: "  + numExpr(props.get("width"))  + ", " : "";
        String h = props.containsKey("height") ? "height: " + numExpr(props.get("height")) + ", " : "";
        if (w.isEmpty() && h.isEmpty()) return "const SizedBox()";
        return "const SizedBox(" + w + h + ")";
    }

    private String genText(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String data = (String) props.getOrDefault("data", "");
        // State ref interpolation: "Hello {{user.name}}" → 'Hello ${ref.watch(userProvider).name}'
        String dartText = resolveTextRef(data);
        StringBuilder sb = new StringBuilder("Text(\n");
        sb.append(i(ind+1)).append(dartText).append(",\n");
        if (props.containsKey("style")) {
            sb.append(i(ind+1)).append("style: ").append(textStyleExpr(props.get("style"))).append(",\n");
        }
        if (props.containsKey("textAlign")) {
            sb.append(i(ind+1)).append("textAlign: TextAlign.").append(props.get("textAlign")).append(",\n");
        }
        if (props.containsKey("maxLines")) {
            sb.append(i(ind+1)).append("maxLines: ").append(props.get("maxLines")).append(",\n");
            sb.append(i(ind+1)).append("overflow: TextOverflow.ellipsis,\n");
        }
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genTextField(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String ctrlName = (String) props.getOrDefault("controllerName", "_" + node.getId().replace("-","").substring(0,8) + "Controller");
        StringBuilder sb = new StringBuilder("TextField(\n");
        sb.append(i(ind+1)).append("controller: ").append(ctrlName).append(",\n");
        if (props.containsKey("labelText")) sb.append(i(ind+1)).append("decoration: InputDecoration(\n")
            .append(i(ind+2)).append("labelText: ").append(strLiteral(props.get("labelText"))).append(",\n");
        if (props.containsKey("hintText"))  sb.append(i(ind+2)).append("hintText: ").append(strLiteral(props.get("hintText"))).append(",\n");
        if (props.containsKey("labelText") || props.containsKey("hintText")) sb.append(i(ind+1)).append("),\n");
        if (Boolean.TRUE.equals(props.get("obscureText"))) sb.append(i(ind+1)).append("obscureText: true,\n");
        if (props.containsKey("keyboardType")) {
            sb.append(i(ind+1)).append("keyboardType: ").append(keyboardTypeExpr(props.get("keyboardType"))).append(",\n");
        }
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genButton(String type, WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        String label = (String) props.getOrDefault("label", "Button");
        String onTap = buildOnTapCallback(node);
        WidgetNode child = getFirstChild(node, screen);

        return type + "(\n" +
               i(ind+1) + "onPressed: " + onTap + ",\n" +
               i(ind+1) + "child: " + (child != null ? generateWidget(child, screen, ind+1) : "Text(" + strLiteral(label) + ")") + ",\n" +
               i(ind) + ")";
    }

    private String genIconButton(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String icon = (String) props.getOrDefault("icon", "Icons.more_vert");
        return "IconButton(\n" + i(ind+1) + "icon: Icon(" + icon + "),\n" +
               i(ind+1) + "onPressed: " + buildOnTapCallback(node) + ",\n" +
               i(ind) + ")";
    }

    private String genIcon(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String icon = (String) props.getOrDefault("icon", "Icons.info");
        String size = props.containsKey("size") ? ", size: " + props.get("size") : "";
        String color = props.containsKey("color") ? ", color: " + colorExpr(props.get("color")) : "";
        return "Icon(" + icon + size + color + ")";
    }

    private String genImage(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String src = (String) props.getOrDefault("src", "");
        String fit = (String) props.getOrDefault("fit", "cover");
        boolean isAsset = src.startsWith("assets/");
        String constructor = isAsset ? "Image.asset" : "Image.network";
        return constructor + "(\n" + i(ind+1) + strLiteral(src) + ",\n" +
               i(ind+1) + "fit: BoxFit." + fit + ",\n" +
               i(ind) + ")";
    }

    private String genCard(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        WidgetNode child = getFirstChild(node, screen);
        StringBuilder sb = new StringBuilder("Card(\n");
        if (props.containsKey("elevation")) sb.append(i(ind+1)).append("elevation: ").append(props.get("elevation")).append(",\n");
        if (props.containsKey("color"))     sb.append(i(ind+1)).append("color: ").append(colorExpr(props.get("color"))).append(",\n");
        if (child != null) sb.append(i(ind+1)).append("child: ").append(generateWidget(child, screen, ind+1)).append(",\n");
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genListView(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        boolean hasDynamic = node.getRepeatFor() != null;

        if (hasDynamic) {
            // ListView.builder from state list
            String listRef = node.getRepeatFor();
            WidgetNode template = getFirstChild(node, screen);
            return "ListView.builder(\n" +
                   i(ind+1) + "itemCount: " + listRef + ".length,\n" +
                   i(ind+1) + "itemBuilder: (context, index) {\n" +
                   i(ind+2) + "final item = " + listRef + "[index];\n" +
                   i(ind+2) + "return " + (template != null ? generateWidget(template, screen, ind+2) : "const SizedBox.shrink()") + ";\n" +
                   i(ind+1) + "},\n" +
                   i(ind) + ")";
        }

        // Static children
        return "ListView(\n" +
               i(ind+1) + "children: [\n" +
               buildChildrenList(node, screen, ind+2) +
               i(ind+1) + "],\n" +
               i(ind) + ")";
    }

    private String genGridView(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        int crossCount = props.containsKey("crossAxisCount")
                ? ((Number) props.get("crossAxisCount")).intValue() : 2;
        return "GridView.count(\n" +
               i(ind+1) + "crossAxisCount: " + crossCount + ",\n" +
               i(ind+1) + "children: [\n" +
               buildChildrenList(node, screen, ind+2) +
               i(ind+1) + "],\n" +
               i(ind) + ")";
    }

    private String genListTile(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        StringBuilder sb = new StringBuilder("ListTile(\n");
        if (props.containsKey("title"))    sb.append(i(ind+1)).append("title: Text(").append(strLiteral(props.get("title"))).append("),\n");
        if (props.containsKey("subtitle")) sb.append(i(ind+1)).append("subtitle: Text(").append(strLiteral(props.get("subtitle"))).append("),\n");
        if (props.containsKey("leading"))  sb.append(i(ind+1)).append("leading: Icon(").append(props.get("leading")).append("),\n");
        sb.append(i(ind+1)).append("onTap: ").append(buildOnTapCallback(node)).append(",\n");
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genCheckbox(WidgetNode node, int ind) {
        return "Checkbox(\n" + i(ind+1) + "value: false,\n" + i(ind+1) + "onChanged: (v) {},\n" + i(ind) + ")";
    }

    private String genSwitch(WidgetNode node, int ind) {
        return "Switch(\n" + i(ind+1) + "value: false,\n" + i(ind+1) + "onChanged: (v) {},\n" + i(ind) + ")";
    }

    private String genSlider(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        double min = props.containsKey("min") ? ((Number)props.get("min")).doubleValue() : 0.0;
        double max = props.containsKey("max") ? ((Number)props.get("max")).doubleValue() : 100.0;
        return "Slider(\n" + i(ind+1) + "value: 50.0,\n" +
               i(ind+1) + "min: " + min + ",\n" +
               i(ind+1) + "max: " + max + ",\n" +
               i(ind+1) + "onChanged: (v) {},\n" + i(ind) + ")";
    }

    private String genCircleAvatar(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        double radius = props.containsKey("radius") ? ((Number)props.get("radius")).doubleValue() : 24.0;
        String bg = props.containsKey("backgroundColor") ? "backgroundColor: " + colorExpr(props.get("backgroundColor")) + ",\n" + i(ind+1) : "";
        return "CircleAvatar(\n" + i(ind+1) + bg + "radius: " + radius + ",\n" + i(ind) + ")";
    }

    private String genDivider(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String thickness = props.containsKey("thickness") ? "thickness: " + props.get("thickness") + "," : "";
        return "const Divider(" + thickness + ")";
    }

    private String genFAB(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        String icon = (String) props.getOrDefault("icon", "Icons.add");
        String tooltip = (String) props.getOrDefault("tooltip", "");
        return "FloatingActionButton(\n" +
               i(ind+1) + "onPressed: " + buildOnTapCallback(node) + ",\n" +
               (tooltip.isEmpty() ? "" : i(ind+1) + "tooltip: " + strLiteral(tooltip) + ",\n") +
               i(ind+1) + "child: Icon(" + icon + "),\n" +
               i(ind) + ")";
    }

    private String genBottomNav(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) props.getOrDefault("items", List.of());
        StringBuilder sb = new StringBuilder("BottomNavigationBar(\n");
        sb.append(i(ind+1)).append("currentIndex: 0,\n");
        sb.append(i(ind+1)).append("onTap: (index) {},\n");
        sb.append(i(ind+1)).append("items: [\n");
        for (Map<String, Object> item : items) {
            sb.append(i(ind+2)).append("BottomNavigationBarItem(\n");
            sb.append(i(ind+3)).append("icon: Icon(").append(item.getOrDefault("icon","Icons.home")).append("),\n");
            sb.append(i(ind+3)).append("label: ").append(strLiteral(item.getOrDefault("label",""))).append(",\n");
            sb.append(i(ind+2)).append("),\n");
        }
        sb.append(i(ind+1)).append("],\n");
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genTabBar(WidgetNode node, int ind) {
        Map<String, Object> props = getProps(node);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tabs = (List<Map<String, Object>>) props.getOrDefault("tabs", List.of());
        StringBuilder sb = new StringBuilder("TabBar(\n" + i(ind+1) + "tabs: [\n");
        for (Map<String, Object> tab : tabs) {
            sb.append(i(ind+2)).append("Tab(text: ").append(strLiteral(tab.getOrDefault("label",""))).append("),\n");
        }
        sb.append(i(ind+1)).append("],\n").append(i(ind)).append(")");
        return sb.toString();
    }

    private String genFutureBuilder(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        String future = (String) props.getOrDefault("futureProvider", "Future.value(null)");
        return "FutureBuilder(\n" +
               i(ind+1) + "future: " + future + ",\n" +
               i(ind+1) + "builder: (context, snapshot) {\n" +
               i(ind+2) + "if (snapshot.connectionState == ConnectionState.waiting) {\n" +
               i(ind+3) + "return const Center(child: CircularProgressIndicator());\n" +
               i(ind+2) + "}\n" +
               i(ind+2) + "if (snapshot.hasError) {\n" +
               i(ind+3) + "return Center(child: Text('Error: \\${snapshot.error}'));\n" +
               i(ind+2) + "}\n" +
               i(ind+2) + "return const SizedBox.shrink(); // TODO: render data widget\n" +
               i(ind+1) + "},\n" +
               i(ind) + ")";
    }

    private String genStreamBuilder(WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        String stream = (String) props.getOrDefault("streamProvider", "Stream.empty()");
        return "StreamBuilder(\n" +
               i(ind+1) + "stream: ref.watch(" + stream + "),\n" +
               i(ind+1) + "builder: (context, snapshot) {\n" +
               i(ind+2) + "if (!snapshot.hasData) {\n" +
               i(ind+3) + "return const Center(child: CircularProgressIndicator());\n" +
               i(ind+2) + "}\n" +
               i(ind+2) + "return const SizedBox.shrink(); // TODO: render data widget\n" +
               i(ind+1) + "},\n" +
               i(ind) + ")";
    }

    // ────────────────────────────────────────────────────────
    // SCREEN-LEVEL HELPERS
    // ────────────────────────────────────────────────────────

    private void appendImports(StringBuilder sb, String pkgName,
                                ScreenDefinition screen, FlutterForgeProject project) {
        sb.append("import 'package:flutter/material.dart';\n");
        sb.append("import 'package:flutter_riverpod/flutter_riverpod.dart';\n");
        sb.append("import 'package:go_router/go_router.dart';\n");
        sb.append("import 'package:").append(pkgName).append("/providers/providers.dart';\n");
        sb.append("import 'package:").append(pkgName).append("/services/services.dart';\n");
    }

    private void appendControllerDeclarations(StringBuilder sb, ScreenDefinition screen) {
        for (WidgetNode node : screen.getWidgets().values()) {
            if ("flutter.widgets.TextField".equals(node.getType())) {
                Map<String, Object> props = getProps(node);
                String ctrl = (String) props.getOrDefault("controllerName",
                        "_" + node.getId().replace("-","").substring(0,8) + "Controller");
                sb.append("  final TextEditingController ").append(ctrl)
                  .append(" = TextEditingController();\n");
            }
        }
        sb.append("\n");
    }

    private void appendLifecycleMethods(StringBuilder sb, ScreenDefinition screen) {
        boolean hasControllers = screen.getWidgets().values().stream()
                .anyMatch(n -> "flutter.widgets.TextField".equals(n.getType()));
        if (!hasControllers) return;

        sb.append("  @override\n  void dispose() {\n");
        for (WidgetNode node : screen.getWidgets().values()) {
            if ("flutter.widgets.TextField".equals(node.getType())) {
                Map<String, Object> props = getProps(node);
                String ctrl = (String) props.getOrDefault("controllerName",
                        "_" + node.getId().replace("-","").substring(0,8) + "Controller");
                sb.append("    ").append(ctrl).append(".dispose();\n");
            }
        }
        sb.append("    super.dispose();\n  }\n\n");
    }

    private void appendProviderWatches(StringBuilder sb, ScreenDefinition screen,
                                        FlutterForgeProject project) {
        if (screen.getStateProviders() == null) return;
        for (String providerName : screen.getStateProviders()) {
            String varName = providerName.replace("Provider", "").toLowerCase();
            sb.append("    final ").append(varName).append(" = ref.watch(")
              .append(providerName).append(");\n");
        }
        if (!screen.getStateProviders().isEmpty()) sb.append("\n");
    }

    private void appendHelperMethods(StringBuilder sb, ScreenDefinition screen,
                                      FlutterForgeProject project) {
        // Generate _onSubmit / _onTap helpers for service-bound events
        for (WidgetNode node : screen.getWidgets().values()) {
            if (node.getEvents() != null && node.getEvents().getOnTap() instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> tap = (Map<String, Object>) node.getEvents().getOnTap();
                if (tap.containsKey("serviceId")) {
                    String methodName = "_on" + capitalize((String) tap.getOrDefault("operation","action"));
                    sb.append("  Future<void> ").append(methodName).append("() async {\n");
                    sb.append("    // TODO: call ").append(tap.get("serviceId"))
                      .append(".").append(tap.get("operation")).append("\n");
                    sb.append("  }\n\n");
                }
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // EXPRESSION BUILDERS
    // ────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String colorExpr(Object colorObj) {
        if (colorObj instanceof String s) return s; // already a Dart expression
        if (colorObj instanceof Map<?,?> map) {
            String hex = (String) ((Map<String,Object>)map).get("hex");
            if (hex != null) {
                String clean = hex.replace("#","");
                if (clean.length() == 6) clean = "FF" + clean;
                return "const Color(0x" + clean.toUpperCase() + ")";
            }
            Object material = ((Map<String,Object>)map).get("materialColor");
            if (material != null) return (String) material;
        }
        return "Colors.transparent";
    }

    @SuppressWarnings("unchecked")
    private String edgeInsetsExpr(Object obj) {
        if (obj instanceof Map<?,?> map) {
            Map<String,Object> m = (Map<String,Object>) map;
            if (m.containsKey("all")) return "EdgeInsets.all(" + m.get("all") + ")";
            if (m.containsKey("horizontal") || m.containsKey("vertical")) {
                double h = m.containsKey("horizontal") ? ((Number)m.get("horizontal")).doubleValue() : 0;
                double v = m.containsKey("vertical")   ? ((Number)m.get("vertical")).doubleValue()   : 0;
                return "EdgeInsets.symmetric(horizontal: " + h + ", vertical: " + v + ")";
            }
            double t = m.containsKey("top")    ? ((Number)m.get("top")).doubleValue()    : 0;
            double b = m.containsKey("bottom") ? ((Number)m.get("bottom")).doubleValue() : 0;
            double l = m.containsKey("left")   ? ((Number)m.get("left")).doubleValue()   : 0;
            double r = m.containsKey("right")  ? ((Number)m.get("right")).doubleValue()  : 0;
            return "EdgeInsets.fromLTRB(" + l + ", " + t + ", " + r + ", " + b + ")";
        }
        return "EdgeInsets.zero";
    }

    private String alignmentExpr(Object obj) {
        if (obj == null) return "Alignment.center";
        String a = obj.toString();
        return switch (a) {
            case "topLeft"      -> "Alignment.topLeft";
            case "topCenter"    -> "Alignment.topCenter";
            case "topRight"     -> "Alignment.topRight";
            case "centerLeft"   -> "Alignment.centerLeft";
            case "centerRight"  -> "Alignment.centerRight";
            case "bottomLeft"   -> "Alignment.bottomLeft";
            case "bottomCenter" -> "Alignment.bottomCenter";
            case "bottomRight"  -> "Alignment.bottomRight";
            default             -> "Alignment.center";
        };
    }

    @SuppressWarnings("unchecked")
    private String decorationExpr(Object obj) {
        if (!(obj instanceof Map<?,?> map)) return "const BoxDecoration()";
        Map<String,Object> m = (Map<String,Object>) map;
        StringBuilder sb = new StringBuilder("BoxDecoration(\n");
        if (m.containsKey("color"))        sb.append("  color: ").append(colorExpr(m.get("color"))).append(",\n");
        if (m.containsKey("borderRadius")) sb.append("  borderRadius: BorderRadius.circular(").append(getBorderRadiusValue(m.get("borderRadius"))).append("),\n");
        sb.append(")");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private double getBorderRadiusValue(Object obj) {
        if (obj instanceof Map<?,?> map) {
            Object all = ((Map<String,Object>)map).get("all");
            return all != null ? ((Number)all).doubleValue() : 8.0;
        }
        return 8.0;
    }

    @SuppressWarnings("unchecked")
    private String textStyleExpr(Object obj) {
        if (!(obj instanceof Map<?,?> map)) return "const TextStyle()";
        Map<String,Object> m = (Map<String,Object>) map;
        StringBuilder sb = new StringBuilder("TextStyle(");
        if (m.containsKey("fontSize"))   sb.append("fontSize: ").append(m.get("fontSize")).append(", ");
        if (m.containsKey("fontWeight")) sb.append("fontWeight: FontWeight.").append(m.get("fontWeight")).append(", ");
        if (m.containsKey("color"))      sb.append("color: ").append(colorExpr(m.get("color"))).append(", ");
        sb.append(")");
        return sb.toString();
    }

    private String keyboardTypeExpr(Object obj) {
        return switch (obj.toString()) {
            case "number"    -> "TextInputType.number";
            case "email"     -> "TextInputType.emailAddress";
            case "phone"     -> "TextInputType.phone";
            case "url"       -> "TextInputType.url";
            case "multiline" -> "TextInputType.multiline";
            default          -> "TextInputType.text";
        };
    }

    private String numExpr(Object obj) {
        if (obj instanceof Number n) return String.valueOf(n.doubleValue());
        if (obj instanceof String s) {
            if ("match_parent".equals(s)) return "double.infinity";
            if ("wrap_content".equals(s)) return "null";
            return s;
        }
        return "null";
    }

    private String strLiteral(Object obj) {
        if (obj == null) return "''";
        return "'" + obj.toString().replace("'", "\\'") + "'";
    }

    private String resolveTextRef(String text) {
        if (text == null) return "''";
        // Replace {{provider.field}} with ${ref.watch(providerProvider).field}
        String resolved = text.replaceAll("\\{\\{([^}]+)\\}\\}", "\\${$1}");
        return "'" + resolved + "'";
    }

    private String buildOnTapCallback(WidgetNode node) {
        if (node.getEvents() == null || node.getEvents().getOnTap() == null) return "() {}";
        Object tap = node.getEvents().getOnTap();
        if (tap instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> t = (Map<String, Object>) tap;
            if (t.containsKey("route")) return "() => context.push('" + t.get("route") + "')";
            if (t.containsKey("operation")) return "() => _on" + capitalize((String) t.get("operation")) + "()";
        }
        return "() {}";
    }

    // ────────────────────────────────────────────────────────
    // TREE TRAVERSAL HELPERS
    // ────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> getProps(WidgetNode node) {
        if (node.getProps() == null) return Map.of();
        if (node.getProps() instanceof Map<?,?> map) return (Map<String, Object>) map;
        // Fallback: serialize and re-parse — handles typed prop objects
        return Map.of();
    }

    private WidgetNode getFirstChild(WidgetNode node, ScreenDefinition screen) {
        if (node.getChildren() == null || node.getChildren().isEmpty()) return null;
        return screen.getWidgets().get(node.getChildren().get(0));
    }

    private Optional<WidgetNode> getChildOfType(WidgetNode node, ScreenDefinition screen, String type) {
        if (node.getChildren() == null) return Optional.empty();
        return node.getChildren().stream()
                .map(id -> screen.getWidgets().get(id))
                .filter(Objects::nonNull)
                .filter(w -> type.equals(w.getType()))
                .findFirst();
    }

    private Optional<WidgetNode> getBodyChild(WidgetNode node, ScreenDefinition screen) {
        if (node.getChildren() == null) return Optional.empty();
        Set<String> nonBodyTypes = Set.of(
                "flutter.widgets.AppBar",
                "flutter.widgets.BottomNavigationBar",
                "flutter.widgets.FloatingActionButton"
        );
        return node.getChildren().stream()
                .map(id -> screen.getWidgets().get(id))
                .filter(Objects::nonNull)
                .filter(w -> !nonBodyTypes.contains(w.getType()))
                .findFirst();
    }

    private void appendChildren(StringBuilder sb, WidgetNode node, ScreenDefinition screen, int ind) {
        if (node.getChildren() == null) return;
        for (String childId : node.getChildren()) {
            WidgetNode child = screen.getWidgets().get(childId);
            if (child != null) {
                sb.append(i(ind)).append(generateWidget(child, screen, ind)).append(",\n");
            }
        }
    }

    private String buildChildrenList(WidgetNode node, ScreenDefinition screen, int ind) {
        StringBuilder sb = new StringBuilder();
        appendChildren(sb, node, screen, ind);
        return sb.toString();
    }

    // ────────────────────────────────────────────────────────
    // MICRO UTILITIES
    // ────────────────────────────────────────────────────────

    private String i(int level) { return INDENT.repeat(level); }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private String toSnakeCase(String input) {
        if (input == null || input.isBlank()) return input;
        return input.replaceAll("([A-Z]+)([A-Z][a-z])", "$1_$2")
                .replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase()
                .replaceAll("[^a-z0-9_]", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
    }
}
