import 'package:flutter/foundation.dart';
import '../../network/api_client.dart';
import '../../models/venue_model.dart';

class UserService {
  static final ValueNotifier<int> dataVersion = ValueNotifier(0);

  static void notifyDataChanged() {
    dataVersion.value++;
  }

  final ApiClient _apiClient = ApiClient();

  Future<List<VenueModel>> getSaved() async {
    final response = await _apiClient.dio.get('/users/me/saved');
    final items = response.data['items'] as List<dynamic>? ?? response.data as List<dynamic>;
    return items.map((json) => VenueModel.fromJson(json)).toList();
  }

  Future<void> addSaved(String venueId) async {
    await _apiClient.dio.post('/users/me/saved/$venueId');
    notifyDataChanged();
  }

  Future<void> removeSaved(String venueId) async {
    await _apiClient.dio.delete('/users/me/saved/$venueId');
    notifyDataChanged();
  }

  Future<List<VenueModel>> getRecent() async {
    final response = await _apiClient.dio.get('/users/me/recent');
    final items = response.data['items'] as List<dynamic>? ?? response.data as List<dynamic>;
    return items.map((json) => VenueModel.fromJson(json)).toList();
  }

  Future<void> addRecent(String venueId) async {
    await _apiClient.dio.post('/users/me/recent/$venueId');
    notifyDataChanged();
  }

  Future<Map<String, dynamic>> getProfile() async {
    final response = await _apiClient.dio.get('/users/me/profile');
    return response.data;
  }
}
