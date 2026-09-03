import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api/auth_service.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  
  bool _isLoggedIn = false;
  UserModel? _currentUser;
  bool _isLoading = false;

  bool get isLoggedIn => _isLoggedIn;
  UserModel? get currentUser => _currentUser;
  String get userName => _currentUser?.name ?? 'Guest';
  String get userEmail => _currentUser?.email ?? '';
  bool get isLoading => _isLoading;

  AuthProvider({bool hasInitialAuth = false}) {
    _isLoggedIn = hasInitialAuth;
    checkLoginStatus();
  }

  Future<void> checkLoginStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    
    if (token != null && token.isNotEmpty) {
      try {
        _isLoading = true;
        notifyListeners();
        
        _currentUser = await _authService.getMe();
        _isLoggedIn = true;
      } catch (e) {
        // Token might be expired or invalid
        await logout();
      } finally {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final token = await _authService.login(email, password);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', token);
      
      _currentUser = await _authService.getMe();
      _isLoggedIn = true;
    } catch (e) {
      _isLoggedIn = false;
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> register(String name, String email, String password) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      await _authService.register(name, email, password);
      // Do not log in here because email verification is required.
    } catch (e) {
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> forgotPassword(String email) async {
    _isLoading = true;
    notifyListeners();
    try {
      await _authService.forgotPassword(email);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> resendVerification(String email) async {
    _isLoading = true;
    notifyListeners();
    try {
      await _authService.resendVerification(email);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _authService.logout();
    } catch (e) {
      // Ignore errors on logout, we still want to clear local state
    }
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    
    _isLoggedIn = false;
    _currentUser = null;
    notifyListeners();
  }
}
