import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/services/auth_provider.dart';

import '../../../core/services/api/venue_service.dart';
import '../../../core/models/venue_model.dart';
import '../../../core/services/api/review_service.dart';
import '../../../core/models/review_model.dart';
import '../../../core/models/quiet_profile_model.dart';
import '../../../core/services/api/user_service.dart';
import '../../../l10n/app_localizations.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import '../../../core/providers/location_provider.dart';
import '../../../core/utils/location_utils.dart';
import '../../../core/utils/auth_utils.dart';
import '../../../core/services/google_places_service.dart';
class PlaceDetailsPage extends StatefulWidget {
  final String venueId;
  final VenueModel? initialVenue;

  const PlaceDetailsPage({super.key, required this.venueId, this.initialVenue});

  @override
  State<PlaceDetailsPage> createState() => _PlaceDetailsPageState();
}

class _PlaceDetailsPageState extends State<PlaceDetailsPage> {
  late Future<VenueModel> _venueFuture;
  late Future<List<ReviewModel>> _reviewsFuture;
  late Future<QuietProfileModel> _quietProfileFuture;
  late Future<String?> _photoReferenceFuture;
  bool _isSaved = false;
  bool _isLoadingSave = true;

  @override
  void initState() {
    super.initState();
    _venueFuture = VenueService().getVenueDetails(widget.venueId);
    _reviewsFuture = ReviewService().getReviews(widget.venueId);
    _quietProfileFuture = VenueService().getVenueQuietProfile(widget.venueId);
    
    if (widget.initialVenue != null) {
      _photoReferenceFuture = GooglePlacesService().getPhotoReferenceByQuery(
        widget.initialVenue!.name, 
        widget.initialVenue!.lat, 
        widget.initialVenue!.lng,
        venueId: widget.venueId,
      );
    } else {
      _photoReferenceFuture = _venueFuture.then((venue) {
        return GooglePlacesService().getPhotoReferenceByQuery(
          venue.name, venue.lat, venue.lng, venueId: widget.venueId
        );
      });
    }
    
    _checkSavedStatus();
    
    // Add to recently viewed without awaiting, only if logged in
    final isLoggedIn = context.read<AuthProvider>().isLoggedIn;
    if (isLoggedIn) {
      UserService().addRecent(widget.venueId).catchError((e) {
        debugPrint('Failed to add to recent: $e');
      });
    }
  }

  Future<void> _checkSavedStatus() async {
    final isLoggedIn = context.read<AuthProvider>().isLoggedIn;
    if (!isLoggedIn) {
      if (mounted) {
        setState(() {
          _isSaved = false;
          _isLoadingSave = false;
        });
      }
      return;
    }

    try {
      final savedVenues = await UserService().getSaved();
      if (mounted) {
        setState(() {
          _isSaved = savedVenues.any((v) => v.id == widget.venueId);
          _isLoadingSave = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingSave = false;
        });
      }
    }
  }

