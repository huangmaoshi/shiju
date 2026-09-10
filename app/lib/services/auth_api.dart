import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/services/api_client.dart';

class AuthApi {
  final ApiClient _client;

  AuthApi(this._client);

  Future<ApiResponse<Map<String, dynamic>>> wechatLogin({
    required String code,
    String? nickname,
    String? avatarUrl,
  }) async {
    return _client.post<Map<String, dynamic>>(
      '/auth/wechat-login',
      data: {
        'code': code,
        'nickname': nickname,
        'avatarUrl': avatarUrl,
      },
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> login({
    required String username,
    required String password,
  }) async {
    return _client.post<Map<String, dynamic>>(
      '/auth/login',
      data: {
        'username': username,
        'password': password,
      },
    );
  }

  Future<ApiResponse<void>> logout() async {
    return _client.post<void>('/auth/logout');
  }

  Future<ApiResponse<Map<String, dynamic>>> refresh({
    required String refreshToken,
  }) async {
    return _client.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
  }
}
