import 'package:dio/dio.dart';
import '../../network/api_client.dart';
import '../../models/user_model.dart';

class AuthService {
  final ApiClient _apiClient = ApiClient();

  Future<String> login(String email, String password) async {
    try {
      final response = await _apiClient.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      return response.data['accessToken'];
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw Exception('Invalid email or password.');
      }
      throw Exception(e.response?.data?['message'] ?? 'Login failed. Please try again.');
    }
  }

  Future<void> register(String name, String email, String password) async {
    try {
      await _apiClient.dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
      });
      // Registration successful, requires email verification, so no token returned.
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw Exception('An account with this email already exists.');
      }
      throw Exception(e.response?.data?['message'] ?? 'Registration failed. Please try again.');
    }
  }

  Future<void> forgotPassword(String email) async {
    try {
      await _apiClient.dio.post('/auth/forgot-password', data: {
        'email': email,
      });
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to send reset link.');
    }
  }

  Future<void> resendVerification(String email) async {
    try {
      await _apiClient.dio.post('/auth/resend-verification', data: {
        'email': email,
      });
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to resend verification link.');
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/auth/logout');
    } catch (e) {
      // Ignore
    }
  }

  Future<UserModel> getMe() async {
    final response = await _apiClient.dio.get('/auth/me');
    return UserModel.fromJson(response.data);
  }
}
