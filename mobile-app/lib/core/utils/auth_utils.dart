import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../../features/auth/presentation/login_page.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';

class AuthUtils {
  static Future<void> executeWithLogin(BuildContext context, String actionMessage, FutureOr<void> Function() action) async {
    final auth = context.read<AuthProvider>();
    if (auth.isLoggedIn) {
      await action();
    } else {
      showDialog(
        context: context,
        builder: (BuildContext dialogContext) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text('Login Required'),
            content: Text('You need to be logged in to $actionMessage.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: Text('Cancel', style: TextStyle(color: context.colors.textSecondary)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.colors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () async {
                  Navigator.of(dialogContext).pop(); // Close dialog
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const LoginPage()),
                  );
                  if (auth.isLoggedIn && context.mounted) {
                    await action();
                  }
                },
                child: const Text('Login'),
              ),
            ],
          );
        },
      );
    }
  }

  static void showLoginRequiredDialog(BuildContext context, String actionMessage) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Login Required'),
          content: Text('You need to be logged in to $actionMessage.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('Cancel', style: TextStyle(color: context.colors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: context.colors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.of(context).pop(); // Close dialog
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginPage()),
                );
              },
              child: const Text('Login'),
            ),
          ],
        );
      },
    );
  }
}
