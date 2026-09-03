import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/widgets/place_card.dart';
import '../../../core/services/api/venue_service.dart';
import '../../../core/services/api/user_service.dart';
import '../../../core/models/venue_model.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/services/auth_provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import '../../auth/presentation/login_page.dart';

class RecentViewsPage extends StatelessWidget {
  const RecentViewsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        if (!authProvider.isLoggedIn) {
          return const LoginPage();
        }
        return const _RecentViewsView();
      },
    );
  }
}

class _RecentViewsView extends StatefulWidget {
  const _RecentViewsView();

  @override
  State<_RecentViewsView> createState() => _RecentViewsViewState();
}

class _RecentViewsViewState extends State<_RecentViewsView> {

  late Future<List<VenueModel>> _recentFuture;
  List<VenueModel> _savedVenues = [];
  final Map<String, double> _liveBusynessScores = {};
  final Set<String> _fetchingBusynessIds = {};

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

  void _loadData() async {
    final future = UserService().getRecent();
    setState(() {
      _recentFuture = future;
    });
    
    future.then((venues) {
      if (mounted) {
        _fetchBatchBusyness(venues.map((v) => v.id).toList());
      }
    });
    try {
      final saved = await UserService().getSaved();
      if (mounted) {
        setState(() {
          _savedVenues = saved;
        });
      }
    } catch (e) {
      debugPrint('Error loading saved venues: $e');
    }
  }

  Future<void> _fetchBatchBusyness(List<String> venueIds) async {
    final toFetch = venueIds.where((id) => !_fetchingBusynessIds.contains(id)).toList();
    if (toFetch.isEmpty) return;
    
    _fetchingBusynessIds.addAll(toFetch);
    const chunkSize = 5;
    for (var i = 0; i < toFetch.length; i += chunkSize) {
      final chunk = toFetch.skip(i).take(chunkSize).toList();
      await Future.wait(chunk.map((id) async {
        try {
          final profile = await VenueService().getVenueQuietProfile(id);
          final pct = profile.busyness?.currentPct;
          if (pct != null) {
            _liveBusynessScores[id] = pct;
          } else {
            _liveBusynessScores[id] = -1;
          }
        } catch (e) {
          debugPrint('Failed to fetch live busyness for $id: $e');
          _liveBusynessScores[id] = -1; 
        }
      }));
    }
    
    if (mounted) {
      setState(() {});
    }
  }

  bool _isSaved(String id) {
    return _savedVenues.any((v) => v.id == id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.recentViewsTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          icon: Icon(LucideIcons.arrow_left, color: context.colors.textPrimary),
          onPressed: () => context.pop(),
        ),
      ),
      body: FutureBuilder<List<VenueModel>>(
        future: _recentFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
          } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(AppLocalizations.of(context)!.recentNoViews, style: TextStyle(color: context.colors.textSecondary)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.go('/map'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: context.colors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    ),
                    child: Text(AppLocalizations.of(context)!.savedDiscover),
                  ),
                ],
              ),
            );
          }

          final venues = snapshot.data!;
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
            itemCount: venues.length,
            separatorBuilder: (context, index) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              final venue = venues[index];
              
              final liveScore = _liveBusynessScores[venue.id];
              return PlaceCard(
                venueId: venue.id,
                title: venue.name,
                venueType: venue.type,
                liveBusynessScore: (liveScore != null && liveScore >= 0) ? liveScore : null,
                displayRating: venue.displayRating,
                lat: venue.lat,
                lng: venue.lng,
                hours: venue.hours,
                initialIsSaved: _isSaved(venue.id),
                onSaveToggled: (isSaved) async {
                  try {
                    if (isSaved) {
                      await UserService().addSaved(venue.id);
                    } else {
                      await UserService().removeSaved(venue.id);
                    }
                    _loadData();
                  } catch (e) {
                    debugPrint('Error toggling save: $e');
                  }
                },
              );
            },
          );
        },
      ),
    );
  }
}
