import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_theme_colors.dart';

class AppTheme {
  static ThemeData get lightTheme {
    return _buildTheme(AppThemeColors.light, Brightness.light);
  }

  static ThemeData get darkTheme {
    return _buildTheme(AppThemeColors.dark, Brightness.dark);
  }

  static ThemeData get highContrastLightTheme {
    return _buildTheme(AppThemeColors.highContrastLight, Brightness.light);
  }

  static ThemeData get highContrastDarkTheme {
    return _buildTheme(AppThemeColors.highContrastDark, Brightness.dark);
  }

  static ThemeData _buildTheme(AppThemeColors colors, Brightness brightness) {
    return ThemeData(
      brightness: brightness,
      useMaterial3: true,
      scaffoldBackgroundColor: colors.background,
      colorScheme: ColorScheme.fromSeed(
        seedColor: colors.primary,
        brightness: brightness,
        background: colors.background,
        surface: colors.surface,
      ),
      extensions: [colors],
      
      // Typography
      textTheme: GoogleFonts.outfitTextTheme(
        ThemeData(brightness: brightness).textTheme
      ).apply(
        bodyColor: colors.textPrimary,
        displayColor: colors.textPrimary,
      ),

      // Card Theme
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 8,
        shadowColor: colors.shadow,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        margin: EdgeInsets.zero,
      ),

      // Input Decoration Theme
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: BorderSide.none,
        ),
        hintStyle: TextStyle(color: colors.textTertiary),
      ),
    );
  }
}
