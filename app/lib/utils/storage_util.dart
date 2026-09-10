import 'package:shared_preferences/shared_preferences.dart';
import 'package:shi_ju/utils/constants.dart';

class StorageUtil {
  static StorageUtil? _instance;
  static SharedPreferences? _prefs;

  StorageUtil._();

  static Future<StorageUtil> get instance async {
    if (_instance == null) {
      _instance = StorageUtil._();
      _prefs = await SharedPreferences.getInstance();
    }
    return _instance!;
  }

  String? get accessToken => _prefs?.getString(StorageKeys.accessToken);

  String? get refreshToken => _prefs?.getString(StorageKeys.refreshToken);

  String? get userId => _prefs?.getString(StorageKeys.userId);

  String? get apiBaseUrl => _prefs?.getString(StorageKeys.apiBaseUrl);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _prefs?.setString(StorageKeys.accessToken, accessToken);
    await _prefs?.setString(StorageKeys.refreshToken, refreshToken);
  }

  Future<void> saveApiBaseUrl(String apiBaseUrl) async {
    await _prefs?.setString(StorageKeys.apiBaseUrl, apiBaseUrl);
  }

  Future<void> saveUserId(String userId) async {
    await _prefs?.setString(StorageKeys.userId, userId);
  }

  Future<void> clearAuth() async {
    await _prefs?.remove(StorageKeys.accessToken);
    await _prefs?.remove(StorageKeys.refreshToken);
    await _prefs?.remove(StorageKeys.userId);
  }

  Future<void> saveSearchHistory(List<String> keywords) async {
    await _prefs?.setStringList(StorageKeys.searchHistory, keywords);
  }

  List<String> getSearchHistory() {
    return _prefs?.getStringList(StorageKeys.searchHistory) ?? [];
  }

  Future<void> addSearchKeyword(String keyword) async {
    final history = getSearchHistory();
    history.remove(keyword);
    history.insert(0, keyword);
    if (history.length > AppConstants.maxSearchHistory) {
      history.removeRange(AppConstants.maxSearchHistory, history.length);
    }
    await saveSearchHistory(history);
  }

  Future<void> clearSearchHistory() async {
    await _prefs?.remove(StorageKeys.searchHistory);
  }

  Future<void> saveLastSyncTime(DateTime time) async {
    await _prefs?.setInt(StorageKeys.lastSyncTime, time.millisecondsSinceEpoch);
  }

  DateTime? get lastSyncTime {
    final ts = _prefs?.getInt(StorageKeys.lastSyncTime);
    return ts != null ? DateTime.fromMillisecondsSinceEpoch(ts) : null;
  }
}
