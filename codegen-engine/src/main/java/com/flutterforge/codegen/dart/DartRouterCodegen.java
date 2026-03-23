package com.flutterforge.codegen.dart;

import com.flutterforge.model.FlutterForgeProject;
import org.springframework.stereotype.Component;

/**
 * Generates GoRouter configuration from project screens.
 * Full implementation in Session 2.
 */
@Component
public class DartRouterCodegen {

    public String generate(FlutterForgeProject project) {
        StringBuilder sb = new StringBuilder();
        sb.append("import 'package:go_router/go_router.dart';\n\n");
        sb.append("// TODO: Full GoRouter generation in Session 2\n");
        sb.append("final appRouter = GoRouter(\n");
        sb.append("  initialLocation: '").append(project.getInitialRoute()).append("',\n");
        sb.append("  routes: [\n");

        if (project.getScreens() != null) {
            project.getScreens().forEach((id, screen) -> {
                sb.append("    GoRoute(\n");
                sb.append("      path: '").append(screen.getRoute()).append("',\n");
                sb.append("      builder: (context, state) => const Placeholder(),\n");
                sb.append("    ),\n");
            });
        }

        sb.append("  ],\n);\n");
        return sb.toString();
    }
}
