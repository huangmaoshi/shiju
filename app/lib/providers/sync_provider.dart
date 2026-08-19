import 'package:flutter/foundation.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/sync_api.dart';
import 'package:shi_ju/utils/storage_util.dart';

class SyncProvider extends ChangeNotifier {
  late final SyncApi _syncApi;
  late final StorageUtil _storage;
  bool _initialized = false;

  bool _isSyncing = false;
  String? _lastSyncMessage;

  SyncProvider._();

  static Future<SyncProvider> create() async {
    final instance = SyncProvider._();
    final client = await ApiClient.instance;
    instance._storage = await StorageUtil.instance;
    instance._syncApi = SyncApi(client);
    instance._initialized = true;
    return instance;
  }

  bool get isSyncing => _isSyncing;
  String? get lastSyncMessage => _lastSyncMessage;

  Future<bool> pull() async {
    _isSyncing = true;
    _lastSyncMessage = null;
    notifyListeners();

    try {
      final response = await _syncApi.pull(since: _storage.lastSyncTime);
      if (response.isSuccess) {
        await _storage.saveLastSyncTime(DateTime.now());
        _lastSyncMessage = '同步成功';
        _isSyncing = false;
        notifyListeners();
        return true;
      }
      _lastSyncMessage = response.message;
    } catch (e) {
      _lastSyncMessage = e.toString();
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
    return false;
  }

  Future<bool> push({required Map<String, dynamic> changes}) async {
    _isSyncing = true;
    notifyListeners();

    try {
      final response = await _syncApi.push(changes: changes);
      if (response.isSuccess) {
        _lastSyncMessage = '上传成功';
        _isSyncing = false;
        notifyListeners();
        return true;
      }
      _lastSyncMessage = response.message;
    } catch (e) {
      _lastSyncMessage = e.toString();
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
    return false;
  }
}
