import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/services/auth_provider.dart';
import '../../../core/widgets/email_sent_dialog.dart';
import 'package:flutter_lucide/flutter_lucide.dart';

class SignupPage extends StatefulWidget {
  const SignupPage({super.key});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  void _handleSignup() async {
    if (_nameController.text.isEmpty || _emailController.text.isEmpty || _passwordController.text.isEmpty) return;
    
    setState(() => _isLoading = true);
    try {
      await context.read<AuthProvider>().register(
        _nameController.text,
        _emailController.text, 
        _passwordController.text
      );
      // Success, show a dialog to verify email, then go to login
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => EmailSentDialog(
            title: 'Check your email',
            message: "We've sent a verification link to your email. Click it to activate your account.",
            buttonText: 'Log in',
            buttonIcon: LucideIcons.log_in,
            onButtonPressed: () {
              if (context.canPop()) {
                context.pop(); // Go back to login
              } else {
                context.go('/profile'); 
              }
            },
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = e.toString();
        if (errorMessage.startsWith('Exception: ')) {
          errorMessage = errorMessage.substring(11);
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo or Icon
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: context.colors.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    LucideIcons.user_plus,
                    size: 40,
                    color: context.colors.primary,
                  ),
                ),
                const SizedBox(height: 32),
                
                // Welcome Text
                Text(
                  'Create an account',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: context.colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Join us to save and review study spaces.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: context.colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 48),

                // Name Input
                TextField(
                  controller: _nameController,
                  keyboardType: TextInputType.name,
                  decoration: InputDecoration(
                    hintText: 'Full Name',
                    prefixIcon: Padding(
                      padding: EdgeInsets.only(left: 16.0, right: 12.0),
                      child: Icon(LucideIcons.user, color: context.colors.textTertiary),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Email Input
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    hintText: 'Email address',
                    prefixIcon: Padding(
                      padding: EdgeInsets.only(left: 16.0, right: 12.0),
                      child: Icon(LucideIcons.mail, color: context.colors.textTertiary),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Password Input
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    hintText: 'Password',
                    prefixIcon: Padding(
                      padding: EdgeInsets.only(left: 16.0, right: 12.0),
                      child: Icon(LucideIcons.lock, color: context.colors.textTertiary),
                    ),
                  ),
                ),
                const SizedBox(height: 40),

                // Signup Button
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleSignup,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: context.colors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 4,
                    shadowColor: context.colors.primary.withOpacity(0.4),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.user_plus, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Sign up',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                ),
                const SizedBox(height: 32),
                
                // Login Link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Already have an account? ",
                      style: TextStyle(
                        color: context.colors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                    Semantics(
                      button: true,
                      label: 'Log in',
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: () {
                          if (context.canPop()) {
                            context.pop();
                          } else {
                            context.go('/profile'); 
                          }
                        },
                        child: Text(
                          'Log in',
                          style: TextStyle(
                            color: context.colors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
