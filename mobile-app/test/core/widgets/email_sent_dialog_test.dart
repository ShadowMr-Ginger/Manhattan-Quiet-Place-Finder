import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import 'package:mobile_app/core/widgets/email_sent_dialog.dart';

void main() {
  Widget testApp({required VoidCallback onButtonPressed}) {
    return MaterialApp(
      theme: ThemeData(extensions: const [AppThemeColors.light]),
      home: Builder(
        builder: (context) => Scaffold(
          body: ElevatedButton(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => EmailSentDialog(
                title: 'Check your inbox',
                message: 'We sent you a verification link.',
                buttonText: 'Continue',
                buttonIcon: LucideIcons.arrow_right,
                onButtonPressed: onButtonPressed,
              ),
            ),
            child: const Text('Open dialog'),
          ),
        ),
      ),
    );
  }

  testWidgets('renders its content and runs the primary action after closing',
      (tester) async {
    var actionCalls = 0;
    await tester.pumpWidget(
      testApp(onButtonPressed: () => actionCalls++),
    );

    await tester.tap(find.text('Open dialog'));
    await tester.pumpAndSettle();

    expect(find.text('Check your inbox'), findsOneWidget);
    expect(find.text('We sent you a verification link.'), findsOneWidget);
    expect(find.byIcon(LucideIcons.mail), findsOneWidget);
    expect(find.byIcon(LucideIcons.arrow_right), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(actionCalls, 1);
    expect(find.text('Check your inbox'), findsNothing);
  });

  testWidgets('close control dismisses without running the primary action',
      (tester) async {
    var actionCalls = 0;
    await tester.pumpWidget(
      testApp(onButtonPressed: () => actionCalls++),
    );

    await tester.tap(find.text('Open dialog'));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(LucideIcons.x));
    await tester.pumpAndSettle();

    expect(actionCalls, 0);
    expect(find.text('Check your inbox'), findsNothing);
  });
}
