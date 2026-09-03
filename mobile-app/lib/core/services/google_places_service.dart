import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class PlacePrediction {
  final String description;
  final String placeId;

  PlacePrediction({required this.description, required this.placeId});

  factory PlacePrediction.fromJson(Map<String, dynamic> json) {
    return PlacePrediction(
      description: json['description'] ?? '',
      placeId: json['place_id'] ?? '',
    );
  }
}

class PlaceDetails {
  final double lat;
  final double lng;

  PlaceDetails({required this.lat, required this.lng});

  factory PlaceDetails.fromJson(Map<String, dynamic> json) {
    final location = json['result']['geometry']['location'];
    return PlaceDetails(
      lat: location['lat'].toDouble(),
      lng: location['lng'].toDouble(),
    );
  }
}

class GooglePlacesService {
  final Dio _dio = Dio();
  final String _baseUrl = 'https://maps.googleapis.com/maps/api/place';

  String get _apiKey {
    return dotenv.env['GOOGLE_MAPS_API_KEY'] ?? '';
  }

  Future<List<PlacePrediction>> getAutocomplete(String input) async {
    if (input.isEmpty) return [];

    try {
      final response = await _dio.get(
        '$_baseUrl/autocomplete/json',
        queryParameters: {
          'input': input,
          'components': 'country:us', // Optional: restrict to US, helps with speed
          'key': _apiKey,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['status'] == 'OK') {
          final predictions = data['predictions'] as List;
          return predictions
              .map((p) => PlacePrediction.fromJson(p))
              .toList();
        } else {
          print('Google API Error: ${data['status']} - ${data['error_message']}');
        }
      }
      return [];
    } catch (e) {
      print('Error fetching Google Places Autocomplete: $e');
      return [];
    }
  }

  Future<PlaceDetails?> getPlaceDetails(String placeId) async {
    try {
      final response = await _dio.get(
        '$_baseUrl/details/json',
        queryParameters: {
          'place_id': placeId,
          'fields': 'geometry', // Only fetch geometry to save bandwidth & cost
          'key': _apiKey,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['status'] == 'OK') {
          return PlaceDetails.fromJson(data);
        }
      }
      return null;
    } catch (e) {
      print('Error fetching Google Place Details: $e');
      return null;
    }
  }
  Future<String?> getPlacePhotoReference(String placeId) async {
    try {
      final response = await _dio.get(
        '$_baseUrl/details/json',
        queryParameters: {
          'place_id': placeId,
          'fields': 'photos', // Only fetch photos to save bandwidth & cost
          'key': _apiKey,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['status'] == 'OK') {
          final result = data['result'];
          if (result != null && result['photos'] != null) {
            final photos = result['photos'] as List;
            if (photos.isNotEmpty) {
              return photos.first['photo_reference'] as String?;
            }
          }
        } else {
          print('Google API Error (Photos): ${data['status']} - ${data['error_message']}');
        }
      }
      return null;
    } catch (e) {
      print('Error fetching Google Place Photos: $e');
      return null;
    }
  }

  static final Map<String, String> _photoReferenceCache = {};

  Future<String?> getPhotoReferenceByQuery(String name, double lat, double lng, {String? venueId}) async {
    if (venueId != null && _photoReferenceCache.containsKey(venueId)) {
      return _photoReferenceCache[venueId];
    }

    try {
      final response = await _dio.get(
        '$_baseUrl/findplacefromtext/json',
        queryParameters: {
          'input': name,
          'inputtype': 'textquery',
          'locationbias': 'circle:100@$lat,$lng',
          'fields': 'photos',
          'key': _apiKey,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['status'] == 'OK') {
          final candidates = data['candidates'] as List;
          if (candidates.isNotEmpty) {
            final firstCandidate = candidates.first;
            if (firstCandidate['photos'] != null) {
              final photos = firstCandidate['photos'] as List;
              if (photos.isNotEmpty) {
                final ref = photos.first['photo_reference'] as String?;
                if (ref != null && venueId != null) {
                  _photoReferenceCache[venueId] = ref;
                }
                return ref;
              }
            }
          }
        } else {
          print('Google API Error (Find Place): ${data['status']} - ${data['error_message']}');
        }
      }
      return null;
    } catch (e) {
      print('Error fetching Google Place Photos by query: $e');
      return null;
    }
  }

  String getPhotoUrl(String photoReference, {int maxWidth = 800}) {
    return '$_baseUrl/photo?maxwidth=$maxWidth&photo_reference=$photoReference&key=$_apiKey';
  }
}
