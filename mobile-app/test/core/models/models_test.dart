import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/models/quiet_profile_model.dart';
import 'package:mobile_app/core/models/review_model.dart';
import 'package:mobile_app/core/models/user_model.dart';
import 'package:mobile_app/core/models/venue_model.dart';
import 'package:mobile_app/core/models/weather_model.dart';

void main() {
  group('VenueModel', () {
    test('parses API data and serializes it without losing values', () {
      final venue = VenueModel.fromJson({
        'id': 'venue-1',
        'name': 'Quiet Library',
        'address': '5th Avenue',
        'lat': 40,
        'lng': -73.5,
        'type': 'library',
        'quietScore': 91,
        'displayRating': 4,
        'mentionCount': 12,
        'representativeQuotes': [
          {'text': 'Very calm'},
        ],
        'attributeScores': {
          'crowding': {'net': 2},
        },
        'businessStatus': 'OPERATIONAL',
        'hours': 'Mo-Fr 09:00-18:00; Sa 10:00-14:00',
        'crowdedness': 'low',
      });

      expect(venue.lat, 40.0);
      expect(venue.lng, -73.5);
      expect(venue.displayRating, 4.0);
      expect(venue.occupancyLevel, OccupancyLevel.low);
      expect(venue.representativeQuotes, [
        {'text': 'Very calm'},
      ]);
      expect(venue.toJson(), containsPair('businessStatus', 'OPERATIONAL'));
      expect(venue.toJson(), containsPair('crowdedness', 'low'));
    });

    test('supplies safe defaults for missing optional API values', () {
      final venue = VenueModel.fromJson({'id': 'venue-2'});

      expect(venue.name, isEmpty);
      expect(venue.address, isEmpty);
      expect(venue.lat, 0.0);
      expect(venue.lng, 0.0);
      expect(venue.quietScore, 0);
      expect(venue.displayRating, 0.0);
      expect(venue.occupancyLevel, OccupancyLevel.medium);
      expect(venue.formattedHours, 'Hours not available');
    });

    test('maps crowding scores to occupancy levels', () {
      VenueModel venueWithNet(int net) => VenueModel.fromJson({
            'id': 'venue',
            'attributeScores': {
              'crowding': {'net': net},
            },
          });

      expect(venueWithNet(1).occupancyLevel, OccupancyLevel.low);
      expect(venueWithNet(0).occupancyLevel, OccupancyLevel.medium);
      expect(venueWithNet(-1).occupancyLevel, OccupancyLevel.medium);
      expect(venueWithNet(-2).occupancyLevel, OccupancyLevel.high);
    });

    test('formats abbreviated opening hours on separate lines', () {
      final venue = VenueModel.fromJson({
        'id': 'venue',
        'hours': 'Mo-Fr 09:00-18:00; Sa-Su 10:00-16:00',
      });

      expect(
        venue.formattedHours,
        'Mon-Fri 09:00-18:00\nSat-Sun 10:00-16:00',
      );
    });
  });

  group('ReviewModel', () {
    test('prefers a nested user name and converts numeric ids to strings', () {
      final review = ReviewModel.fromJson({
        'id': 42,
        'userId': 7,
        'rating': 5,
        'text': 'Perfect for studying',
        'user': {'name': 'Alex'},
        'userName': 'Ignored fallback',
        'createdAt': '2026-08-04T10:00:00Z',
        'venueId': 99,
        'venueName': 'Main Library',
      });

      expect(review.id, '42');
      expect(review.userId, '7');
      expect(review.userName, 'Alex');
      expect(review.venueId, '99');
      expect(review.toJson(), containsPair('venueName', 'Main Library'));
    });

    test('uses supported name fallbacks and omits absent venue fields', () {
      final named = ReviewModel.fromJson({'userName': 'Sam'});
      final authored = ReviewModel.fromJson({'author': 'Taylor'});
      final anonymous = ReviewModel.fromJson({});

      expect(named.userName, 'Sam');
      expect(authored.userName, 'Taylor');
      expect(anonymous.userName, 'Anonymous');
      expect(anonymous.rating, 0);
      expect(anonymous.toJson(), isNot(contains('venueId')));
      expect(anonymous.toJson(), isNot(contains('venueName')));
    });
  });

  test('UserModel round-trips through JSON', () {
    final user = UserModel.fromJson({
      'id': 'user-1',
      'name': 'Jordan',
      'email': 'jordan@example.com',
      'avatar': 'avatar.png',
    });

    expect(user.toJson(), {
      'id': 'user-1',
      'name': 'Jordan',
      'email': 'jordan@example.com',
      'avatar': 'avatar.png',
    });
  });

  test('WeatherModel accepts integer and decimal numeric values', () {
    final weather = WeatherModel.fromJson({
      'temp': 21,
      'feels_like': 20.5,
      'humidity': 63,
      'description': 'clear sky',
      'icon': '01d',
      'wind_speed': 3,
    });

    expect(weather.temp, 21.0);
    expect(weather.feelsLike, 20.5);
    expect(weather.humidity, 63);
    expect(weather.windSpeed, 3.0);
  });

  group('QuietProfileModel', () {
    test('parses all nested profile categories', () {
      final profile = QuietProfileModel.fromJson({
        'busyness': {
          'current_pct': 12,
          'now_label': 'server label',
          'peak_pct': 45.5,
          'peak_hour': 17,
          'today_curve': [
            {'hour': -1, 'busyness_pct': 3},
          ],
        },
        'noise': {
          'road_db': 51,
          'complaints_per_year': 4.5,
          'complaints_within_100m': 2,
        },
        'construction': {
          'effective_sites': 1.25,
          'sites_within_150m': 1,
        },
        'events': {'n_nearby': 3, 'nearest_m': 225},
        'transit': {'nearest_station_m': 180, 'n_stations_within': 2},
        'calm_bar': {
          'show': true,
          'noise': {'pos': 4, 'neu': 2, 'neg': 1, 'n': 7},
          'crowding': {'pos': 3, 'neu': 1, 'neg': 2, 'n': 6},
          'calm': {'pos': 5, 'neu': 2, 'neg': 0, 'n': 7},
        },
      });

      expect(profile.busyness?.currentPct, 12.0);
      expect(profile.busyness?.nowLabel, 'Moderate');
      expect(profile.busyness?.todayCurve.single.busynessPct, 3.0);
      expect(profile.noise?.roadDb, 51.0);
      expect(profile.construction?.effectiveSites, 1.25);
      expect(profile.events?.nearestM, 225.0);
      expect(profile.transit?.nStationsWithin, 2);
      expect(profile.calmBar?.show, isTrue);
      expect(profile.calmBar?.noise?.n, 7);
      expect(profile.calmBar?.calm?.neg, 0);
    });

    test('derives a busyness label from score thresholds', () {
      BusynessData dataFor(num score) =>
          BusynessData.fromJson({'current_pct': score});

      expect(dataFor(7.9).nowLabel, 'Not Crowded');
      expect(dataFor(8).nowLabel, 'Moderate');
      expect(dataFor(24.9).nowLabel, 'Moderate');
      expect(dataFor(25).nowLabel, 'Crowded');
    });

    test('handles an empty profile response', () {
      final profile = QuietProfileModel.fromJson({});

      expect(profile.busyness, isNull);
      expect(profile.noise, isNull);
      expect(profile.calmBar, isNull);
    });
  });
}
