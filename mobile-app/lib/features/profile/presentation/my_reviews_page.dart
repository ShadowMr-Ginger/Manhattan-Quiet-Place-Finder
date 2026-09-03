import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/services/api/review_service.dart';
import '../../../core/services/api/user_service.dart';
import '../../../core/models/review_model.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/services/auth_provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import '../../auth/presentation/login_page.dart';

class MyReviewsPage extends StatelessWidget {
  const MyReviewsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        if (!authProvider.isLoggedIn) {
          return const LoginPage();
        }
        return const _MyReviewsView();
      },
    );
  }
}

class _MyReviewsView extends StatefulWidget {
  const _MyReviewsView();

  @override
  State<_MyReviewsView> createState() => _MyReviewsViewState();
}

class _MyReviewsViewState extends State<_MyReviewsView> {

  late Future<List<ReviewModel>> _myReviewsFuture;

  @override
  void initState() {
    super.initState();
    _loadMyReviews();
    UserService.dataVersion.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    UserService.dataVersion.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      _loadMyReviews();
    }
  }

  void _loadMyReviews() {
    setState(() {
      _myReviewsFuture = ReviewService().getMyReviews();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.myReviews, style: const TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      body: FutureBuilder<List<ReviewModel>>(
        future: _myReviewsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
          } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(
              child: Text(AppLocalizations.of(context)!.noReviewsFound, style: TextStyle(color: context.colors.textSecondary)),
            );
          }

          final reviews = snapshot.data!;
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
            itemCount: reviews.length,
            separatorBuilder: (context, index) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              final review = reviews[index];
              return _buildMyReviewItem(context, review);
            },
          );
        },
      ),
    );
  }

  Widget _buildMyReviewItem(BuildContext context, ReviewModel review) {
    return Semantics(
      button: true,
      label: 'View venue details for review',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () {
          if (review.venueId != null) {
            context.push('/details/${review.venueId}');
          }
        },
        child: Container(
          padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: context.colors.shadow, blurRadius: 10, offset: Offset(0, 4))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    review.venueName ?? 'Unknown Place',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: context.colors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Row(
                  children: List.generate(5, (index) => Icon(
                    LucideIcons.star,
                    color: index < review.rating ? Colors.amber : context.colors.textTertiary.withOpacity(0.5), 
                    size: 14,
                  )),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              _formatDate(review.createdAt, context),
              style: TextStyle(fontSize: 12, color: context.colors.textTertiary),
            ),
            const SizedBox(height: 12),
            Text(review.text, style: TextStyle(fontSize: 14, color: context.colors.textPrimary)),
          ],
        ),
      ),
      ),
    );
  }

  String _formatDate(String isoString, BuildContext context) {
    if (isoString.isEmpty) return AppLocalizations.of(context)!.detailsRecently;
    try {
      final date = DateTime.parse(isoString);
      return "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
    } catch (e) {
      return AppLocalizations.of(context)!.detailsRecently;
    }
  }
}
