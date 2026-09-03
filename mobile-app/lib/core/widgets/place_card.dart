import 'package:flutter/material.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';

import 'package:go_router/go_router.dart';
import '../../l10n/app_localizations.dart';
import '../models/venue_model.dart';
import '../models/quiet_profile_model.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../providers/location_provider.dart';
import '../utils/location_utils.dart';
import '../utils/auth_utils.dart';
import '../services/auth_provider.dart';

import '../services/api/venue_service.dart';

class PlaceCard extends StatefulWidget {
  final String venueId;
  final String title;
  final String venueType;
  final double? liveBusynessScore;
  final double displayRating;
  final double lat;
  final double lng;
  final String? hours;
  final String? crowdedness;
  final bool initialIsSaved;
  final void Function(bool)? onSaveToggled;

  const PlaceCard({
    super.key,
    required this.venueId,
    required this.title,
    required this.venueType,
    this.liveBusynessScore,
    required this.displayRating,
    required this.lat,
    required this.lng,
    this.hours,
    this.crowdedness,
    required this.initialIsSaved,
    this.onSaveToggled,
  });

  @override
  State<PlaceCard> createState() => _PlaceCardState();
}

class _PlaceCardState extends State<PlaceCard> {
  late bool _isSaved;
  String? _hours;
  double? _liveBusynessScore;
  bool _isLoadingData = false;

  @override
  void initState() {
    super.initState();
    _isSaved = widget.initialIsSaved;
    _hours = widget.hours;
    _liveBusynessScore = widget.liveBusynessScore;
    
    if ((_hours == null || _hours!.isEmpty) || _liveBusynessScore == null) {
      _fetchDetails();
    }
  }

