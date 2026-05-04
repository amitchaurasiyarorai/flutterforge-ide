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

        // ── FutureProvider declarations for API-bound widgets ─────────────────
        appendApiProviders(sb, screen);

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


    /**
     * EN1 Item 2 — Generates a screen dart file that includes an initState() block
     * auto-calling controller methods whose triggerType is "onScreenLoad".
     *
     * How it works:
     *   1. Calls generateScreen(screen, project) to produce the full widget code as normal.
     *   2. Finds the anchor "  @override\n  Widget build(BuildContext context) {" inside
     *      the generated _ScreenNameState class.
     *   3. Inserts the initState() block immediately before that anchor.
     *
     * @param screen                  the screen definition (widgets, name, etc.)
     * @param project                 the project (package name, theme, etc.)
     * @param onLoadMethodNames       method names to call in initState, e.g.
     *                                ["loadGetAccountSummary", "loadGetTransactionHistory"]
     * @param controllerProviderName  Riverpod provider variable name, e.g.
     *                                "dashboardControllerProvider"
     */
    public String generateScreen(ScreenDefinition screen, FlutterForgeProject project,
                                 java.util.List<String> onLoadMethodNames,
                                 String controllerProviderName) {
        // Generate the full screen code using the existing method
        String base = generateScreen(screen, project);

        // Nothing to inject if list is empty
        if (onLoadMethodNames == null || onLoadMethodNames.isEmpty()) {
            return base;
        }

        // The anchor is always present and unique in the generated output.
        // DartWidgetCodegen always emits:
        //   class _ScreenNameState extends ConsumerState<ScreenName> {
        //     @override
        //     Widget build(BuildContext context) {
        //
        // We insert initState() directly before the @override / Widget build line.
        String anchor = "  @override\n  Widget build(BuildContext context) {";
        int idx = base.indexOf(anchor);

        if (idx < 0) {
            // Fallback: try without the opening brace (different formatting edge case)
            anchor = "  @override\n  Widget build(BuildContext context)";
            idx = base.indexOf(anchor);
        }

        if (idx < 0) {
            log.warn("EN1 Item 2: Could not find build() anchor for initState injection in {}",
                    screen.getName());
            return base; // Return unchanged rather than breaking the file
        }

        // Build the initState block
        // Uses WidgetsBinding.instance.addPostFrameCallback because ref.read()
        // called directly in initState() would fail — Riverpod providers are not
        // fully available until after the first frame.
        StringBuilder init = new StringBuilder();
        init.append("  @override\n");
        init.append("  void initState() {\n");
        init.append("    super.initState();\n");
        init.append("    // Auto-triggered by Appzillon-New IDE (triggerType: onScreenLoad)\n");
        init.append("    WidgetsBinding.instance.addPostFrameCallback((_) {\n");
        for (String methodName : onLoadMethodNames) {
            init.append("      ref.read(")
                    .append(controllerProviderName)
                    .append(".notifier).")
                    .append(methodName)
                    .append("();\n");
        }
        init.append("    });\n");
        init.append("  }\n\n");

        // Splice: everything before anchor + initState block + everything from anchor onward
        return base.substring(0, idx) + init + base.substring(idx);
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
            case "flutter.widgets.SafeArea"              -> genSafeArea(node, screen, indentLevel);
            case "flutter.widgets.SingleChildScrollView"  -> genScrollView(node, screen, indentLevel);
            case "flutter.widgets.Spacer"                 -> genSpacer(node, indentLevel);
            case "flutter.widgets.AspectRatio"            -> genAspectRatio(node, screen, indentLevel);
            case "flutter.widgets.ClipRRect"              -> genClipRRect(node, screen, indentLevel);
            case "flutter.widgets.Opacity"                -> genOpacity(node, screen, indentLevel);
            case "flutter.widgets.RichText"               -> genRichText(node, indentLevel);
            case "flutter.widgets.Badge"                  -> genBadge(node, screen, indentLevel);
            case "flutter.widgets.Chip"                   -> genChip(node, indentLevel);
            case "flutter.widgets.LinearProgressIndicator"   -> genLinearProgress(node, indentLevel);
            case "flutter.widgets.CircularProgressIndicator" -> genCircularProgress(node, indentLevel);
            case "flutter.widgets.Tooltip"                -> genTooltip(node, screen, indentLevel);
            case "flutter.widgets.FilledButton"           -> genButton("FilledButton", node, screen, indentLevel);
            case "flutter.widgets.TextFormField"          -> genTextFormField(node, indentLevel);
            case "flutter.widgets.Radio"                  -> genRadio(node, indentLevel);
            case "flutter.widgets.ToggleButtons"          -> genToggleButtons(node, indentLevel);
            case "flutter.widgets.RangeSlider"            -> genRangeSlider(node, indentLevel);
            case "flutter.widgets.DropdownButtonFormField"-> genDropdownFormField(node, indentLevel);
            case "flutter.widgets.SearchBar"              -> genSearchBar(node, indentLevel);
            case "flutter.widgets.DatePicker"             -> genDatePicker(node, indentLevel);
            case "flutter.widgets.TimePicker"             -> genTimePicker(node, indentLevel);
            case "flutter.widgets.NavigationBar"          -> genNavigationBar(node, indentLevel);
            case "flutter.widgets.NavigationRail"         -> genNavigationRail(node, indentLevel);
            case "flutter.widgets.PageView"               -> genPageView(node, screen, indentLevel);
            case "flutter.widgets.ExpansionTile"          -> genExpansionTile(node, screen, indentLevel);
            case "flutter.widgets.AlertDialog"            -> genAlertDialog(node, indentLevel);
            case "flutter.widgets.Stepper"                -> genStepper(node, indentLevel);
            case "flutter.widgets.Wrap"                   -> genWrapWidget(node, screen, indentLevel);
            case "flutter.widgets.ReorderableListView"    -> genReorderableListView(node, screen, indentLevel);
            // ── EN1 Item 4 — 7 previously missing widgets ────────────────────
            case "flutter.widgets.Flexible"         -> genFlexible(node, screen, indentLevel);
            case "flutter.widgets.DropdownButton"   -> genDropdownButton(node, indentLevel);
            case "flutter.widgets.NavigationDrawer" -> genNavigationDrawer(node, screen, indentLevel);
            case "flutter.widgets.TabBarView"       -> genTabBarView(node, screen, indentLevel);
            case "flutter.widgets.Dialog"           -> genDialog(node, screen, indentLevel);
            case "flutter.widgets.BottomSheet"      -> genBottomSheet(node, screen, indentLevel);
            case "flutter.widgets.SnackBar"         -> genSnackBarWidget(node, indentLevel);
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
        if (props.containsKey("foregroundColor")) {
            sb.append(i(ind+1)).append("foregroundColor: ").append(colorExpr(props.get("foregroundColor"))).append(",\n");
        }
        // centerTitle: accept both Boolean and String "true"
        Object ct = props.get("centerTitle");
        if (Boolean.TRUE.equals(ct) || "true".equals(String.valueOf(ct))) {
            sb.append(i(ind+1)).append("centerTitle: true,\n");
        }
        if (props.containsKey("elevation")) {
            sb.append(i(ind+1)).append("elevation: ").append(props.get("elevation")).append(",\n");
        }
        // leading: bool true → back button; string → icon name
        Object leading = props.get("leading");
        if (Boolean.TRUE.equals(leading) || "Icons.arrow_back".equals(leading) || "Icons.arrow_back_ios".equals(leading)) {
            sb.append(i(ind+1)).append("leading: const BackButton(),\n");
        } else if (leading instanceof String && !((String)leading).isBlank()) {
            String leadIcon = ((String)leading).startsWith("Icons.") ? (String)leading : "Icons." + leading;
            sb.append(i(ind+1)).append("leading: IconButton(icon: Icon(").append(leadIcon).append("), onPressed: () => Navigator.pop(context)),\n");
        }
        // actions: list of icon name strings e.g. ["Icons.notifications_outlined", "notifications"]
        if (props.containsKey("actions")) {
            Object actionsObj = props.get("actions");
            if (actionsObj instanceof java.util.List<?> actionsList && !actionsList.isEmpty()) {
                sb.append(i(ind+1)).append("actions: [\n");
                for (Object action : actionsList) {
                    String raw = String.valueOf(action);
                    // Accept both "Icons.xxx" (full) and "xxx" (shorthand)
                    String iconName = raw.startsWith("Icons.") ? raw : "Icons." + raw;
                    sb.append(i(ind+2)).append("IconButton(icon: Icon(").append(iconName)
                            .append("), onPressed: () {}),\n");
                }
                sb.append(i(ind+1)).append("],\n");
            }
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
        // If widget has an apiBinding, emit a live provider reference instead of literal
        String dartText = (node.getApiBinding() != null
                && node.getApiBinding().get("interfaceId") != null
                && !((String)node.getApiBinding().get("interfaceId")).isBlank())
                ? boundValueExpr(node, strLiteral(data))
                : resolveTextRef(data);
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
        String ctrlName = (String) props.getOrDefault("controllerName",
                "_" + node.getId().replace("-","").substring(0, Math.min(8, node.getId().replace("-","").length())) + "Controller");
        StringBuilder sb = new StringBuilder("TextField(\n");
        sb.append(i(ind+1)).append("controller: ").append(ctrlName).append(",\n");
        // Decoration
        boolean hasDecoration = props.containsKey("labelText") || props.containsKey("hintText")
                || props.containsKey("prefixIcon") || props.containsKey("fillColor");
        if (hasDecoration) {
            sb.append(i(ind+1)).append("decoration: InputDecoration(\n");
            if (props.containsKey("labelText"))
                sb.append(i(ind+2)).append("labelText: ").append(strLiteral(props.get("labelText"))).append(",\n");
            if (props.containsKey("hintText"))
                sb.append(i(ind+2)).append("hintText: ").append(strLiteral(props.get("hintText"))).append(",\n");
            if (props.containsKey("prefixIcon")) {
                String rawPfx = String.valueOf(props.get("prefixIcon"));
                String pfxIcon = rawPfx.startsWith("Icons.") ? rawPfx : "Icons." + rawPfx;
                sb.append(i(ind+2)).append("prefixIcon: Icon(").append(pfxIcon).append("),\n");
            }
            if (props.containsKey("fillColor")) {
                sb.append(i(ind+2)).append("filled: true,\n");
                sb.append(i(ind+2)).append("fillColor: ").append(colorExpr(props.get("fillColor"))).append(",\n");
            }
            sb.append(i(ind+1)).append("),\n");
        }
        if (Boolean.TRUE.equals(props.get("obscureText")))
            sb.append(i(ind+1)).append("obscureText: true,\n");
        if (props.containsKey("keyboardType"))
            sb.append(i(ind+1)).append("keyboardType: ").append(keyboardTypeExpr(props.get("keyboardType"))).append(",\n");
        // Events from handlers
        String onSubmitted = buildValueCallback(node, "onSubmitted");
        String onChanged   = buildValueCallback(node, "onChanged");
        if (!"(_) {}".equals(onSubmitted))
            sb.append(i(ind+1)).append("onSubmitted: ").append(onSubmitted).append(",\n");
        if (!"(_) {}".equals(onChanged))
            sb.append(i(ind+1)).append("onChanged: ").append(onChanged).append(",\n");
        sb.append(i(ind)).append(")");
        return sb.toString();
    }

    private String genButton(String type, WidgetNode node, ScreenDefinition screen, int ind) {
        Map<String, Object> props = getProps(node);
        // screen.json stores button text as "text"; fall back to "label" for legacy compatibility
        String label = (String) props.getOrDefault("text",
                props.getOrDefault("label", "Button"));
        String onTap  = buildOnTapCallback(node);
        WidgetNode child = getFirstChild(node, screen);

        // Style properties
        StringBuilder styleArgs = new StringBuilder();
        if (props.containsKey("backgroundColor") || props.containsKey("foregroundColor")) {
            styleArgs.append(i(ind+1)).append("style: ").append(type).append(".styleFrom(\n");
            if (props.containsKey("backgroundColor"))
                styleArgs.append(i(ind+2)).append("backgroundColor: ").append(colorExpr(props.get("backgroundColor"))).append(",\n");
            if (props.containsKey("foregroundColor"))
                styleArgs.append(i(ind+2)).append("foregroundColor: ").append(colorExpr(props.get("foregroundColor"))).append(",\n");
            if (props.containsKey("minimumSize"))
                styleArgs.append(i(ind+2)).append("minimumSize: const Size(double.infinity, 52),\n");
            styleArgs.append(i(ind+1)).append("),\n");
        }

        return type + "(\n" +
                i(ind+1) + "onPressed: " + onTap + ",\n" +
                styleArgs +
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
        // If bound to an API field (e.g. avatar URL), use the provider expression
        boolean hasSrcBinding = node.getApiBinding() != null
                && node.getApiBinding().get("interfaceId") != null
                && !((String)node.getApiBinding().get("interfaceId")).isBlank()
                && "src".equals(node.getApiBinding().get("targetProp"));
        if (hasSrcBinding) {
            String urlExpr = boundValueExpr(node, strLiteral(src));
            return "Image.network(\n" + i(ind+1) + urlExpr + ",\n" +
                    i(ind+1) + "fit: BoxFit." + fit + ",\n" +
                    i(ind+1) + "errorBuilder: (c,e,s) => const Icon(Icons.broken_image),\n" +
                    i(ind) + ")";
        }
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

        // ── 2b: API array binding — generates ListView.builder from FutureProvider ──
        boolean hasArrayBinding = node.getApiBinding() != null
                && Boolean.TRUE.equals(node.getApiBinding().get("isListBinding"))
                && node.getApiBinding().get("interfaceId") != null
                && !((String)node.getApiBinding().get("interfaceId")).isBlank();

        if (hasArrayBinding) {
            String ifcId   = (String) node.getApiBinding().get("interfaceId");
            String ifcName = (String) node.getApiBinding().getOrDefault("interfaceName",
                    (String) node.getApiBinding().getOrDefault("interfaceId", "unknown"));
            String dVar    = bindingDataVar(ifcId);
            // paintState variable is declared in appendProviderWatches as:
            //   final xyzData = _paintState['ScreenName__interfaceName'];
            // It is null until AzPainter.paint() is called by the developer.
            WidgetNode template = getFirstChild(node, screen);
            String itemWidget = template != null
                    ? buildArrayItemWidget(template, screen, ind+3)
                    : i(ind+3) + "ListTile(title: Text(item.toString()))";

            return "Builder(builder: (context) {\n" +
                    i(ind+1) + "final list = " + dVar + " is List ? List<dynamic>.from(" + dVar + ") : [];\n" +
                    i(ind+1) + "if (list.isEmpty) {\n" +
                    i(ind+2) + "return const Center(\n" +
                    i(ind+3) + "child: Text('No data — call AzPainter.paint() from your controller',\n" +
                    i(ind+4) + "style: TextStyle(color: Colors.white38, fontSize: 12)));\n" +
                    i(ind+1) + "}\n" +
                    i(ind+1) + "return ListView.builder(\n" +
                    i(ind+2) + "itemCount: list.length,\n" +
                    i(ind+2) + "itemBuilder: (context, index) {\n" +
                    i(ind+3) + "final item = list[index] as Map<String,dynamic>;\n" +
                    i(ind+3) + "return " + itemWidget + ";\n" +
                    i(ind+2) + "},\n" +
                    i(ind+1) + ");\n" +
                    i(ind) + "})";
        }

        // ── Legacy: repeatFor (state list) ──
        boolean hasDynamic = node.getRepeatFor() != null;
        if (hasDynamic) {
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

        // ── Static children ──
        return "ListView(\n" +
                i(ind+1) + "children: [\n" +
                buildChildrenList(node, screen, ind+2) +
                i(ind+1) + "],\n" +
                i(ind) + ")";
    }

    /**
     * Build the item widget for a bound ListView.builder.
     * If the template is a ListTile, wire its title/subtitle from item['field'].
     * Otherwise generate the template widget as-is.
     */
    private String buildArrayItemWidget(WidgetNode template, ScreenDefinition screen, int ind) {
        if ("flutter.widgets.ListTile".equals(template.getType())) {
            Map<String, Object> props = getProps(template);
            String title    = props.containsKey("title")
                    ? "item['" + props.get("title") + "']?.toString() ?? ''" : "item.values.first?.toString() ?? ''";
            String subtitle = props.containsKey("subtitle")
                    ? "item['" + props.get("subtitle") + "']?.toString() ?? ''" : null;
            StringBuilder sb = new StringBuilder("ListTile(\n");
            sb.append(i(ind+1)).append("title: Text(").append(title).append("),\n");
            if (subtitle != null) sb.append(i(ind+1)).append("subtitle: Text(").append(subtitle).append("),\n");
            sb.append(i(ind)).append(")");
            return sb.toString();
        }
        // Fallback — generate the template widget normally
        return generateWidget(template, screen, ind);
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

        // Title — use bound value if apiBinding targets "title"
        boolean titleBound = node.getApiBinding() != null
                && node.getApiBinding().get("interfaceId") != null
                && !((String)node.getApiBinding().get("interfaceId")).isBlank()
                && "title".equals(node.getApiBinding().get("targetProp"));
        if (titleBound) {
            sb.append(i(ind+1)).append("title: Text(").append(boundValueExpr(node, "'--'")).append("),\n");
        } else if (props.containsKey("title")) {
            sb.append(i(ind+1)).append("title: Text(").append(strLiteral(props.get("title"))).append("),\n");
        }

        if (props.containsKey("subtitle")) sb.append(i(ind+1)).append("subtitle: Text(").append(strLiteral(props.get("subtitle"))).append("),\n");
        // leading: only emit if it's a real icon name string, not a boolean
        Object leading = props.get("leading");
        if (leading instanceof String && !((String)leading).isBlank()) {
            String leadIcon = ((String)leading).startsWith("Icons.") ? (String)leading : "Icons." + leading;
            sb.append(i(ind+1)).append("leading: Icon(").append(leadIcon).append("),\n");
        } else if (leading instanceof Boolean && (Boolean) leading) {
            sb.append(i(ind+1)).append("leading: const Icon(Icons.chevron_right),\n");
        }
        // trailing: same treatment
        Object trailing = props.get("trailing");
        if (trailing instanceof String && !((String)trailing).isBlank()) {
            String trailIcon = ((String)trailing).startsWith("Icons.") ? (String)trailing : "Icons." + trailing;
            sb.append(i(ind+1)).append("trailing: Icon(").append(trailIcon).append("),\n");
        } else if (trailing instanceof Boolean && (Boolean) trailing) {
            sb.append(i(ind+1)).append("trailing: const Icon(Icons.chevron_right),\n");
        }
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
        if (props.containsKey("backgroundColor"))
            sb.append(i(ind+1)).append("backgroundColor: ").append(colorExpr(props.get("backgroundColor"))).append(",\n");
        if (props.containsKey("selectedItemColor"))
            sb.append(i(ind+1)).append("selectedItemColor: ").append(colorExpr(props.get("selectedItemColor"))).append(",\n");
        if (props.containsKey("unselectedItemColor"))
            sb.append(i(ind+1)).append("unselectedItemColor: ").append(colorExpr(props.get("unselectedItemColor"))).append(",\n");
        if (items.size() > 2) {
            sb.append(i(ind+1)).append("type: BottomNavigationBarType.fixed,\n");
        }
        sb.append(i(ind+1)).append("items: [\n");
        for (Map<String, Object> item : items) {
            String rawIcon = item.containsKey("icon") ? String.valueOf(item.get("icon")) : "circle";
            String iconStr = rawIcon.startsWith("Icons.") ? rawIcon : "Icons." + rawIcon;
            sb.append(i(ind+2)).append("BottomNavigationBarItem(\n");
            sb.append(i(ind+3)).append("icon: Icon(").append(iconStr).append("),\n");
            sb.append(i(ind+3)).append("label: ").append(strLiteral(item.getOrDefault("label", ""))).append(",\n");
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
        sb.append("import 'package:").append(pkgName).append("/appzillon/appzillon.dart';\n");
        // Only import providers/services if they are actually used by this screen
        if (screen.getStateProviders() != null && !screen.getStateProviders().isEmpty()) {
            sb.append("import 'package:").append(pkgName).append("/providers/providers.dart';\n");
        }
        // Import router.dart when any widget has a navigate action — needed for RouteNames
        boolean hasNavigateAction = screen.getWidgets().values().stream()
                .anyMatch(n -> n.getEvents() != null && widgetHasNavigateAction(n));
        if (hasNavigateAction) {
            sb.append("import '../router.dart';");
        }

        // intl only needed for currency / date format transforms on bound widgets
        boolean hasBindings = screen.getWidgets().values().stream()
                .anyMatch(n -> n.getApiBinding() != null
                        && n.getApiBinding().get("interfaceId") != null
                        && !((String)n.getApiBinding().get("interfaceId")).isBlank());
        if (hasBindings) {
            boolean needsIntl = screen.getWidgets().values().stream()
                    .filter(n -> n.getApiBinding() != null)
                    .anyMatch(n -> {
                        String fmt = (String) n.getApiBinding().getOrDefault("format", "none");
                        return "currency".equals(fmt) || "date".equals(fmt) || "dateTime".equals(fmt);
                    });
            if (needsIntl) sb.append("import 'package:intl/intl.dart';\n");
        }
    }

    private void appendControllerDeclarations(StringBuilder sb, ScreenDefinition screen) {
        // TextEditingControllers for TextFields
        for (WidgetNode node : screen.getWidgets().values()) {
            if ("flutter.widgets.TextField".equals(node.getType()) ||
                    "flutter.widgets.TextFormField".equals(node.getType())) {
                Map<String, Object> props = getProps(node);
                String ctrl = (String) props.getOrDefault("controllerName",
                        "_" + node.getId().replace("-","").substring(0, Math.min(8, node.getId().replace("-","").length())) + "Controller");
                sb.append("  final TextEditingController ").append(ctrl)
                        .append(" = TextEditingController();\n");
            }
        }
        // _toggleSelected list for ToggleButtons
        for (WidgetNode node : screen.getWidgets().values()) {
            if ("flutter.widgets.ToggleButtons".equals(node.getType())) {
                Map<String, Object> props = getProps(node);
                @SuppressWarnings("unchecked")
                java.util.List<Object> selected = (java.util.List<Object>) props.get("selected");
                int count = selected != null ? selected.size() : 3;
                // Build initial list: [true, false, false, ...]
                StringBuilder init = new StringBuilder("[");
                for (int i = 0; i < count; i++) {
                    boolean val = selected != null && i < selected.size()
                            && Boolean.TRUE.equals(selected.get(i));
                    init.append(val ? "true" : "false");
                    if (i < count - 1) init.append(", ");
                }
                init.append("]");
                sb.append("  List<bool> _toggleSelected = ").append(init).append(";\n");
                break; // only declare once even if multiple ToggleButtons
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
                        "_" + node.getId().replace("-","").substring(0, Math.min(8, node.getId().replace("-","").length())) + "Controller");
                sb.append("    ").append(ctrl).append(".dispose();\n");
            }
        }
        sb.append("    super.dispose();\n  }\n\n");
    }

    private void appendProviderWatches(StringBuilder sb, ScreenDefinition screen,
                                       FlutterForgeProject project) {
        // Legacy state providers
        if (screen.getStateProviders() != null) {
            for (String prov : screen.getStateProviders()) {
                String varName = prov.replace("Provider", "").toLowerCase();
                sb.append("    final ").append(varName).append(" = ref.watch(")
                        .append(prov).append(");\n");
            }
            if (!screen.getStateProviders().isEmpty()) sb.append("\n");
        }
        // AzPainter bindings — watch the painter state map, extract per-interface data
        java.util.Map<String, java.util.Map<String,Object>> bindings = collectApiBindings(screen);
        if (!bindings.isEmpty()) {
            sb.append("    // AzPainter — updates when developer calls AzPainter.paint()\n");
            sb.append("    final _paintState = ref.watch(azPainterProvider);\n");
            for (java.util.Map.Entry<String, java.util.Map<String,Object>> entry : bindings.entrySet()) {
                String ifcName = (String) entry.getValue().getOrDefault("interfaceName",
                        (String) entry.getValue().getOrDefault("interfaceId", "unknown"));
                String dataVar = bindingDataVar(entry.getKey());
                // Key format must match what AzPainter.paint() uses: "ScreenName__interfaceName"
                sb.append("    final ").append(dataVar)
                        .append(" = _paintState['").append(screen.getName())
                        .append("__").append(ifcName).append("'];\n");
            }
            sb.append("\n");
        }
    }

    /**
     * For each interface bound on this screen, emit a comment block reminding
     * the developer to call AzPainter.paint() from their controller method.
     * We no longer auto-generate a FutureProvider — the developer owns the call.
     *
     * Nothing is emitted at file scope for data fetching; the developer writes
     * their load method in the screen controller dart file.
     */
    @SuppressWarnings("unchecked")
    private void appendApiProviders(StringBuilder sb, ScreenDefinition screen) {
        java.util.Map<String, java.util.Map<String,Object>> bindings = collectApiBindings(screen);
        if (bindings.isEmpty()) return;

        sb.append("// ── AzPainter bindings ──────────────────────────────────────────────────\n");
        sb.append("// The following interfaces are bound to widgets on this screen.\n");
        sb.append("// Call AzPainter.paint(screenId, interfaceId, data) from your controller\n");
        sb.append("// after fetching and processing the data to trigger a widget rebuild.\n");
        sb.append("//\n");
        for (java.util.Map.Entry<String, java.util.Map<String,Object>> entry : bindings.entrySet()) {
            String ifcName = (String) entry.getValue().getOrDefault("interfaceName",
                    (String) entry.getValue().getOrDefault("interfaceId", "unknown"));
            String urlPath = (String) entry.getValue().getOrDefault("urlPath", "/api/...");
            String method  = (String) entry.getValue().getOrDefault("method", "GET");
            sb.append("// Interface: ").append(ifcName)
                    .append("  •  ").append(method).append(" ").append(urlPath).append("\n");
            sb.append("//   AzPainter.paint(screenId: '").append(screen.getName())
                    .append("', interfaceId: '").append(ifcName)
                    .append("', data: yourProcessedData);\n");
        }
        sb.append("\n");
    }

    // ── API binding helpers ───────────────────────────────────────────────────

    /**
     * Collect every distinct interfaceId that has a bound widget on this screen.
     * Returns map: interfaceId → { name, urlPath, method, isArray }
     */
    @SuppressWarnings("unchecked")
    private java.util.Map<String, java.util.Map<String,Object>> collectApiBindings(ScreenDefinition screen) {
        java.util.Map<String, java.util.Map<String,Object>> result = new java.util.LinkedHashMap<>();
        for (WidgetNode node : screen.getWidgets().values()) {
            if (node.getApiBinding() == null) continue;
            String ifcId = (String) node.getApiBinding().get("interfaceId");
            if (ifcId == null || ifcId.isBlank()) continue;
            if (!result.containsKey(ifcId)) {
                result.put(ifcId, node.getApiBinding());
            }
        }
        return result;
    }

    /**
     * Build a Dart variable name for the data returned by an interface.
     * interfaceId → camelCase provider var, e.g. "ifc_abc123" → "ifcAbc123Data"
     */
    private String bindingDataVar(String interfaceId) {
        // Strip "ifc_" prefix, camelCase the rest
        String clean = interfaceId.replaceFirst("^ifc_", "").replaceAll("[^a-zA-Z0-9]", "_");
        // camelCase: split by underscore
        String[] parts = clean.split("_");
        StringBuilder out = new StringBuilder(parts[0].toLowerCase());
        for (int i = 1; i < parts.length; i++) {
            if (!parts[i].isEmpty())
                out.append(Character.toUpperCase(parts[i].charAt(0))).append(parts[i].substring(1).toLowerCase());
        }
        return out + "Data";
    }

    /**
     * Build the provider name for a given interfaceId.
     */
    private String providerName(String interfaceId) {
        return bindingDataVar(interfaceId).replace("Data", "") + "Provider";
    }

    /**
     * Emit the value expression for a bound widget property.
     * Returns something like: ifcAbc123Data?['amount']?.toString() ?? '--'
     */
    @SuppressWarnings("unchecked")
    private String boundValueExpr(WidgetNode node, String defaultLiteral) {
        if (node.getApiBinding() == null) return defaultLiteral;
        String ifcId    = (String) node.getApiBinding().get("interfaceId");
        String fieldPath = (String) node.getApiBinding().get("fieldPath");
        String format    = (String) node.getApiBinding().getOrDefault("format", "none");
        String formatArg = (String) node.getApiBinding().get("formatArg");
        Boolean isList   = (Boolean) node.getApiBinding().getOrDefault("isListBinding", false);

        if (ifcId == null || ifcId.isBlank() || fieldPath == null || fieldPath.isBlank())
            return defaultLiteral;

        String dataVar = bindingDataVar(ifcId);

        // Build field access chain from dot-notation path e.g. "user.name" → "['user']?['name']"
        String access = buildFieldAccess(fieldPath, isList != null && isList);

        // Raw value expression
        String raw = dataVar + access + "?.toString() ?? '--'";

        // Wrap with format transform
        return applyFormatExpr(raw, format, formatArg);
    }

    /**
     * Convert dot-path like "user.name" or "items[].amount" into Dart map access.
     */
    private String buildFieldAccess(String fieldPath, boolean isList) {
        // Remove [] suffix for single-item access
        String clean = fieldPath.replace("[]", "");
        if (clean.isBlank()) return "";
        String[] parts = clean.split("\\.");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (!part.isBlank()) sb.append("?['").append(part).append("']");
        }
        return sb.toString();
    }

    /**
     * Wrap a raw Dart expression with the requested format transform.
     */
    private String applyFormatExpr(String raw, String format, String formatArg) {
        if (format == null || format.equals("none")) return raw;
        switch (format) {
            case "currency":
                return "NumberFormat.currency(locale: 'en_IN', symbol: '\\u20b9').format("
                        + "double.tryParse(" + raw + ".replaceAll(',','')) ?? 0)";
            case "date":
                return "(() { try { return DateFormat('dd MMM yyyy').format(DateTime.parse(" + raw + ")); } catch (_) { return " + raw + "; } })()";
            case "dateTime":
                return "(() { try { return DateFormat('dd MMM yyyy hh:mm a').format(DateTime.parse(" + raw + ")); } catch (_) { return " + raw + "; } })()";
            case "percentage":
                return "((double.tryParse(" + raw + ") ?? 0) * 100).toStringAsFixed(1) + '%'";
            case "uppercase":
                return "(" + raw + ").toUpperCase()";
            case "lowercase":
                return "(" + raw + ").toLowerCase()";
            case "truncate": {
                int n = 20;
                try { if (formatArg != null) n = Integer.parseInt(formatArg); } catch (Exception ignored) {}
                return "(" + raw + ").length > " + n + " ? (" + raw + ").substring(0," + n + ")+'\\u2026' : (" + raw + ")";
            }
            default: return raw;
        }
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
        @SuppressWarnings("unchecked")
        Map<String,Object> m = (Map<String,Object>) map;
        StringBuilder sb = new StringBuilder("TextStyle(");
        if (m.containsKey("fontSize"))      sb.append("fontSize: ").append(m.get("fontSize")).append(", ");
        if (m.containsKey("fontWeight"))    sb.append("fontWeight: FontWeight.").append(m.get("fontWeight")).append(", ");
        if (m.containsKey("color"))         sb.append("color: ").append(colorExpr(m.get("color"))).append(", ");
        if (m.containsKey("height"))        sb.append("height: ").append(m.get("height")).append(", ");
        if (m.containsKey("letterSpacing")) sb.append("letterSpacing: ").append(m.get("letterSpacing")).append(", ");
        if (m.containsKey("fontStyle"))     sb.append("fontStyle: FontStyle.").append(m.get("fontStyle")).append(", ");
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
        String s = obj.toString()
                .replace("\\", "\\\\")   // backslash first
                .replace("'", "\\'")     // single quotes
                .replace("\n", "\\n")    // real newlines → \n escape
                .replace("\r", "");      // strip carriage returns
        return "'" + s + "'";
    }

    private String resolveTextRef(String text) {
        if (text == null) return "''";
        // Replace {{provider.field}} with ${ref.watch(providerProvider).field}
        String resolved = text.replaceAll("\\{\\{([^}]+)\\}\\}", "\\${$1}");
        // Escape special characters for Dart single-quoted string
        resolved = resolved
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "");
        return "'" + resolved + "'";
    }

    private String buildOnTapCallback(WidgetNode node) {
        if (node.getEvents() == null) return "() {}";
        WidgetNode.WidgetEvents ev = node.getEvents();

        // ── handlers format (current screen.json) ─────────────────────────────
        // Buttons use "onPressed", tiles/containers use "onTap"
        Map<String, Object> action = null;
        for (String name : new String[]{"onPressed", "onTap"}) {
            action = ev.firstActionFor(name);
            if (action != null) break;
        }
        if (action != null) return buildActionCode(action);

        // ── legacy flat format ─────────────────────────────────────────────────
        Object tap = ev.getOnTap();
        if (tap instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> t = (Map<String, Object>) tap;
            if (t.containsKey("route"))     return "() => context.push(" + routeToConstExpr(String.valueOf(t.get("route"))) + ")";
            if (t.containsKey("operation")) return "() => _on" + capitalize((String) t.get("operation")) + "()";
        }
        return "() {}";
    }

    /**
     * Generates a Dart lambda body for a single action map.
     * Supports: navigate, callCode, callApi, showSnackbar, showDialog.
     */
    @SuppressWarnings("unchecked")
    private String buildActionCode(Map<String, Object> action) {
        String type = String.valueOf(action.getOrDefault("type", ""));
        return switch (type) {
            case "navigate" -> {
                String route   = String.valueOf(action.getOrDefault("route", "/"));
                String navType = String.valueOf(action.getOrDefault("navType", "push"));
                // Use RouteNames constant (from router.dart) instead of a raw string.
                // RouteNames.dashboard, RouteNames.login, etc. are type-safe and
                // refactor-safe. If the route isn't mappable, fall back to the raw string.
                String routeExpr = routeToConstExpr(route);
                yield switch (navType) {
                    case "pushReplacement" -> "() => context.pushReplacement(" + routeExpr + ")";
                    case "pop"             -> "() => context.pop()";
                    default                -> "() => context.push(" + routeExpr + ")";
                };
            }
            case "callCode" -> {
                String method = String.valueOf(action.getOrDefault("methodName", "_onAction"));
                yield "() => " + method + "()";
            }
            case "callApi" -> {
                String iface  = String.valueOf(action.getOrDefault("interfaceName", "api"));
                String method = "_call" + capitalize(iface.replaceAll("[^a-zA-Z0-9]", " ").trim().replaceAll("\\s+", ""));
                yield "() => " + method + "()";
            }
            case "showSnackbar" -> {
                String msg    = strLiteral(action.getOrDefault("message", ""));
                boolean isErr = Boolean.TRUE.equals(action.get("isError"));
                String color  = isErr ? "Colors.red.shade700" : "Colors.green.shade700";
                yield "() { ScaffoldMessenger.of(context).showSnackBar("
                        + "SnackBar(backgroundColor: " + color + ", content: Text(" + msg + "))); }";
            }
            case "showDialog" -> {
                String title = strLiteral(action.getOrDefault("title", "Confirm"));
                String msg   = strLiteral(action.getOrDefault("message", ""));
                yield "() { showDialog(context: context, builder: (ctx) => AlertDialog("
                        + "title: Text(" + title + "), "
                        + "content: Text(" + msg + "), "
                        + "actions: [TextButton("
                        + "onPressed: () => Navigator.pop(ctx), "
                        + "child: const Text('OK'))])); }";
            }
            default -> "() {}";
        };
    }

    /**
     * Builds a callback for non-tap events (onSubmitted, onChanged).
     * These receive a value parameter so the lambda is (value) => ...
     */
    private String buildValueCallback(WidgetNode node, String eventName) {
        if (node.getEvents() == null) return "(_) {}";
        Map<String, Object> action = node.getEvents().firstActionFor(eventName);
        if (action != null) {
            String type   = String.valueOf(action.getOrDefault("type", ""));
            String method = String.valueOf(action.getOrDefault("methodName", "_onAction"));
            if ("callCode".equals(type)) return "(value) => " + method + "(value)";
            return "(_) { (" + buildActionCode(action) + ")(); }";
        }
        // Legacy
        Object ev = "onChanged".equals(eventName)
                ? node.getEvents().getOnChanged()
                : node.getEvents().getOnSubmitted();
        if (ev instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> t = (Map<String, Object>) ev;
            if (t.containsKey("operation")) return "(v) => _on" + capitalize((String) t.get("operation")) + "(v)";
        }
        return "(_) {}";
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
    // NAVIGATION HELPERS (E2 — RouteNames integration)
    // ────────────────────────────────────────────────────────

    /**
     * Converts a route string to a RouteNames constant expression.
     *
     * "/dashboard"               → RouteNames.dashboard
     * "/account-detail"          → RouteNames.accountDetail
     * "/transaction-history"     → RouteNames.transactionHistory
     * "/"                        → RouteNames.splash  (initial route)
     * "/some-unknown-deep/path"  → '/some-unknown-deep/path'  (raw string fallback)
     *
     * The RouteNames class is generated by DartRouterCodegen using the same
     * screenToConstName logic: strip "Screen", lower-camel the result.
     * We mirror that logic here so widget codegen stays in sync with router codegen.
     */
    private String routeToConstExpr(String route) {
        if (route == null || route.isBlank()) return "RouteNames.splash";

        // Strip leading slash and split by hyphens, then camelCase
        String path = route.startsWith("/") ? route.substring(1) : route;
        if (path.isEmpty()) return "RouteNames.splash";

        // Route like "account-detail" → "accountDetail"
        String[] parts = path.split("-");
        StringBuilder sb = new StringBuilder(parts[0].toLowerCase());
        for (int i = 1; i < parts.length; i++) {
            String part = parts[i];
            if (!part.isEmpty()) {
                sb.append(Character.toUpperCase(part.charAt(0)));
                sb.append(part.substring(1).toLowerCase());
            }
        }
        String constName = sb.toString();

        // Validate: RouteNames constant names are simple identifiers.
        // If the result looks like a valid Dart identifier, use it.
        // Otherwise fall back to raw string to avoid compile errors.
        if (constName.matches("[a-zA-Z][a-zA-Z0-9]*")) {
            return "RouteNames." + constName;
        }
        // Fallback for complex paths
        return "'" + route + "'";
    }

    /**
     * Returns true if any event handler on this widget contains a navigate action.
     * Used by appendImports to decide whether to import router.dart.
     */
    @SuppressWarnings("unchecked")
    private boolean widgetHasNavigateAction(WidgetNode node) {
        if (node.getEvents() == null) return false;
        WidgetNode.WidgetEvents ev = node.getEvents();

        // Check handlers list format
        for (String eventName : new String[]{"onPressed", "onTap", "onSubmitted"}) {
            Map<String, Object> action = ev.firstActionFor(eventName);
            if (action != null && "navigate".equals(action.get("type"))) return true;
        }

        // Check legacy flat format
        Object tap = ev.getOnTap();
        if (tap instanceof Map<?,?> t && ((Map<?,?>)t).containsKey("route")) return true;

        return false;
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
    // ─────────────────────────────────────────────────────────────────────────
    // SPRINT 2 — NEW WIDGET CODEGEN METHODS
    // ─────────────────────────────────────────────────────────────────────────

    private String genSafeArea(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        return i + "SafeArea(\n" + genChildren(node, screen, ind + 1) + i + ")\n";
    }

    private String genScrollView(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        String dir = prop(node, "scrollDirection", "vertical");
        return i + "SingleChildScrollView(\n" +
                i + "  scrollDirection: Axis." + dir + ",\n" +
                genChildren(node, screen, ind + 1) +
                i + ")\n";
    }

    private String genWrapWidget(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        int spacing    = propInt(node, "spacing", 8);
        int runSpacing = propInt(node, "runSpacing", 8);
        return i + "Wrap(\n" +
                i + "  spacing: " + spacing + ",\n" +
                i + "  runSpacing: " + runSpacing + ",\n" +
                i + "  children: [\n" +
                genChildrenList(node, screen, ind + 2) +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genSpacer(WidgetNode node, int ind) {
        String i = "  ".repeat(ind);
        int flex = propInt(node, "flex", 1);
        return i + "Spacer(flex: " + flex + ")\n";
    }

    private String genAspectRatio(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        double ratio = propDouble(node, "aspectRatio", 1.0);
        return i + "AspectRatio(\n" +
                i + "  aspectRatio: " + ratio + ",\n" +
                genChildren(node, screen, ind + 1) +
                i + ")\n";
    }

    private String genClipRRect(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        int br = propInt(node, "borderRadius.all", 12);
        return i + "ClipRRect(\n" +
                i + "  borderRadius: BorderRadius.circular(" + br + "),\n" +
                genChildren(node, screen, ind + 1) +
                i + ")\n";
    }

    private String genOpacity(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        double op = propDouble(node, "opacity", 0.5);
        return i + "Opacity(\n" +
                i + "  opacity: " + op + ",\n" +
                genChildren(node, screen, ind + 1) +
                i + ")\n";
    }

    private String genRichText(WidgetNode node, int ind) {
        String i = "  ".repeat(ind);
        return i + "RichText(\n" +
                i + "  text: TextSpan(\n" +
                i + "    text: 'Hello ',\n" +
                i + "    style: const TextStyle(fontSize: 16),\n" +
                i + "    children: [\n" +
                i + "      TextSpan(text: 'World', style: const TextStyle(fontWeight: FontWeight.bold)),\n" +
                i + "    ],\n" +
                i + "  ),\n" +
                i + ")\n";
    }

    private String genBadge(WidgetNode node, ScreenDefinition screen, int ind) {
        String i   = "  ".repeat(ind);
        String lbl = prop(node, "label", "1");
        return i + "Badge(\n" +
                i + "  label: Text('" + lbl + "'),\n" +
                genChildren(node, screen, ind + 1) +
                i + ")\n";
    }

    private String genChip(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        String lbl = prop(node, "label", "Chip");
        boolean sel = Boolean.parseBoolean(prop(node, "selected", "false"));
        return i + (sel ? "FilterChip" : "Chip") + "(\n" +
                i + "  label: Text('" + lbl + "'),\n" +
                (sel ? i + "  selected: true,\n" +
                        i + "  onSelected: (_) {},\n" : "") +
                i + ")\n";
    }

    private String genLinearProgress(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        String val = prop(node, "value", "null");
        return i + "LinearProgressIndicator(\n" +
                ("null".equals(val) ? "" : i + "  value: " + val + ",\n") +
                i + ")\n";
    }

    private String genCircularProgress(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        String val = prop(node, "value", "null");
        int sw     = propInt(node, "strokeWidth", 3);
        return i + "CircularProgressIndicator(\n" +
                ("null".equals(val) ? "" : i + "  value: " + val + ",\n") +
                i + "  strokeWidth: " + sw + ",\n" +
                i + ")\n";
    }

    private String genTooltip(WidgetNode node, ScreenDefinition screen, int ind) {
        String i   = "  ".repeat(ind);
        String msg = prop(node, "message", "Tooltip");
        return i + "Tooltip(\n" +
                i + "  message: '" + msg + "',\n" +
                genChildren(node, screen, ind + 1) +
                i + ")\n";
    }

    private String genTextFormField(WidgetNode node, int ind) {
        String i     = "  ".repeat(ind);
        String label = prop(node, "labelText", "Field");
        String hint  = prop(node, "hintText", "Enter value...");
        return i + "TextFormField(\n" +
                i + "  decoration: const InputDecoration(\n" +
                i + "    labelText: '" + label + "',\n" +
                i + "    hintText: '" + hint + "',\n" +
                i + "  ),\n" +
                i + "  validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,\n" +
                i + ")\n";
    }

    private String genRadio(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        String val = prop(node, "value", "option1");
        return i + "Radio<String>(\n" +
                i + "  value: '" + val + "',\n" +
                i + "  groupValue: _radioValue,\n" +
                i + "  onChanged: (v) => setState(() => _radioValue = v!),\n" +
                i + ")\n";
    }

    private String genToggleButtons(WidgetNode node, int ind) {
        String i = "  ".repeat(ind);
        Map<String, Object> props = getProps(node);
        @SuppressWarnings("unchecked")
        java.util.List<Object> labels = (java.util.List<Object>) props.getOrDefault("labels",
                java.util.List.of("Option 1", "Option 2", "Option 3"));
        StringBuilder children = new StringBuilder();
        for (Object lbl : labels) {
            children.append(i).append("  Text(").append(strLiteral(lbl)).append("),\n");
        }
        StringBuilder sb = new StringBuilder();
        sb.append(i).append("ToggleButtons(\n");
        sb.append(i).append("  isSelected: _toggleSelected,\n");
        sb.append(i).append("  onPressed: (index) => setState(() => _toggleSelected[index] = !_toggleSelected[index]),\n");
        if (props.containsKey("selectedColor")) {
            sb.append(i).append("  selectedColor: ").append(colorExpr(props.get("selectedColor"))).append(",\n");
        }
        sb.append(i).append("  children: [\n").append(children).append(i).append("  ],\n");
        sb.append(i).append(")\n");
        return sb.toString();
    }

    private String genRangeSlider(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        double min = propDouble(node, "min", 0.0);
        double max = propDouble(node, "max", 100.0);
        return i + "RangeSlider(\n" +
                i + "  values: _rangeValues,\n" +
                i + "  min: " + min + ",\n" +
                i + "  max: " + max + ",\n" +
                i + "  onChanged: (v) => setState(() => _rangeValues = v),\n" +
                i + ")\n";
    }

    private String genDropdownFormField(WidgetNode node, int ind) {
        String i     = "  ".repeat(ind);
        String label = prop(node, "labelText", "Select option");
        return i + "DropdownButtonFormField<String>(\n" +
                i + "  decoration: const InputDecoration(labelText: '" + label + "'),\n" +
                i + "  value: null,\n" +
                i + "  items: ['Option 1', 'Option 2'].map((e) =>\n" +
                i + "    DropdownMenuItem(value: e, child: Text(e))).toList(),\n" +
                i + "  onChanged: (_) {},\n" +
                i + ")\n";
    }

    private String genSearchBar(WidgetNode node, int ind) {
        String i    = "  ".repeat(ind);
        String hint = prop(node, "hintText", "Search...");
        return i + "SearchBar(\n" +
                i + "  hintText: '" + hint + "',\n" +
                i + "  leading: const Icon(Icons.search),\n" +
                i + "  onChanged: (_) {},\n" +
                i + ")\n";
    }

    private String genDatePicker(WidgetNode node, int ind) {
        String i     = "  ".repeat(ind);
        String label = prop(node, "labelText", "Select date");
        return i + "// DatePicker — trigger via showDatePicker()\n" +
                i + "ElevatedButton.icon(\n" +
                i + "  icon: const Icon(Icons.calendar_today),\n" +
                i + "  label: const Text('" + label + "'),\n" +
                i + "  onPressed: () async {\n" +
                i + "    final picked = await showDatePicker(\n" +
                i + "      context: context,\n" +
                i + "      initialDate: DateTime.now(),\n" +
                i + "      firstDate: DateTime(2000),\n" +
                i + "      lastDate: DateTime(2100),\n" +
                i + "    );\n" +
                i + "    if (picked != null) setState(() {});\n" +
                i + "  },\n" +
                i + ")\n";
    }

    private String genTimePicker(WidgetNode node, int ind) {
        String i     = "  ".repeat(ind);
        String label = prop(node, "labelText", "Select time");
        return i + "// TimePicker — trigger via showTimePicker()\n" +
                i + "ElevatedButton.icon(\n" +
                i + "  icon: const Icon(Icons.access_time),\n" +
                i + "  label: const Text('" + label + "'),\n" +
                i + "  onPressed: () async {\n" +
                i + "    final picked = await showTimePicker(\n" +
                i + "      context: context,\n" +
                i + "      initialTime: TimeOfDay.now(),\n" +
                i + "    );\n" +
                i + "    if (picked != null) setState(() {});\n" +
                i + "  },\n" +
                i + ")\n";
    }

    private String genNavigationBar(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        int    sel = propInt(node, "selectedIndex", 0);
        return i + "NavigationBar(\n" +
                i + "  selectedIndex: " + sel + ",\n" +
                i + "  onDestinationSelected: (i) => setState(() {}),\n" +
                i + "  destinations: const [\n" +
                i + "    NavigationDestination(icon: Icon(Icons.home), label: 'Home'),\n" +
                i + "    NavigationDestination(icon: Icon(Icons.explore), label: 'Explore'),\n" +
                i + "    NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),\n" +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genNavigationRail(WidgetNode node, int ind) {
        String i   = "  ".repeat(ind);
        int    sel = propInt(node, "selectedIndex", 0);
        return i + "NavigationRail(\n" +
                i + "  selectedIndex: " + sel + ",\n" +
                i + "  onDestinationSelected: (i) => setState(() {}),\n" +
                i + "  destinations: const [\n" +
                i + "    NavigationRailDestination(icon: Icon(Icons.home), label: Text('Home')),\n" +
                i + "    NavigationRailDestination(icon: Icon(Icons.settings), label: Text('Settings')),\n" +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genPageView(WidgetNode node, ScreenDefinition screen, int ind) {
        String i   = "  ".repeat(ind);
        String dir = prop(node, "scrollDirection", "horizontal");
        return i + "PageView(\n" +
                i + "  scrollDirection: Axis." + dir + ",\n" +
                i + "  children: [\n" +
                genChildrenList(node, screen, ind + 2) +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genExpansionTile(WidgetNode node, ScreenDefinition screen, int ind) {
        String i     = "  ".repeat(ind);
        String title = prop(node, "title", "Expand me");
        boolean init = Boolean.parseBoolean(prop(node, "initiallyExpanded", "false"));
        return i + "ExpansionTile(\n" +
                i + "  title: const Text('" + title + "'),\n" +
                i + "  initiallyExpanded: " + init + ",\n" +
                i + "  children: [\n" +
                genChildrenList(node, screen, ind + 2) +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genReorderableListView(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        return i + "ReorderableListView(\n" +
                i + "  onReorder: (oldIndex, newIndex) => setState(() {}),\n" +
                i + "  children: [\n" +
                genChildrenList(node, screen, ind + 2) +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genAlertDialog(WidgetNode node, int ind) {
        String i       = "  ".repeat(ind);
        String title   = prop(node, "title",       "Alert");
        String content = prop(node, "content",     "Are you sure?");
        String ok      = prop(node, "confirmText", "OK");
        String cancel  = prop(node, "cancelText",  "Cancel");
        return i + "AlertDialog(\n" +
                i + "  title: const Text('" + title + "'),\n" +
                i + "  content: const Text('" + content + "'),\n" +
                i + "  actions: [\n" +
                i + "    TextButton(onPressed: () => Navigator.pop(context), child: const Text('" + cancel + "')),\n" +
                i + "    ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('" + ok + "')),\n" +
                i + "  ],\n" +
                i + ")\n";
    }

    private String genStepper(WidgetNode node, int ind) {
        String i    = "  ".repeat(ind);
        String type = prop(node, "type", "vertical");
        int    curr = propInt(node, "currentStep", 0);
        return i + "Stepper(\n" +
                i + "  type: StepperType." + type + ",\n" +
                i + "  currentStep: " + curr + ",\n" +
                i + "  onStepTapped: (i) => setState(() {}),\n" +
                i + "  onStepContinue: () => setState(() {}),\n" +
                i + "  onStepCancel: () => setState(() {}),\n" +
                i + "  steps: [\n" +
                i + "    Step(title: const Text('Step 1'), content: const Text('Content 1')),\n" +
                i + "    Step(title: const Text('Step 2'), content: const Text('Content 2')),\n" +
                i + "  ],\n" +
                i + ")\n";
    }

    // ── Prop helpers ─────────────────────────────────────────────────────────

    /** Get a String prop by key, with dot-notation support (e.g. "borderRadius.all") */
    private String prop(WidgetNode node, String key, String fallback) {
        try {
            String[] parts = key.split("\\.");
            Object v = node.getProps();
            for (String p : parts) {
                if (v instanceof java.util.Map<?,?> m) v = m.get(p);
                else return fallback;
            }
            return v != null ? v.toString() : fallback;
        } catch (Exception ignored) {}
        return fallback;
    }

    /** Get an int prop by key */
    private int propInt(WidgetNode node, String key, int fallback) {
        try {
            String[] parts = key.split("\\.");
            Object v = node.getProps();
            for (String p : parts) {
                if (v instanceof java.util.Map<?,?> m) v = m.get(p);
                else return fallback;
            }
            if (v instanceof Number n) return n.intValue();
            if (v instanceof String s)  return Integer.parseInt(s);
        } catch (Exception ignored) {}
        return fallback;
    }

    private double propDouble(WidgetNode node, String key, double fallback) {
        try {
            String[] parts = key.split("\\.");
            Object v = node.getProps();
            for (String p : parts) {
                if (v instanceof java.util.Map<?,?> m) v = m.get(p);
                else return fallback;
            }
            if (v instanceof Number n) return n.doubleValue();
        } catch (Exception ignored) {}
        return fallback;
    }

    // ── Children helpers ─────────────────────────────────────────────────────

    private String genChildren(WidgetNode node, ScreenDefinition screen, int ind) {
        if (node.getChildren() == null || node.getChildren().isEmpty()) return "";
        if (node.getChildren().size() == 1) {
            String childId = node.getChildren().get(0);
            WidgetNode child = screen.getWidgets().get(childId);
            if (child == null) return "";
            String i = "  ".repeat(ind - 1);
            return i + "  child: " + generateWidget(child, screen, ind).stripLeading();
        }
        return "";
    }

    private String genChildrenList(WidgetNode node, ScreenDefinition screen, int ind) {
        if (node.getChildren() == null) return "";
        StringBuilder sb = new StringBuilder();
        String i = "  ".repeat(ind);
        for (String childId : node.getChildren()) {
            WidgetNode child = screen.getWidgets().get(childId);
            if (child != null) {
                String widgetCode = generateWidget(child, screen, ind).stripTrailing();
                // Ensure each item in a children list ends with a comma
                if (!widgetCode.endsWith(",")) widgetCode = widgetCode + ",";
                sb.append(widgetCode).append("\n");
            }
        }
        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EN1 Item 4 — 7 previously missing widget generators
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Flexible — flex child that can shrink/grow but doesn't force the child
     * to fill all available space (unlike Expanded).
     * Props: flex (int, default 1), fit ("tight"|"loose", default "loose")
     */
    private String genFlexible(WidgetNode node, ScreenDefinition screen, int ind) {
        int    flex = propInt(node, "flex", 1);
        String fit  = prop(node, "fit", "loose");
        WidgetNode child = getFirstChild(node, screen);
        String childCode = child != null
                ? generateWidget(child, screen, ind + 1)
                : "const SizedBox.shrink()";
        return "Flexible(\n" +
                i(ind+1) + "flex: " + flex + ",\n" +
                i(ind+1) + "fit: FlexFit." + fit + ",\n" +
                i(ind+1) + "child: " + childCode + ",\n" +
                i(ind) + ")";
    }

    /**
     * DropdownButton<String> — standalone dropdown (not inside a Form).
     * Props: value (String), items (List<String>), hint (String)
     */
    private String genDropdownButton(WidgetNode node, int ind) {
        String i     = "  ".repeat(ind);
        String value = prop(node, "value", "");
        String hint  = prop(node, "hint",  "Select...");
        @SuppressWarnings("unchecked")
        List<?> rawItems = (List<?>) getProps(node).getOrDefault("items",
                List.of("Option 1", "Option 2", "Option 3"));
        StringBuilder items = new StringBuilder();
        for (Object item : rawItems) {
            String label = item.toString();
            items.append(i).append("    DropdownMenuItem(value: ")
                    .append(strLiteral(label)).append(", child: Text(")
                    .append(strLiteral(label)).append(")),\n");
        }
        String valueExpr = value.isBlank() ? "null" : strLiteral(value);
        return i + "DropdownButton<String>(\n" +
                i + "  value: " + valueExpr + ",\n" +
                i + "  hint: Text(" + strLiteral(hint) + "),\n" +
                i + "  onChanged: (v) => setState(() {}),\n" +
                i + "  items: [\n" +
                items +
                i + "  ],\n" +
                i + ")";
    }

    /**
     * NavigationDrawer — slide-in drawer rendered inside a Scaffold's drawer slot.
     * In canvas context emitted as the Drawer widget wrapping its children.
     * Props: children rendered as drawer items.
     */
    private String genNavigationDrawer(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        StringBuilder children = new StringBuilder();
        if (node.getChildren() != null) {
            for (String childId : node.getChildren()) {
                WidgetNode child = screen.getWidgets().get(childId);
                if (child != null) {
                    children.append(i).append("    ")
                            .append(generateWidget(child, screen, ind + 2).stripLeading())
                            .append(",\n");
                }
            }
        }
        if (children.isEmpty()) {
            children.append(i).append("    DrawerHeader(child: const Text('Menu')),\n");
            children.append(i).append("    ListTile(leading: const Icon(Icons.home), title: const Text('Home'), onTap: () {}),\n");
        }
        return i + "Drawer(\n" +
                i + "  child: ListView(\n" +
                i + "    padding: EdgeInsets.zero,\n" +
                i + "    children: [\n" +
                children +
                i + "    ],\n" +
                i + "  ),\n" +
                i + ")";
    }

    /**
     * TabBarView — body that shows the content for the selected tab.
     * Must be used inside a DefaultTabController or alongside a TabBar.
     * Props: children rendered as tab pages.
     */
    private String genTabBarView(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        StringBuilder pages = new StringBuilder();
        if (node.getChildren() != null && !node.getChildren().isEmpty()) {
            for (String childId : node.getChildren()) {
                WidgetNode child = screen.getWidgets().get(childId);
                if (child != null) {
                    pages.append(i).append("    ")
                            .append(generateWidget(child, screen, ind + 2).stripLeading())
                            .append(",\n");
                }
            }
        } else {
            // Default: 2 placeholder tab pages matching a typical 2-tab TabBar
            pages.append(i).append("    const Center(child: Text('Tab 1 content')),\n");
            pages.append(i).append("    const Center(child: Text('Tab 2 content')),\n");
        }
        return i + "TabBarView(\n" +
                i + "  children: [\n" +
                pages +
                i + "  ],\n" +
                i + ")";
    }

    /**
     * Dialog — custom dialog widget shown via showDialog().
     * In canvas context rendered as the dialog body itself (inside a showDialog builder).
     * Props: children rendered inside the dialog content area.
     */
    private String genDialog(WidgetNode node, ScreenDefinition screen, int ind) {
        String i     = "  ".repeat(ind);
        String title = prop(node, "title",   "");
        WidgetNode child = getFirstChild(node, screen);
        String childCode = child != null
                ? generateWidget(child, screen, ind + 2)
                : i + "  const Text('Dialog content')";
        String titleLine = title.isBlank() ? ""
                : i + "  title: const Text('" + title + "'),\n";
        return i + "Dialog(\n" +
                i + "  child: Padding(\n" +
                i + "    padding: const EdgeInsets.all(24),\n" +
                i + "    child: Column(\n" +
                i + "      mainAxisSize: MainAxisSize.min,\n" +
                i + "      children: [\n" +
                (title.isBlank() ? "" : i + "        Text('" + title + "', style: Theme.of(context).textTheme.titleLarge),\n" +
                        i + "        const SizedBox(height: 12),\n") +
                i + "        " + childCode.stripLeading() + ",\n" +
                i + "        const SizedBox(height: 16),\n" +
                i + "        Align(\n" +
                i + "          alignment: Alignment.centerRight,\n" +
                i + "          child: TextButton(\n" +
                i + "            onPressed: () => Navigator.pop(context),\n" +
                i + "            child: const Text('Close'),\n" +
                i + "          ),\n" +
                i + "        ),\n" +
                i + "      ],\n" +
                i + "    ),\n" +
                i + "  ),\n" +
                i + ")";
    }

    /**
     * BottomSheet — slide-up panel shown via showModalBottomSheet().
     * In canvas context rendered as the sheet body widget itself.
     * Props: isDismissible (bool), children rendered as sheet content.
     */
    private String genBottomSheet(WidgetNode node, ScreenDefinition screen, int ind) {
        String i = "  ".repeat(ind);
        WidgetNode child = getFirstChild(node, screen);
        String childCode = child != null
                ? generateWidget(child, screen, ind + 2)
                : i + "    const Text('Sheet content')";
        // Wrap in a builder that showModalBottomSheet would use
        return i + "// BottomSheet body — use inside showModalBottomSheet()\n" +
                i + "Container(\n" +
                i + "  padding: const EdgeInsets.all(24),\n" +
                i + "  decoration: const BoxDecoration(\n" +
                i + "    borderRadius: BorderRadius.vertical(top: Radius.circular(20)),\n" +
                i + "  ),\n" +
                i + "  child: Column(\n" +
                i + "    mainAxisSize: MainAxisSize.min,\n" +
                i + "    children: [\n" +
                i + "      Container(\n" +
                i + "        width: 40, height: 4,\n" +
                i + "        margin: const EdgeInsets.only(bottom: 16),\n" +
                i + "        decoration: BoxDecoration(\n" +
                i + "          color: Colors.grey.shade300,\n" +
                i + "          borderRadius: BorderRadius.circular(2),\n" +
                i + "        ),\n" +
                i + "      ),\n" +
                i + "      " + childCode.stripLeading() + ",\n" +
                i + "    ],\n" +
                i + "  ),\n" +
                i + ")";
    }

    /**
     * SnackBar — as a widget node on canvas, rendered as an ElevatedButton
     * that triggers a SnackBar when tapped (since SnackBar is not placed
     * directly in the widget tree — it's shown via ScaffoldMessenger).
     * Props: content (String), actionLabel (String), duration (int ms)
     */
    private String genSnackBarWidget(WidgetNode node, int ind) {
        String i           = "  ".repeat(ind);
        String content     = prop(node, "content",     "Action completed");
        String actionLabel = prop(node, "actionLabel", "Undo");
        int    duration    = propInt(node, "duration", 3000);
        int    durationSec = Math.max(1, duration / 1000);
        return i + "// SnackBar — triggered via ScaffoldMessenger (not placed inline)\n" +
                i + "ElevatedButton.icon(\n" +
                i + "  icon: const Icon(Icons.notifications_outlined),\n" +
                i + "  label: const Text('Show Snackbar'),\n" +
                i + "  onPressed: () {\n" +
                i + "    ScaffoldMessenger.of(context).showSnackBar(\n" +
                i + "      SnackBar(\n" +
                i + "        content: Text(" + strLiteral(content) + "),\n" +
                i + "        duration: const Duration(seconds: " + durationSec + "),\n" +
                i + "        action: SnackBarAction(\n" +
                i + "          label: " + strLiteral(actionLabel) + ",\n" +
                i + "          onPressed: () {},\n" +
                i + "        ),\n" +
                i + "      ),\n" +
                i + "    );\n" +
                i + "  },\n" +
                i + ")";
    }

}