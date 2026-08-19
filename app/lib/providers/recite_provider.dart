import 'package:flutter/foundation.dart';
import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/recite_plan.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/recite_api.dart';

class ReciteProvider extends ChangeNotifier {
  late final ReciteApi _reciteApi;
  bool _initialized = false;

  List<RecitePlan> _plans = [];
  List<RecitePlan> _todayPlans = [];
  ReciteStats? _stats;
  bool _isLoading = false;
  String? _error;

  ReciteProvider._();

  static Future<ReciteProvider> create() async {
    final instance = ReciteProvider._();
    final client = await ApiClient.instance;
    instance._reciteApi = ReciteApi(client);
    instance._initialized = true;
    return instance;
  }

  List<RecitePlan> get plans => List.unmodifiable(_plans);
  List<RecitePlan> get todayPlans => List.unmodifiable(_todayPlans);
  ReciteStats? get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchList({String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _reciteApi.list(status: status);
      if (response.isSuccess) {
        _plans = response.items;
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

  Future<void> fetchToday() async {
    try {
      final response = await _reciteApi.today();
      if (response.isSuccess) {
        _todayPlans = response.items;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> fetchStats() async {
    try {
      final response = await _reciteApi.stats();
      if (response.isSuccess && response.data != null) {
        _stats = response.data;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<RecitePlan?> add({required String quoteId}) async {
    try {
      final response = await _reciteApi.add(quoteId: quoteId);
      if (response.isSuccess && response.data != null) {
        _plans.insert(0, response.data!);
        notifyListeners();
        return response.data;
      }
    } catch (_) {}
    return null;
  }

  Future<RecitePlan?> review({
    required String planId,
    required String action,
  }) async {
    try {
      final response = await _reciteApi.review(planId: planId, action: action);
      if (response.isSuccess && response.data != null) {
        final index = _plans.indexWhere((p) => p.id == planId);
        if (index != -1) {
          _plans[index] = response.data!;
        }
        final todayIndex = _todayPlans.indexWhere((p) => p.id == planId);
        if (todayIndex != -1) {
          _todayPlans[todayIndex] = response.data!;
        }
        notifyListeners();
        return response.data;
      }
    } catch (_) {}
    return null;
  }
}
