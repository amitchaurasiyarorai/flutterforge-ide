package com.flutterforge.codegen.dart;

import com.flutterforge.model.FlutterForgeProject;
import org.springframework.stereotype.Component;

/**
 * Generates Material 3 theme from project theme config.
 * Full implementation in Session 2.
 */
@Component
public class DartThemeCodegen {

    public String generate(FlutterForgeProject.AppTheme theme) {
        return """
               import 'package:flutter/material.dart';

               class AppTheme {
                 static ThemeData get lightTheme => ThemeData(
                   useMaterial3: true,
                   colorScheme: ColorScheme.fromSeed(
                     seedColor: const Color(0xFF6200EA),
                     brightness: Brightness.light,
                   ),
                 );

                 static ThemeData get darkTheme => ThemeData(
                   useMaterial3: true,
                   colorScheme: ColorScheme.fromSeed(
                     seedColor: const Color(0xFF6200EA),
                     brightness: Brightness.dark,
                   ),
                 );
               }
               // Full theme generation with custom colors in Session 2
               """;
    }
}
