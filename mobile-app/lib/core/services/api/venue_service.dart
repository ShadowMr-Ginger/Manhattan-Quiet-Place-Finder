import '../../network/api_client.dart';
import '../../models/venue_model.dart';
import '../../models/quiet_profile_model.dart';

class VenueService {
  final ApiClient _apiClient = ApiClient();

  Future<List<VenueModel>> getVenues({
    String? q,
    String? type,
    int? minQuiet,
    String? bounds,
    String? sort,
    int? limit,
    int? offset,
  }) async {
    int currentOffset = offset ?? 0;
    int currentLimit = limit ?? 200;
    List<VenueModel> allVenues = [];

    while (true) {
      final Map<String, dynamic> queryParameters = {};
      if (q != null) queryParameters['q'] = q;
      if (type != null) queryParameters['type'] = type;
      if (minQuiet != null) queryParameters['minQuiet'] = minQuiet;
      if (bounds != null) queryParameters['bounds'] = bounds;
      if (sort != null) queryParameters['sort'] = sort;
      queryParameters['limit'] = currentLimit;
      queryParameters['offset'] = currentOffset;

      final response = await _apiClient.dio.get('/venues', queryParameters: queryParameters);
      final items = response.data['items'] as List<dynamic>? ?? response.data as List<dynamic>;
      
      if (items.isEmpty) break;
      
      allVenues.addAll(items.map((json) => VenueModel.fromJson(json)));
      
      // Stop paginating if we got fewer items than requested,
      // or if the caller explicitly provided a limit
      if (items.length < currentLimit || limit != null) break;
      
      currentOffset += currentLimit;
    }

    return allVenues;
  }

  Future<VenueModel> getVenueDetails(String id) async {
    final response = await _apiClient.dio.get('/venues/$id');
    return VenueModel.fromJson(response.data);
  }

  Future<QuietProfileModel> getVenueQuietProfile(String id) async {
    final response = await _apiClient.dio.get('/venues/$id/quiet-profile');
    return QuietProfileModel.fromJson(response.data);
  }
}