  Future<void> _toggleSaved() async {
    if (_isLoadingSave) return;
    
    final isLoggedIn = context.read<AuthProvider>().isLoggedIn;
    if (!isLoggedIn) {
      AuthUtils.showLoginRequiredDialog(context, 'save this place');
      return;
    }
    
    final newSavedStatus = !_isSaved;
    setState(() {
      _isSaved = newSavedStatus;
    });

    try {
      if (newSavedStatus) {
        await UserService().addSaved(widget.venueId);
      } else {
        await UserService().removeSaved(widget.venueId);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaved = !newSavedStatus;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update saved status')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        backgroundColor: context.colors.background,
        elevation: 0,
        leading: IconButton(
          icon: Icon(LucideIcons.arrow_left, color: context.colors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: Text(
          AppLocalizations.of(context)!.detailsTitle,
          style: TextStyle(
            color: context.colors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
        centerTitle: false,
        actions: [
          Semantics(
            label: _isSaved ? 'Remove from saved places' : 'Save place',
            button: true,
            child: IconButton(
              icon: _isLoadingSave
                  ? SizedBox(
                      width: 20, 
                      height: 20, 
                      child: CircularProgressIndicator(strokeWidth: 2, color: context.colors.textSecondary)
                    )
                  : Icon(
                      _isSaved ? Icons.bookmark : LucideIcons.bookmark,
                      color: _isSaved ? Colors.orange : context.colors.textSecondary,
                    ),
              onPressed: _isLoadingSave ? null : _toggleSaved,
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: FutureBuilder<VenueModel>(
        future: _venueFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }
          if (!snapshot.hasData) return const SizedBox();

          final venue = snapshot.data!;
          
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 16),
                      _buildImageCarousel(venue),
                      const SizedBox(height: 24),
                      _buildHeaderInfo(venue),
                      _buildQuotes(venue),
                      _buildScoreAndHoursRow(venue),
                      _buildForecastTimeline(),
                      _buildEditorialWriteups(venue),
                      _buildAreaSignals(),
                      _buildReviews(),
                      const SizedBox(height: 60),
                    ],
                  ),
                ),
              ),
            ],
          );
        }
      ),
    );
  }

  Widget _buildImageCarousel(VenueModel venue) {
    Color venueColor;
    IconData venueIcon;
    String venueLabel;
    final typeLower = venue.type.toLowerCase();
    
    final isCafe = typeLower.contains('cafe') || typeLower.contains('coffee');
    final isLibrary = typeLower.contains('library');

    if (isCafe) {
      venueColor = Colors.orange;
      venueIcon = LucideIcons.coffee;
      venueLabel = AppLocalizations.of(context)?.mapCafe ?? 'Cafe';
    } else if (isLibrary) {
      venueColor = Colors.blue;
      venueIcon = LucideIcons.book_open;
      venueLabel = AppLocalizations.of(context)?.mapLibrary ?? 'Library';
    } else {
      venueColor = context.colors.busynessLow;
      venueIcon = LucideIcons.trees;
      venueLabel = 'Public Study Area';
    }

    return Stack(
      children: [
        Container(
          height: 220,
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: context.colors.shadow,
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: FutureBuilder<String?>(
              future: _photoReferenceFuture,
              builder: (context, snapshot) {
                const String defaultPlaceholderUrl = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1000&auto=format&fit=crop';
                
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final photoReference = snapshot.data;
                if (photoReference != null && photoReference.isNotEmpty) {
                  final photoUrl = GooglePlacesService().getPhotoUrl(photoReference);
                  return Image.network(
                    photoUrl,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: 220,
                    errorBuilder: (context, error, stackTrace) {
                      // Fallback when API limit is exceeded or other error occurs
                      return Image.network(
                        defaultPlaceholderUrl,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: 220,
                      );
                    },
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return const Center(child: CircularProgressIndicator());
                    },
                  );
                }

                // Default placeholder if no photo reference is found
                return Image.network(
                  defaultPlaceholderUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: 220,
                );
              },
            ),
          ),
        ),
        // Cafe Tag
        Positioned(
          top: 16,
          left: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(venueIcon, color: venueColor, size: 16),
                const SizedBox(width: 6),
                Text(
                  venueLabel,
                  style: TextStyle(
                    color: venueColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeaderInfo(VenueModel venue) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        MergeSemantics(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  venue.name,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: context.colors.textPrimary,
                  ),
                ),
              ),
              _buildQuietInsideIcon(context, venue),
              if (venue.displayRating > 0)
                Container(
                  height: 28,
                  margin: const EdgeInsets.only(left: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber.withOpacity(0.5)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Semantics(
                        label: 'Rating',
                        child: const Icon(Icons.star, color: Colors.amber, size: 16),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        venue.displayRating.toStringAsFixed(1),
                        style: TextStyle(
                          color: context.colors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Consumer<LocationProvider>(
          builder: (context, locationProvider, child) {
            String distanceText = '-- km';
            if (locationProvider.hasLocation) {
              final pos = locationProvider.currentPosition!;
              distanceText = LocationUtils.formatDistance(
                pos.latitude, pos.longitude, venue.lat, venue.lng
              );
            }
            return Semantics(
              button: true,
              hint: 'Double tap to open in Google Maps',
              child: InkWell(
                onTap: () async {
                  final encodedName = Uri.encodeComponent(venue.name);
                  final url = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encodedName');
                  if (await canLaunchUrl(url)) {
                    await launchUrl(url, mode: LaunchMode.externalApplication);
                  }
                },
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4.0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      ExcludeSemantics(child: Icon(LucideIcons.map_pin, size: 16, color: context.colors.textSecondary)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          '$distanceText • ${venue.address}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            color: context.colors.textSecondary.withOpacity(0.8),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      ExcludeSemantics(child: Icon(LucideIcons.chevron_right, size: 16, color: context.colors.textSecondary)),
                    ],
                  ),
                ),
              ),
            );
          }
        ),
      ],
    );
  }

  Widget _buildQuietInsideIcon(BuildContext context, VenueModel venue) {
    Color iconColor = Colors.grey; // no data
    
    if (venue.attributeScores != null) {
      final quietKeys = ['quiet', 'calm', 'noise'];
      Map<String, dynamic>? targetData;
      
      for (final key in quietKeys) {
        if (venue.attributeScores!.containsKey(key)) {
          final val = venue.attributeScores![key];
          if (val is Map<String, dynamic>) {
            targetData = val;
            break;
          }
        }
      }
      
      if (targetData != null) {
        final pos = (targetData['positive'] as num?)?.toInt() ?? 0;
        final neg = (targetData['negative'] as num?)?.toInt() ?? 0;
        final neutral = (targetData['neutral'] as num?)?.toInt() ?? 0;
        final n = pos + neg + neutral;
        
        if (n > 0) {
          if (pos > neg) {
            iconColor = Colors.green; // quiet
          } else {
            iconColor = context.colors.busynessMedium; // not quiet (moderate busy yellow)
          }
        }
      }
    }

    return Semantics(
      label: 'Quiet Inside',
      child: Container(
        height: 28,
        margin: const EdgeInsets.only(left: 12),
        padding: const EdgeInsets.symmetric(horizontal: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: iconColor.withOpacity(0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(LucideIcons.volume_2, color: iconColor, size: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildTags(VenueModel venue) {
    if (venue.attributeScores == null || venue.attributeScores!.isEmpty) {
      return const SizedBox();
    }

    final List<MapEntry<String, dynamic>> positiveAttributes = venue.attributeScores!.entries.where((entry) {
      if (entry.value is! Map<String, dynamic>) return false;
      final data = entry.value as Map<String, dynamic>;
      final int pos = (data['positive'] as num?)?.toInt() ?? 0;
      final int neg = (data['negative'] as num?)?.toInt() ?? 0;
      return pos > neg && pos > 0;
    }).toList();

    positiveAttributes.sort((a, b) {
      final posA = ((a.value as Map<String, dynamic>)['positive'] as num?)?.toInt() ?? 0;
      final posB = ((b.value as Map<String, dynamic>)['positive'] as num?)?.toInt() ?? 0;
      return posB.compareTo(posA);
    });

    if (positiveAttributes.isEmpty) {
      return const SizedBox();
    }

    final topAttributes = positiveAttributes.take(5).toList();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: topAttributes.map((entry) {
        return _buildDynamicTag(entry.key);
      }).toList(),
    );
  }

  Widget _buildDynamicTag(String key) {
    String text = _capitalize(key);
    MaterialColor color = Colors.blue;
    
    final lowerKey = key.toLowerCase();
    if (lowerKey.contains('outlet') || lowerKey.contains('power')) {
      text = AppLocalizations.of(context)?.detailsPowerOutlets ?? 'Power Outlets';
      color = Colors.cyan;
    } else if (lowerKey.contains('coffee') || lowerKey.contains('drink')) {
      text = AppLocalizations.of(context)?.detailsGoodCoffee ?? 'Good Coffee';
      color = Colors.purple;
    } else if (lowerKey.contains('light')) {
      text = AppLocalizations.of(context)?.detailsNaturalLight ?? 'Natural Light';
      color = Colors.orange;
    } else if (lowerKey.contains('vibe') || lowerKey.contains('cozy') || lowerKey.contains('atmosphere')) {
      text = AppLocalizations.of(context)?.detailsCozyVibe ?? 'Cozy Vibe';
      color = Colors.pink;
    } else if (lowerKey.contains('study') || lowerKey.contains('laptop') || lowerKey.contains('work')) {
      text = AppLocalizations.of(context)?.detailsStudyFriendly ?? 'Study Friendly';
      color = Colors.teal;
    } else if (lowerKey.contains('quiet') || lowerKey.contains('noise')) {
      color = Colors.indigo;
    } else if (lowerKey.contains('wi-fi') || lowerKey.contains('wifi') || lowerKey.contains('internet')) {
      text = 'Fast Wi-Fi';
      color = Colors.green;
    } else if (lowerKey.contains('seat') || lowerKey.contains('space')) {
      text = 'Ample Seating';
      color = Colors.blueGrey;
    }
    
    return _buildTag(text, color);
  }



  Widget _buildQuotes(VenueModel venue) {
    if (venue.representativeQuotes == null || venue.representativeQuotes!.isEmpty) {
      return const SizedBox();
    }
    
    final Map<String, dynamic> quoteData = venue.representativeQuotes!.first;
    
    String quoteText = quoteData['quote']?.toString() ?? '';
    String author = quoteData['publication']?.toString() ?? 'Sentimentality';
    
    if (quoteText.isEmpty) {
      return const SizedBox();
    }
    
    if (!quoteText.startsWith('"') && !quoteText.startsWith('“')) {
       quoteText = '"$quoteText"';
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 24),
        Divider(color: context.colors.divider, height: 1),
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: context.colors.surface, // light background similar to image
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                quoteText,
                style: TextStyle(
                  fontSize: 16,
                  fontStyle: FontStyle.italic,
                  color: context.colors.textPrimary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                '— $author',
                style: TextStyle(
                  fontSize: 14,
                  color: context.colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEditorialWriteups(VenueModel venue) {
    if (venue.attributeScores == null || venue.attributeScores!.isEmpty) {
      return const SizedBox();
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Divider(color: context.colors.divider, height: 1),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'From editorial write-ups',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: context.colors.textSecondary,
              ),
            ),
            TextButton(
              onPressed: () => _showDetailedScoresBottomSheet(context, venue),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                'View details >',
                style: TextStyle(
                  color: context.colors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _buildTags(venue),
      ],
    );
  }

  Widget _buildAreaSignals() {
    return FutureBuilder<QuietProfileModel>(
      future: _quietProfileFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox();
        final profile = snapshot.data!;
        
        final noise = profile.noise;
        final construction = profile.construction;
        final events = profile.events;
        
        if (noise == null && construction == null && events == null) return const SizedBox();

        List<Widget> rows = [];
        
        // Noise Row
        if (noise != null) {
          List<String> parts = [];
          if (noise.roadDb != null) {
            parts.add('Traffic ≈ ${noise.roadDb!.toStringAsFixed(0)} dB');
          }
          if (noise.complaintsPerYear != null || noise.complaintsWithin100m != null) {
            final count = (noise.complaintsPerYear ?? noise.complaintsWithin100m!).toStringAsFixed(0);
            parts.add('≈ $count complaints/yr within 100 m');
          }
          if (parts.isNotEmpty) {
            rows.add(_buildSignalRow(
              icon: Icons.directions_car,
              color: Colors.orange,
              title: 'Area noise',
              subtitle: parts.join(' • '),
            ));
          }
        }
        
        // Happening Nearby Row
        if (construction != null || events != null) {
          List<String> parts = [];
          final sites = construction?.sitesWithin150m;
          if (sites != null && sites > 0) {
            parts.add('$sites construction sites within 150 m');
          }
          
          final nEvents = events?.nNearby ?? 0;
          if (nEvents > 0) {
            parts.add('$nEvents events nearby');
          } else {
            parts.add('no events this week');
          }
          
          if (rows.isNotEmpty) {
            rows.add(const SizedBox(height: 16));
          }
          
          rows.add(_buildSignalRow(
            icon: Icons.construction,
            color: Colors.amber,
            title: 'Happening nearby',
            subtitle: parts.join(' • '),
          ));
        }

        if (rows.isEmpty) return const SizedBox();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            Divider(color: context.colors.divider, height: 1),
            const SizedBox(height: 24),
            ...rows,
          ],
        );
      },
    );
  }

  Widget _buildSignalRow({required IconData icon, required Color color, required String title, required String subtitle}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: context.colors.textPrimary)),
              const SizedBox(height: 4),
              Text(subtitle, style: TextStyle(fontSize: 14, color: context.colors.textSecondary, height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }

  void _showDetailedScoresBottomSheet(BuildContext context, VenueModel venue) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: BoxDecoration(
            color: context.colors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(context).padding.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Editorial Breakdown',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: context.colors.textPrimary,
                    ),
                  ),
                  IconButton(
                    icon: Icon(LucideIcons.x, color: context.colors.textSecondary),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _buildLegendBox(Colors.blue, 'Positive'),
                  const SizedBox(width: 8),
                  _buildLegendBox(Colors.grey[300]!, 'Neutral'),
                  const SizedBox(width: 8),
                  _buildLegendBox(Colors.red[400]!, 'Negative'),
                  const Spacer(),
                  Text('· Mentions', style: TextStyle(fontSize: 12, color: context.colors.textSecondary)),
                ],
              ),
              const SizedBox(height: 24),
              ...venue.attributeScores!.entries.map((entry) {
                final attributeName = entry.key;
                
                if (entry.value is! Map<String, dynamic>) return const SizedBox();
                final data = entry.value as Map<String, dynamic>;
                
                final int pos = (data['positive'] as num?)?.toInt() ?? 0;
                final int neu = (data['neutral'] as num?)?.toInt() ?? 0;
                final int neg = (data['negative'] as num?)?.toInt() ?? 0;
                final int total = pos + neu + neg;
                
                if (total == 0) return const SizedBox();
                
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 120,
                        child: Text(
                          _capitalize(attributeName),
                          style: TextStyle(fontSize: 14, color: context.colors.textSecondary),
                        ),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: SizedBox(
                            height: 10,
                            child: Row(
                              children: [
                                if (pos > 0) Expanded(flex: pos, child: Container(color: Colors.blue)),
                                if (neu > 0) Expanded(flex: neu, child: Container(color: Colors.grey[300])),
                                if (neg > 0) Expanded(flex: neg, child: Container(color: Colors.red[400])),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      SizedBox(
                        width: 24,
                        child: Text(
                          total.toString(),
                          textAlign: TextAlign.right,
                          style: TextStyle(fontSize: 14, color: context.colors.textSecondary),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLegendBox(Color color, String label) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: context.colors.textSecondary),
        ),
      ],
    );
  }

  String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1).toLowerCase();
  }

  Widget _buildTag(String text, MaterialColor color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color.shade700,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }





  Widget _buildScoreAndHoursRow(VenueModel venue) {
    return Column(
      children: [
        const SizedBox(height: 24),
        Divider(color: context.colors.divider, height: 1),
        const SizedBox(height: 24),
        IntrinsicHeight(
          child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
        // Busyness Score
        Expanded(
          child: FutureBuilder<QuietProfileModel>(
            future: _quietProfileFuture,
            builder: (context, snapshot) {
              final pct = snapshot.data?.busyness?.currentPct;
              
              Color busynessColor = context.colors.textTertiary;
              String busynessText = '--';
              String scoreDisplay = '--';

              if (pct != null) {
                scoreDisplay = pct.toStringAsFixed(0);
                if (pct < 8) {
                  busynessColor = context.colors.busynessLow;
                  busynessText = AppLocalizations.of(context)!.mapNotCrowded;
                } else if (pct < 25) {
                  busynessColor = context.colors.busynessMedium;
                  busynessText = AppLocalizations.of(context)!.mapModerate;
                } else {
                  busynessColor = context.colors.busynessHigh;
                  busynessText = AppLocalizations.of(context)!.mapCrowded;
                }
              }

              return Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: busynessColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: busynessColor.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  AppLocalizations.of(context)!.detailsCurrentQuietScore,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                    color: busynessColor.withOpacity(0.8),
                  ),
                ),
                const SizedBox(height: 8),
                RichText(
                  text: TextSpan(
                    text: scoreDisplay,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: busynessColor,
                      height: 1.0,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  busynessText,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: busynessColor,
                  ),
                ),
              ],
            ),
              );
            },
          ),
        ),
        const SizedBox(width: 16),
        // Hours
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: context.colors.shadow, blurRadius: 10, offset: Offset(0, 4))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(LucideIcons.clock, size: 14, color: context.colors.textTertiary),
                    const SizedBox(width: 6),
                    Text(AppLocalizations.of(context)!.detailsHours, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: context.colors.textTertiary, letterSpacing: 1.0)),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: SingleChildScrollView(
                    child: Text(
                      venue.formattedHours,
                      style: TextStyle(
                        fontSize: 13, 
                        fontWeight: FontWeight.bold, 
                        color: context.colors.textPrimary, 
                        height: 1.4
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Builder(
                  builder: (context) {
                    final isOpen = LocationUtils.isOpenNow(venue.hours);
                    String text = '';
                    Color color = context.colors.textSecondary.withOpacity(0.8);
                    if (isOpen == true) {
                      text = AppLocalizations.of(context)!.detailsOpenNow;
                      color = Colors.green;
                    } else if (isOpen == false) {
                      text = 'Closed';
                      color = Colors.red;
                    }
                    return Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color));
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    ),
    ),
      ],
    );
  }

  Widget _buildForecastTimeline() {
    return FutureBuilder<QuietProfileModel>(
      future: _quietProfileFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data?.busyness == null || snapshot.data!.busyness!.todayCurve.isEmpty) {
          return const SizedBox();
        }

        final profile = snapshot.data!;
        final busyness = profile.busyness!;
        final curve = busyness.todayCurve;
        
        final now = DateTime.now();
        final currentHour = now.hour;
        
        List<Widget> timelineItems = [];
        BusynessCurveData? currentCurveData;
        int currentScore = 0;
        String currentTimeStr = "";
        
        for (int i = 1; i <= 5; i++) {
          int h = (currentHour + i) % 24;
          final data = curve.firstWhere((e) => e.hour == h, orElse: () => BusynessCurveData(hour: h, busynessPct: null));
          
          if (data.busynessPct != null) {
            double rawScore = data.busynessPct!;
            int displayScore = rawScore.round();
            
            Color color;
            if (rawScore < 8) {
              color = context.colors.busynessLow;
            } else if (rawScore < 25) {
              color = context.colors.busynessMedium;
            } else {
              color = context.colors.busynessHigh;
            }
            
            String timeStr = "";
            if (h == 0) timeStr = "12 AM";
            else if (h == 12) timeStr = "12 PM";
            else if (h > 12) timeStr = "${h - 12} PM";
            else timeStr = "$h AM";

            if (currentCurveData == null) {
              currentCurveData = data;
              currentScore = displayScore;
              currentTimeStr = timeStr;
            }
            
            timelineItems.add(Expanded(child: _buildTimelineItem('$displayScore', timeStr, color)));
          }
        }
        
        if (timelineItems.isEmpty) return const SizedBox();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            Divider(color: context.colors.divider, height: 1),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  AppLocalizations.of(context)!.detailsForecastTitle,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: context.colors.textSecondary,
                  ),
                ),

              ],
            ),
            const SizedBox(height: 16),
            if (currentCurveData != null)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.cyan.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.cyan.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.sparkles, color: Colors.cyan, size: 28),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(AppLocalizations.of(context)!.detailsIfArriveAt(currentTimeStr), style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: context.colors.textTertiary, letterSpacing: 1.2)),
                        const SizedBox(height: 4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text('$currentScore', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.cyan)),
                            const SizedBox(width: 4),
                            Text(' ${AppLocalizations.of(context)!.detailsExpected}', style: TextStyle(fontSize: 14, color: context.colors.textSecondary.withOpacity(0.8))),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: context.colors.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: context.colors.shadow, blurRadius: 10, offset: Offset(0, 4))],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: timelineItems,
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTimelineItem(String score, String time, Color color) {
    return Column(
      children: [
        Text(score, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 16)),
        const SizedBox(height: 16),
        Text(time, style: TextStyle(fontSize: 12, color: context.colors.textTertiary, fontWeight: FontWeight.normal)),
      ],
    );
  }

  Widget _buildReviews() {
    return FutureBuilder<List<ReviewModel>>(
      future: _reviewsFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox();
        final reviews = snapshot.data!;
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 32),
            Divider(color: context.colors.divider, height: 1),
            const SizedBox(height: 24),
            Row(
              children: [
                Icon(LucideIcons.message_square, size: 20, color: context.colors.textSecondary),
                const SizedBox(width: 8),
                Text('${AppLocalizations.of(context)!.detailsReviews} (${reviews.length})', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: context.colors.textSecondary)),
                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    final isLoggedIn = context.read<AuthProvider>().isLoggedIn;
                    if (!isLoggedIn) {
                      AuthUtils.showLoginRequiredDialog(context, 'write a review');
                      return;
                    }
                    _showWriteReviewBottomSheet(context);
                  },
                  icon: const Icon(LucideIcons.pen_line, size: 16),
                  label: const Text('Write'),
                  style: TextButton.styleFrom(
                    foregroundColor: context.colors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...reviews.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: _buildReviewItem(r),
            )).toList(),
          ],
        );
      },
    );
  }

  void _showWriteReviewBottomSheet(BuildContext context) {
    int selectedRating = 5;
    final TextEditingController reviewController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bottomSheetContext) {
        return StatefulBuilder(
          builder: (context, setBottomSheetState) {
            return Container(
              decoration: BoxDecoration(
                color: context.colors.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                top: 24,
                left: 24,
                right: 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Write a Review', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: context.colors.textPrimary)),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      return IconButton(
                        icon: Icon(
                          index < selectedRating ? Icons.star : Icons.star_border,
                          color: context.colors.primary,
                          size: 32,
                        ),
                        onPressed: () {
                          setBottomSheetState(() {
                            selectedRating = index + 1;
                          });
                        },
                      );
                    }),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: reviewController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Is it quiet here? Share your experience...',
                      filled: true,
                      fillColor: context.colors.background,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.all(16),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final text = reviewController.text.trim();
                        if (text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please write a review.')));
                          return;
                        }
                        
                        try {
                          await ReviewService().postReview(widget.venueId, selectedRating, text);
                          if (context.mounted) {
                            Navigator.pop(context);
                            // Refresh reviews
                            setState(() {
                              _reviewsFuture = ReviewService().getReviews(widget.venueId);
                            });
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Review submitted!')));
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to submit review: $e')));
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: context.colors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Submit Review', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildReviewItem(ReviewModel review) {
    final currentUserId = context.read<AuthProvider>().currentUser?.id;
    final isOwn = currentUserId != null && currentUserId == review.userId;
    
    return Container(
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
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.cyan.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    review.userName.isNotEmpty ? review.userName[0] : '?',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.cyan),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(review.userName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    Row(
                      children: List.generate(5, (index) => Icon(
                        index < review.rating ? Icons.star : Icons.star_border,
                        color: Colors.amber, 
                        size: 14,
                      )),
                    ),
                  ],
                ),
              ),
              Text(AppLocalizations.of(context)!.detailsRecently, style: TextStyle(fontSize: 12, color: context.colors.textTertiary)),
              if (isOwn) ...[
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(LucideIcons.trash_2, color: Colors.red, size: 20),
                  onPressed: () async {
                    try {
                      await ReviewService().deleteReview(review.id);
                      if (mounted) {
                        setState(() {
                          _reviewsFuture = ReviewService().getReviews(widget.venueId);
                        });
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Review deleted')));
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to delete review: $e')));
                      }
                    }
                  },
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),
          Text(review.text, style: TextStyle(fontSize: 14, color: context.colors.textPrimary)),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(LucideIcons.thumbs_up, size: 14, color: context.colors.textTertiary),
              const SizedBox(width: 4),
              Text('Helpful', style: TextStyle(fontSize: 12, color: context.colors.textTertiary)),
            ],
          ),
        ],
      ),
    );
  }
}
