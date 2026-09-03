class VenueModel {
  final String id;
  final String name;
  final String address;
  final double lat;
  final double lng;
  final String type;
  final int quietScore;
  final double displayRating;
  final int mentionCount;
  // Extra fields for details
  final List<Map<String, dynamic>>? representativeQuotes;
  final Map<String, dynamic>? attributeScores;
  final String? businessStatus;
  final String? hours;
  final String? crowdedness;

  VenueModel({
    required this.id,
    required this.name,
    required this.address,
    required this.lat,
    required this.lng,
    required this.type,
    required this.quietScore,
    required this.displayRating,
    required this.mentionCount,
    this.representativeQuotes,
    this.attributeScores,
    this.businessStatus,
    this.hours,
    this.crowdedness,
  });

  factory VenueModel.fromJson(Map<String, dynamic> json) {
    return VenueModel(
      id: json['id'],
      name: json['name'] ?? '',
      address: json['address'] ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
      type: json['type'] ?? '',
      quietScore: json['quietScore'] ?? 0,
      displayRating: (json['displayRating'] as num?)?.toDouble() ?? 0.0,
      mentionCount: json['mentionCount'] ?? 0,
      representativeQuotes: (json['representativeQuotes'] as List<dynamic>?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList(),
      attributeScores: json['attributeScores'] as Map<String, dynamic>?,
      businessStatus: json['businessStatus'],
      hours: json['hours'],
      crowdedness: json['crowdedness'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'lat': lat,
      'lng': lng,
      'type': type,
      'quietScore': quietScore,
      'displayRating': displayRating,
      'mentionCount': mentionCount,
      'representativeQuotes': representativeQuotes,
      'attributeScores': attributeScores,
      'businessStatus': businessStatus,
      'hours': hours,
      'crowdedness': crowdedness,
    };
  }

  OccupancyLevel get occupancyLevel {
    if (attributeScores != null && attributeScores!.containsKey('crowding')) {
      final crowding = attributeScores!['crowding'] as Map<String, dynamic>;
      final net = crowding['net'] as int? ?? 0;
      if (net > 0) return OccupancyLevel.low;
      if (net < -1) return OccupancyLevel.high;
      return OccupancyLevel.medium;
    }
    return OccupancyLevel.medium;
  }

  String get formattedHours {
    if (hours == null || hours!.isEmpty) return 'Hours not available';
    
    String formatted = hours!
        .replaceAll('Mo', 'Mon')
        .replaceAll('Tu', 'Tue')
        .replaceAll('We', 'Wed')
        .replaceAll('Th', 'Thu')
        .replaceAll('Fr', 'Fri')
        .replaceAll('Sa', 'Sat')
        .replaceAll('Su', 'Sun');
        
    return formatted
        .replaceAll('; ', '\n')
        .replaceAll(';', '\n');
  }
}

enum OccupancyLevel { low, medium, high }
