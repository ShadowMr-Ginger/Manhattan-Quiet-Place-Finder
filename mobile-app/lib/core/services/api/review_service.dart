import '../../network/api_client.dart';
import '../../models/review_model.dart';
import 'user_service.dart';

class ReviewService {
  final ApiClient _apiClient = ApiClient();

  Future<List<ReviewModel>> getReviews(String venueId) async {
    final response = await _apiClient.dio.get('/venues/$venueId/reviews');
    final items = response.data['items'] as List<dynamic>? ?? response.data as List<dynamic>;
    return items.map((json) => ReviewModel.fromJson(json)).toList();
  }

  Future<void> postReview(String venueId, int rating, String text) async {
    await _apiClient.dio.post('/venues/$venueId/reviews', data: {
      'rating': rating,
      'text': text,
    });
    UserService.notifyDataChanged();
  }

  Future<void> deleteReview(String reviewId) async {
    await _apiClient.dio.delete('/reviews/$reviewId');
    UserService.notifyDataChanged();
  }

  Future<List<ReviewModel>> getMyReviews() async {
    final response = await _apiClient.dio.get('/reviews/me');
    final items = response.data['items'] as List<dynamic>? ?? response.data as List<dynamic>;
    return items.map((json) => ReviewModel.fromJson(json)).toList();
  }
}
