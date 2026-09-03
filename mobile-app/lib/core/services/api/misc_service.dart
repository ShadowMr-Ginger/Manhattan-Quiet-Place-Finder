import '../../network/api_client.dart';

class MiscService {
  final ApiClient _apiClient = ApiClient();

  Future<Map<String, dynamic>> getWeather() async {
    final response = await _apiClient.dio.get('/weather');
    return response.data;
  }

  Future<Map<String, dynamic>> getPrediction(String venueId) async {
    final response = await _apiClient.dio.get('/venues/$venueId/prediction');
    return response.data;
  }

  Future<Map<String, dynamic>> getLive(String venueId) async {
    final response = await _apiClient.dio.get('/venues/$venueId/live');
    return response.data;
  }

  Future<Map<String, dynamic>> chat(String message, {String language = 'en', List<Map<String, dynamic>> history = const []}) async {
    try {
      print('Sending chat request to: ${_apiClient.dio.options.baseUrl}/chat');
      final response = await _apiClient.dio.post('/chat', data: {
        'message': message,
        'language': language,
        'history': history,
      });
      return {
        'reply': response.data['reply'] ?? '',
        'venues': response.data['venues'] as List<dynamic>? ?? [],
      };
    } catch (e) {
      print('MiscService chat error: $e');
      rethrow;
    }
  }
}
