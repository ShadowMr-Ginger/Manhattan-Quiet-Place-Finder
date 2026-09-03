import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' hide ClusterManager, Cluster;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;
import 'package:mobile_app/core/theme/app_theme_colors.dart';
import '../../../core/models/venue_model.dart';
import '../../../core/utils/marker_generator.dart';
import '../../../core/services/api/venue_service.dart';
import '../../../core/services/google_places_service.dart';
import '../../../l10n/app_localizations.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/filter_provider.dart';
import '../../../core/providers/location_provider.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:google_maps_cluster_manager_2/google_maps_cluster_manager_2.dart';
import 'dart:async';
import '../../../core/utils/auth_utils.dart';

class VenueClusterItem with ClusterItem {
  final VenueModel venue;
  VenueClusterItem(this.venue);

  @override
  LatLng get location => LatLng(venue.lat, venue.lng);
}

class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> {
  GoogleMapController? _mapController;
  late ClusterManager<VenueClusterItem> _clusterManager;
  Set<Marker> _markers = {};
  List<VenueModel> _allVenues = [];
  late FilterProvider _filterProvider;
  final TextEditingController _searchController = TextEditingController();
  
  bool _isSearching = false;
  List<VenueModel> _localSuggestions = [];
  List<PlacePrediction> _googleSuggestions = [];
  Timer? _debounce;
  final GooglePlacesService _placesService = GooglePlacesService();
  
  bool _showHeatmap = false;
  Set<Heatmap> _heatmaps = {};
  
  // Real-time busyness data
  final Map<String, double> _liveBusynessScores = {};
  final Set<String> _fetchingBusynessIds = {};
  
  static const CameraPosition _initialCameraPosition = CameraPosition(
    target: LatLng(40.7580, -73.9855),
    zoom: 15.5, // Start wide enough to see many venues, but close enough to avoid total overlap
  );

  static const String _lightMapStyleNative = '[]';
  static const String _lightMapStyleWeb = '''[{"featureType":"poi","elementType":"all","stylers":[{"visibility":"off"}]}]''';

  static const String _darkMapStyleNative = '''[{"elementType":"geometry","stylers":[{"color":"#242f3e"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#746855"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#242f3e"}]},{"featureType":"administrative.locality","elementType":"labels.text.fill","stylers":[{"color":"#d59563"}]},{"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#d59563"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#263c3f"}]},{"featureType":"poi.park","elementType":"labels.text.fill","stylers":[{"color":"#6b9a76"}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#38414e"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#212a37"}]},{"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#9ca5b3"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#746855"}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#1f2835"}]},{"featureType":"road.highway","elementType":"labels.text.fill","stylers":[{"color":"#f3d19c"}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#2f3948"}]},{"featureType":"transit.station","elementType":"labels.text.fill","stylers":[{"color":"#d59563"}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#17263c"}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#515c6d"}]},{"featureType":"water","elementType":"labels.text.stroke","stylers":[{"color":"#17263c"}]}]''';
  static const String _darkMapStyleWeb = '''[{"featureType":"poi","elementType":"all","stylers":[{"visibility":"off"}]},{"elementType":"geometry","stylers":[{"color":"#242f3e"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#746855"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#242f3e"}]},{"featureType":"administrative.locality","elementType":"labels.text.fill","stylers":[{"color":"#d59563"}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#38414e"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#212a37"}]},{"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#9ca5b3"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#746855"}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#1f2835"}]},{"featureType":"road.highway","elementType":"labels.text.fill","stylers":[{"color":"#f3d19c"}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#2f3948"}]},{"featureType":"transit.station","elementType":"labels.text.fill","stylers":[{"color":"#d59563"}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#17263c"}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#515c6d"}]},{"featureType":"water","elementType":"labels.text.stroke","stylers":[{"color":"#17263c"}]}]''';

  String _getMapStyle(bool isDark) {
    if (kIsWeb) {
      return isDark ? _darkMapStyleWeb : _lightMapStyleWeb;
    }
    return isDark ? _darkMapStyleNative : _lightMapStyleNative;
  }
  
