class QuietProfileModel {
  final BusynessData? busyness;
  final NoiseData? noise;
  final ConstructionData? construction;
  final EventsData? events;
  final TransitData? transit;
  final CalmBarData? calmBar;

  QuietProfileModel({
    this.busyness,
    this.noise,
    this.construction,
    this.events,
    this.transit,
    this.calmBar,
  });

  factory QuietProfileModel.fromJson(Map<String, dynamic> json) {
    return QuietProfileModel(
      busyness: json['busyness'] != null ? BusynessData.fromJson(json['busyness']) : null,
      noise: json['noise'] != null ? NoiseData.fromJson(json['noise']) : null,
      construction: json['construction'] != null ? ConstructionData.fromJson(json['construction']) : null,
      events: json['events'] != null ? EventsData.fromJson(json['events']) : null,
      transit: json['transit'] != null ? TransitData.fromJson(json['transit']) : null,
      calmBar: json['calm_bar'] != null ? CalmBarData.fromJson(json['calm_bar']) : null,
    );
  }
}

class BusynessData {
  final double? currentPct;
  final String? nowLabel;
  final double? peakPct;
  final int? peakHour;
  final List<BusynessCurveData> todayCurve;

  BusynessData({
    this.currentPct,
    this.nowLabel,
    this.peakPct,
    this.peakHour,
    this.todayCurve = const [],
  });

  factory BusynessData.fromJson(Map<String, dynamic> json) {
    final todayCurveList = (json['today_curve'] as List<dynamic>?)
            ?.map((e) => BusynessCurveData.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    double? pct = (json['current_pct'] as num?)?.toDouble();
    try {
      final currentHour = DateTime.now().hour;
      final currentData = todayCurveList.firstWhere((e) => e.hour == currentHour);
      if (currentData.busynessPct != null) {
        pct = currentData.busynessPct;
      }
    } catch (_) {}

    String? label = json['now_label'] as String?;
    if (pct != null) {
      if (pct < 8) {
        label = 'Not Crowded';
      } else if (pct < 25) {
        label = 'Moderate';
      } else {
        label = 'Crowded';
      }
    }

    return BusynessData(
      currentPct: pct,
      nowLabel: label,
      peakPct: (json['peak_pct'] as num?)?.toDouble(),
      peakHour: json['peak_hour'] as int?,
      todayCurve: todayCurveList,
    );
  }
}

class BusynessCurveData {
  final int hour;
  final double? busynessPct;

  BusynessCurveData({required this.hour, this.busynessPct});

  factory BusynessCurveData.fromJson(Map<String, dynamic> json) {
    return BusynessCurveData(
      hour: json['hour'] as int? ?? 0,
      busynessPct: (json['busyness_pct'] as num?)?.toDouble(),
    );
  }
}

class NoiseData {
  final double? roadDb;
  final double? complaintsPerYear;
  final int? complaintsWithin100m;

  NoiseData({
    this.roadDb,
    this.complaintsPerYear,
    this.complaintsWithin100m,
  });

  factory NoiseData.fromJson(Map<String, dynamic> json) {
    return NoiseData(
      roadDb: (json['road_db'] as num?)?.toDouble(),
      complaintsPerYear: (json['complaints_per_year'] as num?)?.toDouble(),
      complaintsWithin100m: json['complaints_within_100m'] as int?,
    );
  }
}

class ConstructionData {
  final double? effectiveSites;
  final int? sitesWithin150m;

  ConstructionData({this.effectiveSites, this.sitesWithin150m});

  factory ConstructionData.fromJson(Map<String, dynamic> json) {
    return ConstructionData(
      effectiveSites: (json['effective_sites'] as num?)?.toDouble(),
      sitesWithin150m: json['sites_within_150m'] as int?,
    );
  }
}

class EventsData {
  final int? nNearby;
  final double? nearestM;

  EventsData({this.nNearby, this.nearestM});

  factory EventsData.fromJson(Map<String, dynamic> json) {
    return EventsData(
      nNearby: json['n_nearby'] as int?,
      nearestM: (json['nearest_m'] as num?)?.toDouble(),
    );
  }
}

class TransitData {
  final double? nearestStationM;
  final int? nStationsWithin;

  TransitData({this.nearestStationM, this.nStationsWithin});

  factory TransitData.fromJson(Map<String, dynamic> json) {
    return TransitData(
      nearestStationM: (json['nearest_station_m'] as num?)?.toDouble(),
      nStationsWithin: json['n_stations_within'] as int?,
    );
  }
}

class CalmBarData {
  final bool show;
  final CalmBarCategoryData? noise;
  final CalmBarCategoryData? crowding;
  final CalmBarCategoryData? calm;

  CalmBarData({
    required this.show,
    this.noise,
    this.crowding,
    this.calm,
  });

  factory CalmBarData.fromJson(Map<String, dynamic> json) {
    return CalmBarData(
      show: json['show'] as bool? ?? false,
      noise: json['noise'] != null ? CalmBarCategoryData.fromJson(json['noise']) : null,
      crowding: json['crowding'] != null ? CalmBarCategoryData.fromJson(json['crowding']) : null,
      calm: json['calm'] != null ? CalmBarCategoryData.fromJson(json['calm']) : null,
    );
  }
}

class CalmBarCategoryData {
  final int pos;
  final int neu;
  final int neg;
  final int n;

  CalmBarCategoryData({
    required this.pos,
    required this.neu,
    required this.neg,
    required this.n,
  });

  factory CalmBarCategoryData.fromJson(Map<String, dynamic> json) {
    return CalmBarCategoryData(
      pos: json['pos'] as int? ?? 0,
      neu: json['neu'] as int? ?? 0,
      neg: json['neg'] as int? ?? 0,
      n: json['n'] as int? ?? 0,
    );
  }
}
