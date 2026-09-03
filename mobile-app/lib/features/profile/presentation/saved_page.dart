import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/widgets/place_card.dart';
import '../../../core/services/api/user_service.dart';
import '../../../core/services/api/venue_service.dart';
import '../../../core/models/venue_model.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/services/auth_provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import '../../auth/presentation/login_page.dart';
import '../../../core/providers/location_provider.dart';
import 'package:geolocator/geolocator.dart';

class SavedPage extends StatelessWidget {
  const SavedPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        if (!authProvider.isLoggedIn) {
          return const LoginPage();
        }
        return const _SavedView();
      },
    );
  }
}

class _SavedView extends StatefulWidget {
  const _SavedView();

  @override
  State<_SavedView> createState() => _SavedViewState();
}

enum SortOption { none, rating, busyness, distance }

class _SavedViewState extends State<_SavedView> {
  late Future<List<VenueModel>> _savedFuture;
  SortOption _currentSort = SortOption.distance;
  final Map<String, double> _liveBusynessScores = {};
  final Set<String> _fetchingBusynessIds = {};

  void _loadSaved() {
    final future = UserService().getSaved();
    setState(() {
      _savedFuture = future;
    });
    future.then((venues) {
      if (mounted) {
        _fetchBatchBusyness(venues.map((v) => v.id).toList());
      }
    });
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

  @override
  void initState() {
    super.initState();
    _loadSaved();
    UserService.dataVersion.addListener(_onDataChanged);
  }

  @override
  void dispose() {
    UserService.dataVersion.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      _loadSaved();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.savedSpacesTitle, style: const TextStyle(fontWeight: FontWeight.w600)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        actions: [
          IconButton(
            icon: Icon(LucideIcons.arrow_up_down, color: context.colors.textPrimary),
            onPressed: _showSortMenu,
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: FutureBuilder<List<VenueModel>>(
        future: _savedFuture,
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
                  Text(AppLocalizations.of(context)!.savedNoSpaces, style: TextStyle(color: context.colors.textSecondary)),
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
          
          if (_currentSort == SortOption.rating) {
            venues.sort((a, b) => b.displayRating.compareTo(a.displayRating));
          } else if (_currentSort == SortOption.busyness) {
            venues.sort((a, b) {
              final scoreA = _liveBusynessScores[a.id];
              final scoreB = _liveBusynessScores[b.id];
              final valA = (scoreA != null && scoreA >= 0) ? scoreA : 999.0;
              final valB = (scoreB != null && scoreB >= 0) ? scoreB : 999.0;
              return valA.compareTo(valB);
            });
          } else if (_currentSort == SortOption.distance) {
            final locationProvider = context.read<LocationProvider>();
            if (locationProvider.hasLocation) {
              final pos = locationProvider.currentPosition!;
              venues.sort((a, b) {
                final distA = Geolocator.distanceBetween(pos.latitude, pos.longitude, a.lat, a.lng);
                final distB = Geolocator.distanceBetween(pos.latitude, pos.longitude, b.lat, b.lng);
                return distA.compareTo(distB);
              });
            }
          }

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
                initialIsSaved: true,
                onSaveToggled: (isSaved) async {
                  try {
                    if (isSaved) {
                      await UserService().addSaved(venue.id);
                    } else {
                      await UserService().removeSaved(venue.id);
                    }
                    if (mounted) {
                      _loadSaved();
                    }
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

  void _showSortMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('Sort By', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),

              ListTile(
                leading: const Icon(LucideIcons.star),
                title: const Text('Rating (Highest first)'),
                trailing: _currentSort == SortOption.rating ? Icon(Icons.check, color: context.colors.primary) : null,
                onTap: () {
                  setState(() => _currentSort = SortOption.rating);
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(LucideIcons.users),
                title: const Text('Busyness (Least crowded first)'),
                trailing: _currentSort == SortOption.busyness ? Icon(Icons.check, color: context.colors.primary) : null,
                onTap: () {
                  setState(() => _currentSort = SortOption.busyness);
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(LucideIcons.map_pin),
                title: const Text('Distance (Nearest first)'),
                trailing: _currentSort == SortOption.distance ? Icon(Icons.check, color: context.colors.primary) : null,
                onTap: () {
                  setState(() => _currentSort = SortOption.distance);
                  Navigator.pop(context);
                },
              ),
              if (_currentSort != SortOption.none)
                ListTile(
                  leading: const Icon(LucideIcons.x, color: Colors.red),
                  title: const Text('Clear Sort', style: TextStyle(color: Colors.red)),
                  onTap: () {
                    setState(() => _currentSort = SortOption.none);
                    Navigator.pop(context);
                  },
                ),
            ],
          ),
        );
      }
    );
  }
}