  bool _hasCenteredOnUser = false;
  LocationProvider? _locationProvider;

  void _initClusterManager() {
    _clusterManager = ClusterManager<VenueClusterItem>(
      [],
      _updateMarkers,
      markerBuilder: _markerBuilder,
      // Stop clustering at 15.5 so the initial map view shows individual, dense markers
      // without immediately collapsing into clusters.
      stopClusteringZoom: 15.5, 
    );
  }

  void _updateMarkers(Set<Marker> markers) {
    if (mounted) {
      setState(() {
        _markers = markers;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _initClusterManager();
    _loadMockMarkers();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _filterProvider = context.read<FilterProvider>();
      _filterProvider.addListener(_onFiltersChanged);
      
      _locationProvider = context.read<LocationProvider>();
      _locationProvider!.addListener(_onLocationChanged);
      if (_locationProvider!.hasLocation) {
        _onLocationChanged();
      }
    });
  }

  void _onLocationChanged() {
    if (!mounted || _hasCenteredOnUser || _locationProvider == null) return;
    
    final pos = _locationProvider!.currentPosition;
    if (pos == null) return;
    
    // Rough bounding box for NY / Manhattan
    final isNY = pos.latitude > 40.5 && pos.latitude < 41.0 && 
                 pos.longitude > -74.3 && pos.longitude < -73.7;
                 
    if (isNY) {
      _hasCenteredOnUser = true;
      _mapController?.animateCamera(CameraUpdate.newCameraPosition(
        CameraPosition(
          target: LatLng(pos.latitude, pos.longitude),
          zoom: 14.5,
        ),
      ));
    }
  }

  void _onFiltersChanged() {
    if (mounted) {
      _generateMarkers();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _filterProvider.removeListener(_onFiltersChanged);
    _locationProvider?.removeListener(_onLocationChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _isSearching = false;
      _localSuggestions = [];
      _googleSuggestions = [];
    });
    FocusScope.of(context).unfocus();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final q = query.trim().toLowerCase();
      if (q.isEmpty) {
        setState(() {
          _localSuggestions = [];
          _googleSuggestions = [];
          _isSearching = false;
        });
        return;
      }

      setState(() {
        _isSearching = true;
        _localSuggestions = _allVenues
            .where((v) => v.name.toLowerCase().contains(q) || v.address.toLowerCase().contains(q))
            .take(3)
            .toList();
      });

      final predictions = await _placesService.getAutocomplete(query);
      if (mounted) {
        setState(() {
          _googleSuggestions = predictions;
        });
      }
    });
  }

  void _submitSearch(String query, {String? placeId}) async {
    if (_debounce?.isActive ?? false) _debounce!.cancel();

    final q = query.trim().toLowerCase();
    if (q.isEmpty) return;
    
    // Close dropdown but do NOT clear the text box!
    setState(() {
      _isSearching = false;
    });
    FocusScope.of(context).unfocus();

    // Check for exact matches
    final exactMatches = _allVenues.where((v) => v.name.toLowerCase() == q).toList();
    if (exactMatches.length == 1) {
      context.push('/details/${exactMatches.first.id}', extra: exactMatches.first);
      return;
    }

    // Auto-select the best Google Place if placeId wasn't explicitly passed (e.g., user hit Enter)
    if (placeId == null) {
      if (_googleSuggestions.isNotEmpty) {
        placeId = _googleSuggestions.first.placeId;
      } else {
        // Force fetch if user typed very fast
        final predictions = await _placesService.getAutocomplete(query);
        if (predictions.isNotEmpty) {
          placeId = predictions.first.placeId;
        }
      }
    }

    // If it's a Google Place with an ID, we fly the map there
    if (placeId != null) {
      final details = await _placesService.getPlaceDetails(placeId);
      if (details != null && _mapController != null && mounted) {
        _mapController!.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(
              target: LatLng(details.lat, details.lng),
              zoom: 15.0,
            ),
          ),
        );
      }
    }

  }

  Future<void> _loadMockMarkers() async {
    try {
      _allVenues = await VenueService().getVenues();
      _generateMarkers();
    } catch (e) {
      debugPrint('Error loading venues: $e');
    }
  }

  Future<void> _fetchBatchBusyness(List<String> venueIds) async {
    _fetchingBusynessIds.addAll(venueIds);
    // Process in chunks of 5 to prevent Connection refused from exhausting sockets
    const chunkSize = 5;
    for (var i = 0; i < venueIds.length; i += chunkSize) {
      final chunk = venueIds.skip(i).take(chunkSize).toList();
      await Future.wait(chunk.map((id) async {
        try {
          final profile = await VenueService().getVenueQuietProfile(id);
          final pct = profile.busyness?.currentPct;
          if (pct != null) {
            _liveBusynessScores[id] = pct;
          } else {
            _liveBusynessScores[id] = -1; // -1 indicates we checked but it lacks live data
          }
        } catch (e) {
          debugPrint('Failed to fetch live busyness for $id: $e');
          _liveBusynessScores[id] = -1; 
        }
      }));
    }

    if (mounted) {
      _generateMarkers(); // Re-trigger heatmap generation with live data
    }
  }

  Future<void> _generateMarkers() async {
    final List<VenueClusterItem> filteredItems = [];
    final List<WeightedLatLng> heatmapData = [];
    final List<String> toFetch = [];

    for (var venue in _allVenues) {
      final typeLower = venue.type.toLowerCase();
      final isCafe = typeLower.contains('cafe') || typeLower.contains('coffee');
      final isLibrary = typeLower.contains('library');
      final isPublic = !isCafe && !isLibrary;
      
      // Filtering logic
      final selectedTags = _filterProvider.selectedTags;
      if (selectedTags.isNotEmpty) {
        bool matches = false;
        for (final tag in selectedTags) {
          if (tag == 'Cafe' && isCafe) matches = true;
          if (tag == 'Library' && isLibrary) matches = true;
          if (tag == 'Public Study Area' && isPublic) matches = true;
        }
        if (!matches) continue;
      }

      filteredItems.add(VenueClusterItem(venue));

      // Heatmap logic
      double busyness = (100 - venue.quietScore).toDouble(); // fallback
      
      if (_liveBusynessScores.containsKey(venue.id)) {
        final liveScore = _liveBusynessScores[venue.id]!;
        if (liveScore >= 0) {
          busyness = liveScore;
        }
      } else if (!_fetchingBusynessIds.contains(venue.id)) {
        toFetch.add(venue.id);
      }

      heatmapData.add(
        WeightedLatLng(
          LatLng(venue.lat, venue.lng),
          weight: busyness / 100.0,
        ),
      );
    }

    if (toFetch.isNotEmpty) {
      _fetchBatchBusyness(toFetch); // Run in background
    }

    Set<Heatmap> heatmaps = {};
    if (heatmapData.isNotEmpty) {
      heatmaps.add(
        Heatmap(
          heatmapId: const HeatmapId('busyness_heatmap'),
          data: heatmapData,
          radius: HeatmapRadius.fromPixels(!kIsWeb && Platform.isAndroid ? 50 : 150),
          gradient: HeatmapGradient(const [
            HeatmapGradientColor(Color(0x0000FF00), 0.0), // Transparent start for smooth fade
            HeatmapGradientColor(Color(0xFF00FF00), 0.2), // Green
            HeatmapGradientColor(Color(0xFFFFFF00), 0.5), // Yellow
            HeatmapGradientColor(Color(0xFFFFA500), 0.75), // Orange
            HeatmapGradientColor(Color(0xFFFF0000), 1.0), // Red
          ]),
          opacity: 0.6,
        ),
      );
    }

    if (mounted) {
      setState(() {
        _heatmaps = heatmaps;
      });
    }

    _clusterManager.setItems(filteredItems);
    _clusterManager.updateMap();
    _updateVisibleVenues();
  }

  Future<void> _updateVisibleVenues() async {
    if (_mapController == null) return;
    try {
      final bounds = await _mapController!.getVisibleRegion();
      final visibleIds = <String>[];
      
      for (var item in _clusterManager.items) {
        final lat = item.location.latitude;
        final lng = item.location.longitude;
        if (bounds.contains(LatLng(lat, lng))) {
          visibleIds.add(item.venue.id);
        }
      }
      
      // Update FilterProvider asynchronously to prevent build-phase errors
      Future.microtask(() {
        if (mounted) {
          context.read<FilterProvider>().setVisibleVenueIds(visibleIds);
        }
      });
    } catch (e) {
      debugPrint('Error getting visible region: $e');
    }
  }

  Future<Marker> _markerBuilder(Cluster<VenueClusterItem> cluster) async {
    if (cluster.isMultiple) {
      final icon = await MarkerGenerator.createClusterMarker(cluster.count);
      return Marker(
        markerId: MarkerId(cluster.getId()),
        consumeTapEvents: true,
        position: cluster.location,
        onTap: () {
          if (_mapController == null || cluster.items.isEmpty) return;
          
          double minLat = cluster.items.first.location.latitude;
          double maxLat = cluster.items.first.location.latitude;
          double minLng = cluster.items.first.location.longitude;
          double maxLng = cluster.items.first.location.longitude;

          for (final item in cluster.items) {
            if (item.location.latitude < minLat) minLat = item.location.latitude;
            if (item.location.latitude > maxLat) maxLat = item.location.latitude;
            if (item.location.longitude < minLng) minLng = item.location.longitude;
            if (item.location.longitude > maxLng) maxLng = item.location.longitude;
          }

          // Force a minimum bounds size so it doesn't zoom in too excessively
          // 0.002 degrees is roughly ~200 meters.
          final latDiff = maxLat - minLat;
          final lngDiff = maxLng - minLng;
          
          if (latDiff < 0.002) {
            final centerLat = (maxLat + minLat) / 2;
            minLat = centerLat - 0.001;
            maxLat = centerLat + 0.001;
          }
          if (lngDiff < 0.002) {
            final centerLng = (maxLng + minLng) / 2;
            minLng = centerLng - 0.001;
            maxLng = centerLng + 0.001;
          }

          _mapController!.animateCamera(CameraUpdate.newLatLngBounds(
            LatLngBounds(
              southwest: LatLng(minLat, minLng),
              northeast: LatLng(maxLat, maxLng),
            ),
            40.0, // padding
          ));
        },
        icon: icon,
      );
    } else {
      final venue = cluster.items.first.venue;
      final typeLower = venue.type.toLowerCase();
      final isCafe = typeLower.contains('cafe') || typeLower.contains('coffee');
      final isLibrary = typeLower.contains('library');
      
      Color markerColor;
      IconData markerIcon;
      if (isCafe) {
        markerColor = Colors.orange;
        markerIcon = LucideIcons.coffee;
      } else if (isLibrary) {
        markerColor = Colors.blue;
        markerIcon = LucideIcons.book_open;
      } else {
        markerColor = context.colors.busynessLow;
        markerIcon = LucideIcons.trees;
      }

      double busynessScore = (100 - venue.quietScore).toDouble();
      if (_liveBusynessScores.containsKey(venue.id)) {
        final liveScore = _liveBusynessScores[venue.id]!;
        if (liveScore >= 0) {
          busynessScore = liveScore;
        }
      }

      final icon = await MarkerGenerator.createCustomMarker(
        score: busynessScore.round().toString(),
        backgroundColor: markerColor,
        iconData: markerIcon,
      );

      return Marker(
        markerId: MarkerId(venue.id),
        consumeTapEvents: true,
        position: LatLng(venue.lat, venue.lng),
        icon: icon,
        onTap: () {
          if (mounted) {
            context.push('/details/${venue.id}', extra: venue);
          }
        },
      );
    }
  }


  void _recenterMap() {
    final pos = context.read<LocationProvider>().currentPosition;
    if (pos != null) {
      final isNY = pos.latitude > 40.5 && pos.latitude < 41.0 && 
                   pos.longitude > -74.3 && pos.longitude < -73.7;
      if (isNY) {
        _mapController?.animateCamera(CameraUpdate.newCameraPosition(
          CameraPosition(target: LatLng(pos.latitude, pos.longitude), zoom: 14.5),
        ));
        return;
      }
    }
    
    // Fallback to default Manhattan view
    _mapController?.animateCamera(
      CameraUpdate.newCameraPosition(_initialCameraPosition),
    );
  }

  bool? _wasDarkTheme;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Only update map style if the theme actually changed to prevent flickering
    if (_wasDarkTheme != null && _wasDarkTheme != isDark) {
      _mapController?.setMapStyle(_getMapStyle(isDark));
    }
    _wasDarkTheme = isDark;

    return Scaffold(
      body: Stack(
        children: [
          // Google Map
          ExcludeSemantics(
            child: GoogleMap(
              initialCameraPosition: _initialCameraPosition,
              onMapCreated: (controller) {
                _mapController = controller;
                _clusterManager.setMapId(controller.mapId);
                controller.setMapStyle(_getMapStyle(isDark));
              },
              onCameraMove: _clusterManager.onCameraMove,
              onCameraIdle: () {
                _clusterManager.updateMap();
                _updateVisibleVenues();
              },
              markers: _markers,
              heatmaps: _showHeatmap ? _heatmaps : {},
              myLocationEnabled: true,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: false,
              mapToolbarEnabled: false,
            ),
          ),

          // Floating Top UI (Search + Chips)
          SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Unified Search Bar
                TapRegion(
                  onTapOutside: (event) {
                    setState(() {
                      _isSearching = false;
                      _localSuggestions.clear();
                      _googleSuggestions.clear();
                    });
                    FocusScope.of(context).unfocus();
                  },
                  child: Container(
                  margin: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    boxShadow: [
                      BoxShadow(
                        color: context.colors.shadow,
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                    borderRadius: BorderRadius.circular(
                      (_isSearching && (_localSuggestions.isNotEmpty || _googleSuggestions.isNotEmpty)) ? 20 : 30
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // The TextField
                      TextField(
                        controller: _searchController,
                        readOnly: false,
                        textInputAction: TextInputAction.search,
                        onChanged: _onSearchChanged,
                        onSubmitted: (val) => _submitSearch(val),
                        decoration: InputDecoration(
                          hintText: AppLocalizations.of(context)!.mapSearchHint,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          errorBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                          filled: false,
                          prefixIcon: Padding(
                            padding: const EdgeInsets.only(left: 4.0),
                            child: IconButton(
                              icon: Icon(LucideIcons.search, color: context.colors.primary),
                              onPressed: () {
                                _submitSearch(_searchController.text);
                              },
                            ),
                          ),
                          suffixIcon: ValueListenableBuilder<TextEditingValue>(
                            valueListenable: _searchController,
                            builder: (context, value, child) {
                              if (value.text.isEmpty) {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(right: 8.0),
                                child: IconButton(
                                  icon: Icon(LucideIcons.x, color: context.colors.textSecondary),
                                  onPressed: _clearSearch,
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      
                      // The Seamless Dropdown Overlay
                      if (_isSearching && (_localSuggestions.isNotEmpty || _googleSuggestions.isNotEmpty))
                        Container(
                          constraints: const BoxConstraints(maxHeight: 300),
                          child: ClipRRect(
                            borderRadius: const BorderRadius.only(
                              bottomLeft: Radius.circular(20),
                              bottomRight: Radius.circular(20),
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: ListView(
                                shrinkWrap: true,
                                padding: EdgeInsets.zero,
                                children: [
                                  const Divider(height: 1, thickness: 1),
                                  
                                  if (_localSuggestions.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                                      child: Text('Our Spaces', style: TextStyle(fontWeight: FontWeight.bold, color: context.colors.textSecondary, fontSize: 12)),
                                    ),
                                  ..._localSuggestions.map((venue) => ListTile(
                                    leading: Icon(LucideIcons.coffee, color: context.colors.primary),
                                    title: Text(venue.name, style: TextStyle(fontWeight: FontWeight.w600, color: context.colors.textPrimary)),
                                    subtitle: Text(venue.address, style: TextStyle(color: context.colors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                                    onTap: () {
                                      _searchController.text = venue.name;
                                      setState(() {
                                        _isSearching = false;
                                      });
                                      FocusScope.of(context).unfocus();
                                      context.push('/details/${venue.id}', extra: venue);
                                    },
                                  )),
                                  
                                  if (_googleSuggestions.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                                      child: Text('Locations', style: TextStyle(fontWeight: FontWeight.bold, color: context.colors.textSecondary, fontSize: 12)),
                                    ),
                                  ..._googleSuggestions.map((pred) {
                                    final parts = pred.description.split(',');
                                    final title = parts.first;
                                    final subtitle = parts.length > 1 ? parts.sublist(1).join(',').trim() : '';
                                    return ListTile(
                                      leading: Icon(LucideIcons.map_pin, color: context.colors.textSecondary),
                                      title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: context.colors.textPrimary)),
                                      subtitle: subtitle.isNotEmpty ? Text(subtitle, style: TextStyle(color: context.colors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis) : null,
                                      onTap: () {
                                        _searchController.text = pred.description;
                                        _submitSearch(pred.description, placeId: pred.placeId);
                                      },
                                    );
                                  }),
                                  const SizedBox(height: 8),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
                
                // Horizontal Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20.0),
                  child: Row(
                    children: [
                      if (context.watch<FilterProvider>().selectedTags.isNotEmpty) ...[
                        _buildClearAllChip(),
                        const SizedBox(width: 10),
                      ],
                      _buildInteractiveFilterChip('Cafe'),
                      const SizedBox(width: 10),
                      _buildInteractiveFilterChip('Library'),
                      const SizedBox(width: 10),
                      _buildInteractiveFilterChip('Public Study Area'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildMapControlButton(
                      LucideIcons.locate, 
                      AppLocalizations.of(context)!.mapRecenter, 
                      onTap: _recenterMap,
                    ),
                    if (!kIsWeb) ...[
                      const SizedBox(width: 12),
                      _buildMapControlButton(
                        _showHeatmap ? LucideIcons.map : LucideIcons.flame, 
                        _showHeatmap ? 'Map View' : 'Busyness', 
                        onTap: () {
                          setState(() {
                            _showHeatmap = !_showHeatmap;
                          });
                        },
                        isActive: _showHeatmap,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 120), // Lift above bottom nav bar
        child: FloatingActionButton(
          heroTag: 'map_chat_fab',
          onPressed: () => AuthUtils.executeWithLogin(context, 'use AI assistant', () => context.push('/chat')),
          backgroundColor: Colors.cyan,
          child: const Icon(LucideIcons.bot, color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildMapControlButton(IconData icon, String label, {VoidCallback? onTap, bool isActive = false}) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? context.colors.primary : context.colors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: context.colors.shadow,
              blurRadius: 8,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isActive ? Colors.white : context.colors.textSecondary),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isActive ? Colors.white : context.colors.textPrimary,
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  Widget _buildInteractiveFilterChip(String tag) {
    // Basic translation mapping for UI
    String uiLabel = tag;
    if (tag == 'Cafe') uiLabel = AppLocalizations.of(context)!.mapCafe;
    if (tag == 'Library') uiLabel = AppLocalizations.of(context)!.mapLibrary;
    if (tag == 'Public Study Area') uiLabel = 'Public Study Area';

    final filterProvider = context.watch<FilterProvider>();
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

  Widget _buildClearAllChip() {
    return Semantics(
      button: true,
      label: 'Clear All',
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
