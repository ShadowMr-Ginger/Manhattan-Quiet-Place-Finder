import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppThemeMode {
  system,
  light,
  dark,
  highContrastLight,
  highContrastDark,
}

class ThemeProvider extends ChangeNotifier {
  static const String _themeKey = 'theme_preference';
  static const String _textScaleKey = 'text_scale_preference';
  
  AppThemeMode _themeMode = AppThemeMode.system;
  double _textScaleFactor = 1.0;
  
  AppThemeMode get themeMode => _themeMode;
  double get textScaleFactor => _textScaleFactor;

  ThemeProvider() {
    _loadPreferences();
  }

  void setThemeMode(AppThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_themeKey, mode.index);
  }

  void setTextScaleFactor(double scale) async {
    _textScaleFactor = scale;
    notifyListeners();
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_textScaleKey, scale);
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    
    // Load theme
    final savedThemeIndex = prefs.getInt(_themeKey);
    if (savedThemeIndex != null && savedThemeIndex >= 0 && savedThemeIndex < AppThemeMode.values.length) {
      _themeMode = AppThemeMode.values[savedThemeIndex];
    }
    
    // Load text scale
    final savedTextScale = prefs.getDouble(_textScaleKey);
    if (savedTextScale != null) {
      _textScaleFactor = savedTextScale;
    }
    
    notifyListeners();
  }

  // Helper method to convert AppThemeMode to Flutter's ThemeMode
  ThemeMode get flutterThemeMode {
    switch (_themeMode) {
      case AppThemeMode.light:
      case AppThemeMode.highContrastLight:
        return ThemeMode.light;
      case AppThemeMode.dark:
      case AppThemeMode.highContrastDark:
        return ThemeMode.dark;
      case AppThemeMode.system:
        return ThemeMode.system;
    }
  }
}
