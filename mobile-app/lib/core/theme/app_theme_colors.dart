import 'package:flutter/material.dart';

class AppThemeColors extends ThemeExtension<AppThemeColors> {
  final Color primary;
  final Color primaryLight;
  final Color background;
  final Color surface;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color busynessLow;
  final Color busynessMedium;
  final Color busynessHigh;
  final Color divider;
  final Color shadow;

  const AppThemeColors({
    required this.primary,
    required this.primaryLight,
    required this.background,
    required this.surface,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.busynessLow,
    required this.busynessMedium,
    required this.busynessHigh,
    required this.divider,
    required this.shadow,
  });

  @override
  ThemeExtension<AppThemeColors> copyWith({
    Color? primary,
    Color? primaryLight,
    Color? background,
    Color? surface,
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? busynessLow,
    Color? busynessMedium,
    Color? busynessHigh,
    Color? divider,
    Color? shadow,
  }) {
    return AppThemeColors(
      primary: primary ?? this.primary,
      primaryLight: primaryLight ?? this.primaryLight,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      busynessLow: busynessLow ?? this.busynessLow,
      busynessMedium: busynessMedium ?? this.busynessMedium,
      busynessHigh: busynessHigh ?? this.busynessHigh,
      divider: divider ?? this.divider,
      shadow: shadow ?? this.shadow,
    );
  }

  @override
  ThemeExtension<AppThemeColors> lerp(ThemeExtension<AppThemeColors>? other, double t) {
    if (other is! AppThemeColors) {
      return this;
    }
    return AppThemeColors(
      primary: Color.lerp(primary, other.primary, t)!,
      primaryLight: Color.lerp(primaryLight, other.primaryLight, t)!,
      background: Color.lerp(background, other.background, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      busynessLow: Color.lerp(busynessLow, other.busynessLow, t)!,
      busynessMedium: Color.lerp(busynessMedium, other.busynessMedium, t)!,
      busynessHigh: Color.lerp(busynessHigh, other.busynessHigh, t)!,
      divider: Color.lerp(divider, other.divider, t)!,
      shadow: Color.lerp(shadow, other.shadow, t)!,
    );
  }

  // Light Theme
  static const light = AppThemeColors(
    primary: Color(0xFF2563EB),
    primaryLight: Color(0xFF3B82F6),
    background: Color(0xFFF8FAFC),
    surface: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF64748B),
    textTertiary: Color(0xFF94A3B8),
    busynessLow: Color(0xFF10B981),
    busynessMedium: Color(0xFFF59E0B),
    busynessHigh: Color(0xFFEF4444),
    divider: Color(0xFFE2E8F0),
    shadow: Color(0x0C0F172A),
  );

  // Dark Theme
  static const dark = AppThemeColors(
    primary: Color(0xFF3B82F6), // Slightly lighter blue for dark mode
    primaryLight: Color(0xFF60A5FA),
    background: Color(0xFF0F172A), // Slate 900
    surface: Color(0xFF1E293B), // Slate 800
    textPrimary: Color(0xFFF8FAFC), // Slate 50
    textSecondary: Color(0xFF94A3B8), // Slate 400
    textTertiary: Color(0xFF64748B), // Slate 500
    busynessLow: Color(0xFF34D399), // Lighter emerald
    busynessMedium: Color(0xFFFBBF24), // Lighter amber
    busynessHigh: Color(0xFFF87171), // Lighter red
    divider: Color(0xFF334155), // Slate 700
    shadow: Color(0x40000000), // Stronger shadow for dark mode
  );

  // High Contrast Light Theme
  static const highContrastLight = AppThemeColors(
    primary: Color(0xFF0000FF), // Pure blue
    primaryLight: Color(0xFF0000CC),
    background: Color(0xFFFFFFFF), // Pure white
    surface: Color(0xFFF0F0F0),
    textPrimary: Color(0xFF000000), // Pure black
    textSecondary: Color(0xFF333333), // Darker grey
    textTertiary: Color(0xFF555555), // Darker grey
    busynessLow: Color(0xFF008000), // Pure green
    busynessMedium: Color(0xFFCC5500), // Burnt orange for higher contrast
    busynessHigh: Color(0xFFFF0000), // Pure red
    divider: Color(0xFF000000), // Pure black borders
    shadow: Color(0x40000000),
  );

  // High Contrast Dark Theme
  static const highContrastDark = AppThemeColors(
    primary: Color(0xFF66B2FF), // Very light blue
    primaryLight: Color(0xFF99CCFF),
    background: Color(0xFF000000), // Pure black
    surface: Color(0xFF1A1A1A),
    textPrimary: Color(0xFFFFFFFF), // Pure white
    textSecondary: Color(0xFFCCCCCC), // Light grey
    textTertiary: Color(0xFFAAAAAA), // Light grey
    busynessLow: Color(0xFF00FF00), // Bright green
    busynessMedium: Color(0xFFFFCC00), // Bright yellow
    busynessHigh: Color(0xFFFF3333), // Bright red
    divider: Color(0xFFFFFFFF), // Pure white borders
    shadow: Color(0x00000000),
  );
}

extension AppThemeColorsExtension on BuildContext {
  AppThemeColors get colors => Theme.of(this).extension<AppThemeColors>() ?? AppThemeColors.light;
}
