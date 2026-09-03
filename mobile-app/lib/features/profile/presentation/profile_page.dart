import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/services/auth_provider.dart';
import '../../auth/presentation/login_page.dart';
import '../../../core/services/api/user_service.dart';
import '../../../core/models/venue_model.dart';
import '../../../core/services/api/review_service.dart';
import '../../../core/models/review_model.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/services/locale_provider.dart';
import '../../../core/providers/filter_provider.dart';
import '../../../core/providers/theme_provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:auto_size_text/auto_size_text.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        if (!authProvider.isLoggedIn) {
          return const LoginPage();
        }
        return const _ProfileView();
      },
    );
  }
}

class _ProfileView extends StatefulWidget {
  const _ProfileView();

  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  late Future<List<dynamic>> _dataFuture;
  final AutoSizeGroup _labelAutoSizeGroup = AutoSizeGroup();

  void _loadData() {
    setState(() {
      _dataFuture = Future.wait([
        UserService().getProfile(),
        UserService().getRecent(),
        ReviewService().getMyReviews(),
      ]);
    });
  }

  @override
  void initState() {
    super.initState();
    _loadData();
    UserService.dataVersion.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    UserService.dataVersion.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      body: FutureBuilder<List<dynamic>>(
        future: _dataFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }
          if (!snapshot.hasData) return const SizedBox();

          final profileData = snapshot.data![0] as Map<String, dynamic>;
          final recentPlaces = snapshot.data![1] as List<VenueModel>;
          final myReviews = snapshot.data![2] as List<ReviewModel>;
          
          final user = profileData['user'];
          final stats = profileData['stats'];
          final savedPlacesCount = stats['saved'] ?? 0;
          final recentPlacesCount = recentPlaces.length;
          final myReviewsCount = myReviews.length;
          final userName = user['name'] ?? '';
          final userEmail = user['email'] ?? '';

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Stack(
                  alignment: Alignment.topCenter,
                  children: [
                    // Background Gradient Header (Fixed height behind content)
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 300,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              context.colors.primaryLight,
                              context.colors.primary,
                            ],
                          ),
                          borderRadius: const BorderRadius.only(
                            bottomLeft: Radius.circular(40),
                            bottomRight: Radius.circular(40),
                          ),
                        ),
                      ),
                    ),
                    
                    // Content Column (Avatar, Text, and Stats Cards)
                    Column(
                      children: [
                        SizedBox(height: MediaQuery.of(context).padding.top + 32),
                        // Avatar Ring
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                          ),
                          child: Container(
                            width: 80,
                            height: 80,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                userName.isNotEmpty 
                                    ? userName[0].toUpperCase() 
                                    : 'U',
                                style: TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.bold,
                                  color: context.colors.primary,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          userName,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          userEmail,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.white.withOpacity(0.8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 32), // Spacer before stats cards
                        
                        // Stats Cards Overlapping Background
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildStatCard(AppLocalizations.of(context)!.saved, savedPlacesCount.toString(), LucideIcons.bookmark, context.colors.busynessMedium, _labelAutoSizeGroup, onTap: () => context.go('/saved')),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatCard(AppLocalizations.of(context)!.recentViews, recentPlacesCount.toString(), LucideIcons.history, context.colors.primary, _labelAutoSizeGroup, onTap: () => context.push('/recent')),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatCard(AppLocalizations.of(context)!.myReviews, myReviewsCount.toString(), LucideIcons.message_square, context.colors.textSecondary, _labelAutoSizeGroup, onTap: () => context.push('/my-reviews')),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    
                    // Logout Button
                    Positioned(
                      top: MediaQuery.of(context).padding.top + 16,
                      right: 24,
                      child: IconButton(
                        icon: const Icon(LucideIcons.log_out, color: Colors.white),
                        onPressed: () {
                          // Clear all filters before logging out to ensure a clean state
                          context.read<FilterProvider>().clearAll();
                          context.read<AuthProvider>().logout();
                        },
                        tooltip: AppLocalizations.of(context)!.logout,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Lists
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 100), // Padding for bottom nav
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _buildSectionTitle(AppLocalizations.of(context)!.settings),
                    const SizedBox(height: 12),
                    _buildSettingsTile(
                      title: AppLocalizations.of(context)!.language,
                      icon: LucideIcons.globe,
                      onTap: () => _showLanguageDialog(context),
                    ),
                    const SizedBox(height: 12),
                    _buildSettingsTile(
                      title: 'Appearance',
                      icon: LucideIcons.palette,
                      onTap: () => _showThemeDialog(context),
                    ),
                    const SizedBox(height: 12),
                    _buildSettingsTile(
                      title: 'Text Size',
                      icon: LucideIcons.type,
                      onTap: () => _showTextSizeDialog(context),
                    ),
                    const SizedBox(height: 12),
                    _buildSettingsTile(
                      title: AppLocalizations.of(context)!.seeOurWeb,
                      icon: LucideIcons.external_link,
                      onTap: () async {
                        final url = Uri.parse('https://43.157.51.61/');
                        try {
                          await launchUrl(url, mode: LaunchMode.externalApplication);
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(AppLocalizations.of(context)!.couldNotLaunchWebsite)),
                            );
                          }
                        }
                      },
                    ),
                  ]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatCard(String label, String count, IconData icon, Color color, AutoSizeGroup group, {VoidCallback? onTap}) {
    return Semantics(
      button: true,
      label: label,
      value: count,
      child: GestureDetector(
        onTap: onTap,
        child: ExcludeSemantics(
          child: Container(
        padding: EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: context.colors.shadow,
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              count,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: context.colors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 4),
                Flexible(
                  child: AutoSizeText(
                    label.toUpperCase(),
                    group: group,
                    maxLines: 1,
                    minFontSize: 6,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: context.colors.textSecondary,
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

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
        color: context.colors.textTertiary,
      ),
    );
  }

  void _showLanguageDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(AppLocalizations.of(context)!.selectLanguage, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: context.colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: Text(AppLocalizations.of(context)!.english, style: TextStyle(color: context.colors.textPrimary)),
              onTap: () {
                context.read<LocaleProvider>().setLocale(const Locale('en'));
                Navigator.pop(context);
              },
            ),
            const Divider(),
            ListTile(
              title: Text(AppLocalizations.of(context)!.chinese, style: TextStyle(color: context.colors.textPrimary)),
              onTap: () {
                context.read<LocaleProvider>().setLocale(const Locale('zh'));
                Navigator.pop(context);
              },
            ),
            const Divider(),
            ListTile(
              title: Text(AppLocalizations.of(context)!.spanish, style: TextStyle(color: context.colors.textPrimary)),
              onTap: () {
                context.read<LocaleProvider>().setLocale(const Locale('es'));
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showThemeDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        final currentMode = context.read<ThemeProvider>().themeMode;
        return AlertDialog(
          title: const Text('Appearance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          backgroundColor: context.colors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<AppThemeMode>(
                title: Text('System Default', style: TextStyle(color: context.colors.textPrimary)),
                value: AppThemeMode.system,
                groupValue: currentMode,
                onChanged: (mode) {
                  if (mode != null) context.read<ThemeProvider>().setThemeMode(mode);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              RadioListTile<AppThemeMode>(
                title: Text('Light', style: TextStyle(color: context.colors.textPrimary)),
                value: AppThemeMode.light,
                groupValue: currentMode,
                onChanged: (mode) {
                  if (mode != null) context.read<ThemeProvider>().setThemeMode(mode);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              RadioListTile<AppThemeMode>(
                title: Text('Dark', style: TextStyle(color: context.colors.textPrimary)),
                value: AppThemeMode.dark,
                groupValue: currentMode,
                onChanged: (mode) {
                  if (mode != null) context.read<ThemeProvider>().setThemeMode(mode);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              const Divider(),
              RadioListTile<AppThemeMode>(
                title: Text('High Contrast Light', style: TextStyle(color: context.colors.textPrimary)),
                value: AppThemeMode.highContrastLight,
                groupValue: currentMode,
                onChanged: (mode) {
                  if (mode != null) context.read<ThemeProvider>().setThemeMode(mode);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              RadioListTile<AppThemeMode>(
                title: Text('High Contrast Dark', style: TextStyle(color: context.colors.textPrimary)),
                value: AppThemeMode.highContrastDark,
                groupValue: currentMode,
                onChanged: (mode) {
                  if (mode != null) context.read<ThemeProvider>().setThemeMode(mode);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
            ],
          ),
        );
      },
    );
  }

  void _showTextSizeDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        final currentScale = context.watch<ThemeProvider>().textScaleFactor;
        return AlertDialog(
          title: const Text('Text Size', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          backgroundColor: context.colors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<double>(
                title: Text('Small', style: TextStyle(color: context.colors.textPrimary)),
                value: 0.85,
                groupValue: currentScale,
                onChanged: (scale) {
                  if (scale != null) context.read<ThemeProvider>().setTextScaleFactor(scale);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              RadioListTile<double>(
                title: Text('Standard', style: TextStyle(color: context.colors.textPrimary)),
                value: 1.0,
                groupValue: currentScale,
                onChanged: (scale) {
                  if (scale != null) context.read<ThemeProvider>().setTextScaleFactor(scale);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              RadioListTile<double>(
                title: Text('Large', style: TextStyle(color: context.colors.textPrimary)),
                value: 1.15,
                groupValue: currentScale,
                onChanged: (scale) {
                  if (scale != null) context.read<ThemeProvider>().setTextScaleFactor(scale);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
              RadioListTile<double>(
                title: Text('Extra Large', style: TextStyle(color: context.colors.textPrimary)),
                value: 1.3,
                groupValue: currentScale,
                onChanged: (scale) {
                  if (scale != null) context.read<ThemeProvider>().setTextScaleFactor(scale);
                  Navigator.pop(context);
                },
                activeColor: context.colors.primary,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSettingsTile({
    required String title,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: context.colors.shadow,
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          leading: Icon(icon, color: context.colors.primary),
          title: Text(
            title,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: context.colors.textPrimary,
            ),
          ),
          trailing: Icon(LucideIcons.chevron_right, color: context.colors.textTertiary),
          onTap: onTap,
        ),
      ),
    );
  }
}
