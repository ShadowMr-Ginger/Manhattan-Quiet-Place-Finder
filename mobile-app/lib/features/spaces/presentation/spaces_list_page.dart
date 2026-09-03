import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/widgets/place_card.dart';
import '../../../core/services/api/venue_service.dart';
import '../../../core/models/venue_model.dart';
import '../../../core/services/api/user_service.dart';
import '../../../l10n/app_localizations.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/filter_provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import '../../../core/providers/location_provider.dart';
import 'package:geolocator/geolocator.dart';
import '../../../core/utils/auth_utils.dart';

class SpacesListPage extends StatefulWidget {
  const SpacesListPage({super.key});

  @override
  State<SpacesListPage> createState() => _SpacesListPageState();
}

enum SortOption { none, rating, busyness, distance }

class _SpacesListPageState extends State<SpacesListPage> {
  late Future<List<VenueModel>> _venuesFuture;
  List<VenueModel> _savedVenues = [];
  SortOption _currentSort = SortOption.distance;

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
    final future = VenueService().getVenues();
    setState(() {
      _venuesFuture = future;
    });
    
    future.then((venues) {
      if (mounted) {
        // No longer fetching batch busyness since crowdedness is in the summary
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


  bool _isSaved(String id) {
    return _savedVenues.any((v) => v.id == id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.listStudySpaces, style: const TextStyle(fontWeight: FontWeight.w600)),
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
        future: _venuesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
          } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(child: Text(AppLocalizations.of(context)!.listNoSpaces));
          }

          var venues = snapshot.data!;
          final filterProvider = context.watch<FilterProvider>();
          final locationProvider = context.watch<LocationProvider>();
          
          // Search query text filtering has been removed because the List view is now fully 
          // synchronized with the Map's visible venues (via visibleVenueIds), 
          // and the map search bar only flies the camera to a location instead of filtering by name.


          if (filterProvider.selectedTags.isNotEmpty) {
            venues = venues.where((v) {
              final type = v.type.toLowerCase();
              bool matches = false;
              for (final tag in filterProvider.selectedTags) {
                if (tag == 'Cafe' && type.contains('cafe')) matches = true;
                if (tag == 'Library' && type.contains('library')) matches = true;
                if (tag == 'Public Study Area' && !type.contains('cafe') && !type.contains('library')) matches = true;
              }
              return matches;
            }).toList();
          }

          // Sync with Map Discovery view: only show venues that are currently visible on the map
          if (filterProvider.visibleVenueIds != null) {
            final visibleIds = filterProvider.visibleVenueIds!;
            venues = venues.where((v) => visibleIds.contains(v.id)).toList();
          }

          if (_currentSort == SortOption.rating) {
            venues.sort((a, b) => b.displayRating.compareTo(a.displayRating));
          } else if (_currentSort == SortOption.busyness) {
            venues.sort((a, b) {
              int getScore(String? c) {
                if (c == 'low') return 1;
                if (c == 'medium') return 2;
                if (c == 'high') return 3;
                return 999;
              }
              final valA = getScore(a.crowdedness);
              final valB = getScore(b.crowdedness);
              return valA.compareTo(valB);
            });
          } else if (_currentSort == SortOption.distance && locationProvider.hasLocation) {
            final pos = locationProvider.currentPosition!;
            venues.sort((a, b) {
              final distA = Geolocator.distanceBetween(pos.latitude, pos.longitude, a.lat, a.lng);
              final distB = Geolocator.distanceBetween(pos.latitude, pos.longitude, b.lat, b.lng);
              return distA.compareTo(distB);
            });
          }

          final listWidget = venues.isEmpty 
            ? Center(child: Text(AppLocalizations.of(context)!.listNoSpaces))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                itemCount: venues.length,
            separatorBuilder: (context, index) => const SizedBox(height: 16),
            itemBuilder: (context, index) {
              final venue = venues[index];
              return PlaceCard(
                venueId: venue.id,
                title: venue.name,
                venueType: venue.type,
                displayRating: venue.displayRating,
                lat: venue.lat,
                lng: venue.lng,
                hours: venue.hours,
                crowdedness: venue.crowdedness,
                initialIsSaved: _isSaved(venue.id),
                onSaveToggled: (isSaved) async {
                  try {
                    if (isSaved) {
                      await UserService().addSaved(venue.id);
                    } else {
                      await UserService().removeSaved(venue.id);
                    }
                  } catch (e) {
                    debugPrint('Error toggling save: $e');
                  }
                },
              );
            },
          );

          return Column(
            children: [
              _buildChipsRow(context, filterProvider),
              Expanded(child: listWidget),
            ],
          );
        },
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 120),
        child: FloatingActionButton(
          heroTag: 'list_chat_fab',
          onPressed: () => AuthUtils.executeWithLogin(context, 'use AI assistant', () => context.push('/chat')),
          backgroundColor: Colors.cyan,
          child: const Icon(LucideIcons.bot, color: Colors.white),
        ),
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

  Widget _buildChipsRow(BuildContext context, FilterProvider filterProvider) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
      child: Row(
        children: [
          if (filterProvider.selectedTags.isNotEmpty) ...[
            _buildClearAllChip(context),
            const SizedBox(width: 10),
          ],
          _buildInteractiveFilterChip(context, 'Cafe', filterProvider),
          const SizedBox(width: 8),
          _buildInteractiveFilterChip(context, 'Library', filterProvider),
          const SizedBox(width: 8),
          _buildInteractiveFilterChip(context, 'Public Study Area', filterProvider),
        ],
      ),
    );
  }

  Widget _buildInteractiveFilterChip(BuildContext context, String tag, FilterProvider filterProvider) {
    String uiLabel = tag;
    if (tag == 'Cafe') uiLabel = AppLocalizations.of(context)!.mapCafe;
    if (tag == 'Library') uiLabel = AppLocalizations.of(context)!.mapLibrary;
    if (tag == 'Public Study Area') uiLabel = 'Public Study Area';

    final isSelected = filterProvider.selectedTags.contains(tag);

    return Semantics(
      button: true,
      selected: isSelected,
      label: uiLabel,
      child: GestureDetector(
        onTap: () {
        filterProvider.toggleTag(tag);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? context.colors.primary : context.colors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: isSelected ? context.colors.primary : context.colors.divider),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(
              child: Text(
                uiLabel,
                style: TextStyle(
                  color: isSelected ? Colors.white : context.colors.textPrimary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  fontSize: 14,
                ),
              ),
            ),
            if (isSelected) ...[
              const SizedBox(width: 4),
              const Icon(LucideIcons.x, size: 14, color: Colors.white),
            ]
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildClearAllChip(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Clear All',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () {
        context.read<FilterProvider>().clearAll();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.redAccent,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Clear All',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
            SizedBox(width: 4),
            Icon(LucideIcons.x, size: 14, color: Colors.white),
          ],
        ),
      ),
      ),
    );
  }
}
