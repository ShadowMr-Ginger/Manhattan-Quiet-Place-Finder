import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/providers/theme_provider.dart';
import 'package:mobile_app/core/services/locale_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ThemeProvider', () {
    test('loads saved theme and text scale preferences', () async {
      SharedPreferences.setMockInitialValues({
        'theme_preference': AppThemeMode.highContrastDark.index,
        'text_scale_preference': 1.4,
      });

      final provider = ThemeProvider();
      await pumpEventQueue();

      expect(provider.themeMode, AppThemeMode.highContrastDark);
      expect(provider.textScaleFactor, 1.4);
      expect(provider.flutterThemeMode, ThemeMode.dark);
    });

    test('ignores an invalid saved theme index', () async {
      SharedPreferences.setMockInitialValues({
        'theme_preference': 100,
      });

      final provider = ThemeProvider();
      await pumpEventQueue();

      expect(provider.themeMode, AppThemeMode.system);
      expect(provider.flutterThemeMode, ThemeMode.system);
    });

    test('updates listeners and persists new preferences', () async {
      SharedPreferences.setMockInitialValues({});
      final provider = ThemeProvider();
      await pumpEventQueue();
      var notifications = 0;
      provider.addListener(() => notifications++);

      provider.setThemeMode(AppThemeMode.highContrastLight);
      provider.setTextScaleFactor(1.25);
      await pumpEventQueue();

      final preferences = await SharedPreferences.getInstance();
      expect(provider.themeMode, AppThemeMode.highContrastLight);
      expect(provider.flutterThemeMode, ThemeMode.light);
      expect(provider.textScaleFactor, 1.25);
      expect(
        preferences.getInt('theme_preference'),
        AppThemeMode.highContrastLight.index,
      );
      expect(preferences.getDouble('text_scale_preference'), 1.25);
      expect(notifications, 2);
    });
  });

  group('LocaleProvider', () {
    test('loads a saved locale', () async {
      SharedPreferences.setMockInitialValues({'language_code': 'zh'});

      final provider = LocaleProvider();
      await pumpEventQueue();

      expect(provider.locale, const Locale('zh'));
    });

    test('persists locale changes and skips duplicate notifications', () async {
      SharedPreferences.setMockInitialValues({});
      final provider = LocaleProvider();
      await pumpEventQueue();
      var notifications = 0;
      provider.addListener(() => notifications++);

      provider.setLocale(const Locale('es'));
      await pumpEventQueue();
      provider.setLocale(const Locale('es'));
      await pumpEventQueue();

      final preferences = await SharedPreferences.getInstance();
      expect(provider.locale, const Locale('es'));
      expect(preferences.getString('language_code'), 'es');
      expect(notifications, 1);
    });
  });
}
