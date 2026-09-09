class ApiConfig {
  // 支持构建时注入：flutter build apk --dart-define=API_BASE_URL=https://api.example.com/api/v1
  // 未注入时使用默认服务地址
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://115.191.1.58:6010/api/v1',
  );
  static const int connectTimeout = 15000;
  static const int receiveTimeout = 15000;
  static const int sendTimeout = 15000;

  static const Duration tokenRefreshThreshold = Duration(seconds: 30);
}
