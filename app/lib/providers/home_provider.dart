import 'package:flutter/foundation.dart' hide Category;
import 'package:shi_ju/models/category.dart';
import 'package:shi_ju/models/daily_recommend.dart';
import 'package:shi_ju/models/quote.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/category_api.dart';
import 'package:shi_ju/services/daily_recommend_api.dart';
import 'package:shi_ju/services/quote_api.dart';

class HomeProvider extends ChangeNotifier {
  late final CategoryApi _categoryApi;
  late final QuoteApi _quoteApi;
  late final DailyRecommendApi _dailyApi;

  List<Category> _categories = [];
  Quote? _dailyQuote;
  DailyRecommend? _dailyRecommend;
  Quote? _randomQuote;
  bool _isLoading = false;
  String? _error;

  HomeProvider._();

  static Future<HomeProvider> create() async {
    final instance = HomeProvider._();
    final client = await ApiClient.instance;
    instance._categoryApi = CategoryApi(client);
    instance._quoteApi = QuoteApi(client);
    instance._dailyApi = DailyRecommendApi(client);
    return instance;
  }

  List<Category> get categories => List.unmodifiable(_categories);
  Quote? get dailyQuote => _dailyQuote;
  DailyRecommend? get dailyRecommend => _dailyRecommend;
  Quote? get randomQuote => _randomQuote;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> loadAll() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await Future.wait([
        _loadCategories(),
        _loadDaily(),
        _loadRandom(),
      ]);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadCategories() async {
    try {
      final response = await _categoryApi.list();
      if (response.isSuccess) {
        _categories = response.items;
      }
    } catch (_) {}
  }

  Future<void> _loadDaily() async {
    try {
      final response = await _dailyApi.today();
      if (response.isSuccess && response.data != null) {
        _dailyRecommend = response.data;
        _dailyQuote = response.data!.quote;
      }
    } catch (_) {}
  }

  Future<void> _loadRandom() async {
    try {
      final response = await _quoteApi.random();
      if (response.isSuccess && response.data != null) {
        _randomQuote = response.data;
      }
    } catch (_) {}
  }

  Future<void> refreshRandom() async {
    try {
      final response = await _quoteApi.random();
      if (response.isSuccess && response.data != null) {
        _randomQuote = response.data;
        notifyListeners();
      }
    } catch (_) {}
  }
}