  Future<void> _fetchDetails() async {
    if (!mounted) return;
    setState(() {
      _isLoadingData = true;
    });
    try {
      final futures = <Future<dynamic>>[];
      
      final needsHours = _hours == null || _hours!.isEmpty;
      final needsBusyness = _liveBusynessScore == null && widget.crowdedness == null;

      if (needsHours) {
        futures.add(VenueService().getVenueDetails(widget.venueId));
      } else {
        futures.add(Future.value(null));
      }

      if (needsBusyness) {
        futures.add(VenueService().getVenueQuietProfile(widget.venueId));
      } else {
        futures.add(Future.value(null));
      }

      final results = await Future.wait(futures);

      if (mounted) {
        setState(() {
          if (needsHours && results[0] != null) {
            _hours = (results[0] as VenueModel).hours;
          }
          if (needsBusyness && results[1] != null) {
            _liveBusynessScore = (results[1] as QuietProfileModel).busyness?.currentPct;
          }
        });
      }
    } catch (e) {
      debugPrint('Error fetching details: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingData = false;
        });
      }
    }
  }

  void _toggleSave() {
    final isLoggedIn = context.read<AuthProvider>().isLoggedIn;
    if (!isLoggedIn) {
      AuthUtils.showLoginRequiredDialog(context, 'save this place');
      return;
    }

    setState(() {
      _isSaved = !_isSaved;
    });
    if (widget.onSaveToggled != null) {
      widget.onSaveToggled!(_isSaved);
    }
  }

  @override
  Widget build(BuildContext context) {
    Color busynessColor = context.colors.textTertiary;
    String busynessLabel = 'Unknown';
    
    if (widget.crowdedness != null) {
      if (widget.crowdedness == 'low') {
        busynessLabel = AppLocalizations.of(context)!.mapNotCrowded;
        busynessColor = context.colors.busynessLow;
      } else if (widget.crowdedness == 'medium') {
        busynessLabel = AppLocalizations.of(context)!.mapModerate;
        busynessColor = context.colors.busynessMedium;
      } else if (widget.crowdedness == 'high') {
        busynessLabel = AppLocalizations.of(context)!.mapCrowded;
        busynessColor = context.colors.busynessHigh;
      } else {
        busynessLabel = '--';
      }
    } else if (_liveBusynessScore != null) {
      if (_liveBusynessScore! < 8) {
        busynessLabel = AppLocalizations.of(context)!.mapNotCrowded;
        busynessColor = context.colors.busynessLow;
      } else if (_liveBusynessScore! < 25) {
        busynessLabel = AppLocalizations.of(context)!.mapModerate;
        busynessColor = context.colors.busynessMedium;
      } else {
        busynessLabel = AppLocalizations.of(context)!.mapCrowded;
        busynessColor = context.colors.busynessHigh;
      }
    } else {
      busynessLabel = '--';
    }

    Color venueColor;
    IconData venueIcon;
    final typeLower = widget.venueType.toLowerCase();
    final isCafe = typeLower.contains('cafe') || typeLower.contains('coffee');
    final isLibrary = typeLower.contains('library');

    if (isCafe) {
      venueColor = Colors.orange;
      venueIcon = LucideIcons.coffee;
    } else if (isLibrary) {
      venueColor = Colors.blue;
      venueIcon = LucideIcons.book_open;
    } else {
      // Anything else (e.g. hotel, restaurant, other) is treated as a Public Study Area
      venueColor = context.colors.busynessLow; // Emerald
      venueIcon = LucideIcons.trees;
    }

    final isOpen = LocationUtils.isOpenNow(_hours);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          final venue = VenueModel(
            id: widget.venueId,
            name: widget.title,
            lat: widget.lat,
            lng: widget.lng,
            type: widget.venueType,
            quietScore: 0,
            displayRating: widget.displayRating,
            mentionCount: 0,
            address: '',
          );
          context.push('/details/${widget.venueId}', extra: venue);
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: context.colors.shadow,
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left Icon Box
          ExcludeSemantics(
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: venueColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                venueIcon,
                color: venueColor,
                size: 28,
              ),
            ),
          ),
          const SizedBox(width: 16),

          // Main Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title and Heart
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        widget.title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: context.colors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Semantics(
                      button: true,
                      label: _isSaved ? 'Remove from saved places' : 'Save place',
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: _toggleSave,
                        child: Padding(
                          padding: const EdgeInsets.all(4.0),
                          child: Icon(
                            _isSaved ? Icons.bookmark : LucideIcons.bookmark,
                            color: _isSaved ? Colors.orange : context.colors.textTertiary,
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Stats Wrap (Busyness Level, Rating, Open Status)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    // Busyness Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: context.colors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: busynessColor.withOpacity(0.5)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: busynessColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            busynessLabel,
                            style: TextStyle(
                              color: busynessColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Rating Pill (if > 0)
                    if (widget.displayRating > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: context.colors.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.amber.withOpacity(0.5)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              widget.displayRating.toStringAsFixed(1),
                              style: TextStyle(
                                color: context.colors.textPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Open / Closed Status Pill
                    if (_isLoadingData)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.grey.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.withOpacity(0.5)),
                        ),
                        child: SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.grey),
                        ),
                      )
                    else if (isOpen != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isOpen ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isOpen ? Colors.green.withOpacity(0.5) : Colors.red.withOpacity(0.5)),
                        ),
                        child: Text(
                          isOpen ? 'Open' : 'Closed',
                          style: TextStyle(
                            color: isOpen ? Colors.green : Colors.red,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                // Stats Row 2 (Distance)
                Consumer<LocationProvider>(
                  builder: (context, locationProvider, child) {
                    String distanceText = '-- km';
                    if (locationProvider.hasLocation) {
                      final pos = locationProvider.currentPosition!;
                      distanceText = LocationUtils.formatDistance(
                        pos.latitude, pos.longitude, widget.lat, widget.lng
                      );
                    }
                    
                    return Row(
                      children: [
                        Icon(LucideIcons.map_pin, size: 14, color: context.colors.textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          distanceText,
                          style: TextStyle(fontSize: 13, color: context.colors.textSecondary),
                        ),
                      ],
                    );
                  }
                ),
              ],
            ),
          ),
        ],
      ),
    )));
  }
}
