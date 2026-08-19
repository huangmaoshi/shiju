class StorageKeys {
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String userId = 'user_id';
  static const String searchHistory = 'search_history';
  static const String themeMode = 'theme_mode';
  static const String lastSyncTime = 'last_sync_time';
}

class AppConstants {
  static const int pageSize = 20;
  static const int maxSearchHistory = 50;
  static const String appName = '拾句';
}

class ApiCode {
  static const int success = 0;
  static const int unauthorized = 401;
  static const int forbidden = 403;
  static const int notFound = 404;
  static const int serverError = 500;
}
