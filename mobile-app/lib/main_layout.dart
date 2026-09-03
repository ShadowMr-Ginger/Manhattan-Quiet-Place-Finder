import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'l10n/app_localizations.dart';
import 'package:provider/provider.dart';
import 'core/services/auth_provider.dart';
import 'core/utils/auth_utils.dart';

class MainLayout extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const MainLayout({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context) {
    final int currentIndex = navigationShell.currentIndex;
    
    return Scaffold(
      body: navigationShell,
      extendBody: true,
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 2, sigmaY: 2), // 3. Weaker blur for the full bottom area
          child: Container(
            color: context.colors.surface.withOpacity(0.15), // Very light frosted glass base
            padding: EdgeInsets.only(
              left: 32, 
              right: 32, 
              top: 0, // 2. Top area of blur ends exactly at the top of the nav bar
              bottom: MediaQuery.of(context).padding.bottom > 0 ? MediaQuery.of(context).padding.bottom : 16,
            ),
            child: ClipRRect( // 1. Restoring the exact pill style from version 1
              borderRadius: BorderRadius.circular(40),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  decoration: BoxDecoration(
                    color: context.colors.surface.withOpacity(0.4), // 0.4 transparency
                    borderRadius: BorderRadius.circular(40),
                    // No drop shadow
                    border: Border.all(color: Colors.white.withOpacity(0.6), width: 1.5), // Highlight edge
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildNavItem(LucideIcons.compass, AppLocalizations.of(context)!.discovery, 0, currentIndex, context),
              _buildNavItem(LucideIcons.list, AppLocalizations.of(context)!.list, 1, currentIndex, context),
              _buildNavItem(LucideIcons.bookmark, AppLocalizations.of(context)!.saved, 2, currentIndex, context),
              _buildNavItem(LucideIcons.user, AppLocalizations.of(context)!.profile, 3, currentIndex, context),
            ],
          ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, int index, int currentIndex, BuildContext context) {
    final isSelected = index == currentIndex;
    
    return Semantics(
      button: true,
      label: label,
      selected: isSelected,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () => _onItemTapped(index, context),
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          // Light grey background for the selected item, just like the screenshot
          color: isSelected ? context.colors.divider.withOpacity(0.6) : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon, 
              size: 24,
              color: isSelected ? context.colors.primary : context.colors.textPrimary,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected ? context.colors.primary : context.colors.textPrimary,
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  void _onItemTapped(int index, BuildContext context) {
    if (index == 2 || index == 3) {
      final isLoggedIn = context.read<AuthProvider>().isLoggedIn;
      if (!isLoggedIn) {
        final actionName = index == 2 ? 'view saved places' : 'view your profile';
        AuthUtils.showLoginRequiredDialog(context, actionName);
        return;
      }
    }

    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }
}
