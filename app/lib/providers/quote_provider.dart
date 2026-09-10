import 'package:flutter/foundation.dart';
import 'package:shi_ju/models/quote.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/quote_api.dart';

class QuoteProvider extends ChangeNotifier {
  late final QuoteApi _quoteApi;

  List<Quote> _quotes = [];
  Quote? _currentQuote;
  bool _isLoading = false;
  bool _hasMore = true;
  int _currentPage = 1;
  int? _currentCategoryId;
  String? _currentSort;
  String? _error;

  QuoteProvider._();

  static Future<QuoteProvider> create() async {
    final instance = QuoteProvider._();
    final client = await ApiClient.instance;
    instance._quoteApi = QuoteApi(client);
    return instance;
  }

  List<Quote> get quotes => List.unmodifiable(_quotes);
  Quote? get currentQuote => _currentQuote;
  bool get isLoading => _isLoading;
  bool get hasMore => _hasMore;
  String? get error => _error;

  Future<void> fetchList({
    int? categoryId,
    String sort = 'latest',
    bool refresh = false,
  }) async {
    if (_isLoading) return;
    if (!refresh &&
        categoryId == _currentCategoryId &&
        sort == _currentSort &&
        _quotes.isNotEmpty) {
      return;
    }

    _isLoading = true;
    _error = null;
    if (refresh || categoryId != _currentCategoryId || sort != _currentSort) {
      _currentPage = 1;
      _hasMore = true;
      _quotes.clear();
      _currentCategoryId = categoryId;
      _currentSort = sort;
    }
    notifyListeners();

    try {
      final response = await _quoteApi.list(
        categoryId: categoryId,
        page: _currentPage,
        pageSize: 20,
        sort: sort,
      );
      if (response.isSuccess) {
        _quotes.addAll(response.items);
        _hasMore = response.hasMore;
        _currentPage++;
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

  Future<void> loadMore() async {
    if (!_hasMore || _isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _quoteApi.list(
        categoryId: _currentCategoryId,
        page: _currentPage,
        pageSize: 20,
        sort: _currentSort ?? 'latest',
      );
      if (response.isSuccess) {
        _quotes.addAll(response.items);
        _hasMore = response.hasMore;
        _currentPage++;
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

  Future<Quote?> getRandom({int? categoryId}) async {
    try {
      final response = await _quoteApi.random(categoryId: categoryId);
      if (response.isSuccess) {
        _currentQuote = response.data;
        notifyListeners();
        return _currentQuote;
      }
    } catch (_) {}
    return null;
  }

  Future<Quote?> getById(String id) async {
    try {
      final response = await _quoteApi.getById(id);
      if (response.isSuccess) {
        _currentQuote = response.data;
        notifyListeners();
        return _currentQuote;
      }
    } catch (_) {}
    return null;
  }
}
