import 'package:flutter/foundation.dart';
import 'package:shi_ju/models/user.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/auth_api.dart';
import 'package:shi_ju/utils/storage_util.dart';

class AuthProvider extends ChangeNotifier {
  late final StorageUtil _storage;
  late final AuthApi _authApi;
  bool _initialized = false;

  User? _user;
  bool _isLoading = false;
  String? _error;

  AuthProvider._();

  static Future<AuthProvider> create() async {
    final instance = AuthProvider._();
    instance._storage = await StorageUtil.instance;
    final client = await ApiClient.instance;
    instance._authApi = AuthApi(client);
    instance._initialized = true;
    return instance;
  }

  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _storage.accessToken != null;
  bool get initialized => _initialized;

  Future<void> wechatLogin({
    required String code,
    String? nickname,
    String? avatarUrl,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _authApi.wechatLogin(
        code: code,
        nickname: nickname,
        avatarUrl: avatarUrl,
      );
      if (response.isSuccess && response.data != null) {
        _applyLoginResponse(response.data!);
      } else {
        _error = response.message;
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> accountLogin({
    required String username,
    required String password,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _authApi.login(
        username: username,
        password: password,
      );
      if (response.isSuccess && response.data != null) {
        _applyLoginResponse(response.data!);
      } else {
        _error = response.message;
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _applyLoginResponse(Map<String, dynamic> data) async {
    final token = data['token'] as String? ?? data['accessToken'] as String?;
    if (token == null || token.isEmpty) {
      _error = '登录响应中缺少 token';
      return;
    }

    final refreshToken = data['refreshToken'] as String? ?? token;
    final userJson = data['user'] as Map<String, dynamic>?;

    await _storage.saveTokens(
      accessToken: token,
      refreshToken: refreshToken,
    );
    if (userJson != null) {
      _user = User.fromJson(userJson);
      await _storage.saveUserId(_user!.id);
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    try {
      await _authApi.logout();
    } catch (_) {}
    await _storage.clearAuth();
    _user = null;
    _isLoading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
