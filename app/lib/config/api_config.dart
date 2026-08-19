class ApiConfig {
  static const String baseUrl = 'http://localhost:3000/api/v1';
  static const int connectTimeout = 15000;
  static const int receiveTimeout = 15000;
  static const int sendTimeout = 15000;

  static const Duration tokenRefreshThreshold = Duration(seconds: 30);
}
