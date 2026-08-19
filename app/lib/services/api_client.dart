import 'package:dio/dio.dart';
import 'package:shi_ju/config/api_config.dart';
import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/utils/constants.dart';
import 'package:shi_ju/utils/storage_util.dart';

class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;
  final StorageUtil _storage;
  bool _isRefreshing = false;
  final List<RequestOptions> _pendingRequests = [];
  final _logoutListeners = <Future<void> Function()>[];

  ApiClient._(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: const Duration(milliseconds: ApiConfig.receiveTimeout),
      sendTimeout: const Duration(milliseconds: ApiConfig.sendTimeout),
      headers: {'Content-Type': 'application/json'},
    ));
    _setupInterceptors();
  }

  static Future<ApiClient> get instance async {
    if (_instance == null) {
      final storage = await StorageUtil.instance;
      _instance = ApiClient._(storage);
    }
    return _instance!;
  }

  void _setupInterceptors() {
    _dio.interceptors.addAll([
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _storage.accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          return handler.next(response);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            if (_isRefreshing) {
              _pendingRequests.add(error.requestOptions);
              return handler.reject(error);
            }

            final refreshToken = _storage.refreshToken;
            if (refreshToken == null || refreshToken.isEmpty) {
              await _handleLogout();
              return handler.reject(error);
            }

            _isRefreshing = true;
            try {
              final result = await _doRefresh(refreshToken);
              if (result != null) {
                await _storage.saveTokens(
                  accessToken: result['accessToken'] as String,
                  refreshToken: result['refreshToken'] as String,
                );
                for (final opt in _pendingRequests) {
                  opt.headers['Authorization'] =
                      'Bearer ${result['accessToken']}';
                  try {
                    await _dio.fetch(opt);
                  } catch (_) {}
                }
                _pendingRequests.clear();
                error.requestOptions.headers['Authorization'] =
                    'Bearer ${result['accessToken']}';
                final response = await _dio.fetch(error.requestOptions);
                _isRefreshing = false;
                return handler.resolve(response);
              } else {
                await _handleLogout();
                _isRefreshing = false;
                return handler.reject(error);
              }
            } catch (_) {
              _isRefreshing = false;
              await _handleLogout();
              return handler.reject(error);
            }
          }
          return handler.next(error);
        },
      ),
      LogInterceptor(
        request: false,
        requestBody: true,
        responseBody: true,
        error: true,
      ),
    ]);
  }

  Future<Map<String, dynamic>?> _doRefresh(String refreshToken) async {
    try {
      final response = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      if (response.data is Map<String, dynamic>) {
        final json = response.data as Map<String, dynamic>;
        if (json['code'] == 0 && json['data'] != null) {
          return json['data'] as Map<String, dynamic>;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _handleLogout() async {
    await _storage.clearAuth();
    for (final listener in _logoutListeners) {
      try {
        await listener();
      } catch (_) {}
    }
  }

  void addLogoutListener(Future<void> Function() listener) {
    _logoutListeners.add(listener);
  }

  void removeLogoutListener(Future<void> Function() listener) {
    _logoutListeners.remove(listener);
  }

  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(Map<String, dynamic>)? fromData,
  }) async {
    final response = await _dio.get(path, queryParameters: queryParameters);
    return _parseResponse<T>(response.data, fromData);
  }

  Future<ApiResponse<T>> post<T>(
    String path, {
    dynamic data,
    T Function(Map<String, dynamic>)? fromData,
  }) async {
    final response = await _dio.post(path, data: data);
    return _parseResponse<T>(response.data, fromData);
  }

  Future<ApiResponse<T>> put<T>(
    String path, {
    dynamic data,
    T Function(Map<String, dynamic>)? fromData,
  }) async {
    final response = await _dio.put(path, data: data);
    return _parseResponse<T>(response.data, fromData);
  }

  Future<ApiResponse<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T Function(Map<String, dynamic>)? fromData,
  }) async {
    final response = await _dio.delete(
      path,
      data: data,
      queryParameters: queryParameters,
    );
    return _parseResponse<T>(response.data, fromData);
  }

  Future<ApiListResponse<T>> getList<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    required T Function(Map<String, dynamic>) fromItem,
  }) async {
    final response = await _dio.get(path, queryParameters: queryParameters);
    return ApiListResponse<T>.fromJson(
      response.data as Map<String, dynamic>,
      fromItem,
    );
  }

  ApiResponse<T> _parseResponse<T>(
    dynamic data,
    T Function(Map<String, dynamic>)? fromData,
  ) {
    if (data is! Map<String, dynamic>) {
      return ApiResponse<T>(code: -1, message: 'Invalid response format');
    }
    final code = data['code'] as int? ?? -1;
    final message = data['message'] as String? ?? '';
    final rawData = data['data'];

    T? parsedData;
    if (rawData != null && fromData != null && rawData is Map<String, dynamic>) {
      parsedData = fromData(rawData);
    } else if (rawData != null && fromData == null) {
      parsedData = rawData as T;
    }

    return ApiResponse<T>(
      code: code,
      message: message,
      data: parsedData,
    );
  }
}

class ApiException implements Exception {
  final int code;
  final String message;

  ApiException({required this.code, required this.message});

  factory ApiException.fromResponse(ApiResponse response) {
    return ApiException(code: response.code, message: response.message);
  }

  @override
  String toString() => 'ApiException($code): $message';
}
