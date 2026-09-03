import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Application configuration. Sensitive info is read from environment variables (see .env).
class AppConfig {
  /// Google Maps API configuration (used for map rendering and route planning)
  static String get googleMapsApiKey {
    final key = dotenv.env['GOOGLE_MAPS_API_KEY'];
    if (key == null || key.isEmpty) {
      throw Exception('GOOGLE_MAPS_API_KEY environment variable is not set, please configure in .env file');
    }
    return key;
  }

  /// Base URL for the Backend API
  static String get apiBaseUrl {
    // If running on Android emulator, try to get the Android-specific URL first
    if (!kIsWeb && Platform.isAndroid) {
      final androidUrl = dotenv.env['ANDROID_API_BASE_URL'];
      if (androidUrl != null && androidUrl.isNotEmpty) {
        return androidUrl;
      }
    }

    String? url = dotenv.env['API_BASE_URL'];
    if (url == null || url.isEmpty) {
      throw Exception('API_BASE_URL environment variable is not set, please configure in .env file');
    }

    return url;
  }
}
