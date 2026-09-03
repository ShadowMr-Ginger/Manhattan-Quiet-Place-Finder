import 'package:flutter/material.dart';
import 'router/app_router.dart';
import 'package:mobile_app/core/theme/app_theme.dart';
import 'package:mobile_app/core/providers/theme_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:provider/provider.dart';
import 'core/services/auth_provider.dart';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'l10n/app_localizations.dart';
import 'core/services/locale_provider.dart';
import 'core/providers/filter_provider.dart';
import 'core/providers/location_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: ".env");
  
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('access_token');
  final hasInitialAuth = token != null && token.isNotEmpty;
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(hasInitialAuth: hasInitialAuth)),
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => FilterProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final localeProvider = context.watch<LocaleProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    
    return MaterialApp.router(
      title: 'Manhattan Study Spaces',
      locale: localeProvider.locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en'),
        Locale('zh'),
        Locale('es'),
      ],
      debugShowCheckedModeBanner: false,
      themeMode: themeProvider.flutterThemeMode,
      theme: themeProvider.themeMode == AppThemeMode.highContrastLight 
          ? AppTheme.highContrastLightTheme 
          : AppTheme.lightTheme,
      darkTheme: themeProvider.themeMode == AppThemeMode.highContrastDark 
          ? AppTheme.highContrastDarkTheme 
          : AppTheme.darkTheme,
      highContrastTheme: AppTheme.highContrastLightTheme,
      highContrastDarkTheme: AppTheme.highContrastDarkTheme,
      routerConfig: appRouter,
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(themeProvider.textScaleFactor),
          ),
          child: child!,
        );
      },
    );
  }
}
