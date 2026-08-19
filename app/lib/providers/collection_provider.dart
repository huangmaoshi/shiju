import 'package:flutter/foundation.dart';
import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/collection.dart';
import 'package:shi_ju/models/quote.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/collection_api.dart';

class CollectionProvider extends ChangeNotifier {
  late final CollectionApi _collectionApi;
  bool _initialized = false;

  List<Collection> _collections = [];
  List<Quote> _currentQuotes = [];
  Collection? _currentCollection;
  bool _isLoading = false;
  bool _hasMore = true;
  int _currentPage = 1;
  String? _currentCollectionId;
  String? _error;

  CollectionProvider._();

  static Future<CollectionProvider> create() async {
    final instance = CollectionProvider._();
    final client = await ApiClient.instance;
    instance._collectionApi = CollectionApi(client);
    instance._initialized = true;
    return instance;
  }

  List<Collection> get collections => List.unmodifiable(_collections);
  List<Quote> get currentQuotes => List.unmodifiable(_currentQuotes);
  Collection? get currentCollection => _currentCollection;
  bool get isLoading => _isLoading;
  bool get hasMore => _hasMore;
  String? get error => _error;

  Future<void> fetchCollections({bool refresh = false}) async {
    if (_isLoading) return;
    if (!refresh && _collections.isNotEmpty) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _collectionApi.list();
      if (response.isSuccess) {
        _collections = response.items;
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

  Future<Collection?> create({
    required String name,
    String? description,
    String? coverImage,
    bool isPublic = false,
  }) async {
    try {
      final response = await _collectionApi.create(
        name: name,
        description: description,
        coverImage: coverImage,
        isPublic: isPublic,
      );
      if (response.isSuccess && response.data != null) {
        _collections.insert(0, response.data!);
        notifyListeners();
        return response.data;
      }
    } catch (_) {}
    return null;
  }

  Future<bool> delete(String id) async {
    try {
      final response = await _collectionApi.delete(id);
      if (response.isSuccess) {
        _collections.removeWhere((c) => c.id == id);
        notifyListeners();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> fetchQuotes({required String collectionId}) async {
    if (_isLoading) return;
    if (collectionId == _currentCollectionId && _currentQuotes.isNotEmpty) return;

    _isLoading = true;
    _error = null;
    _currentCollectionId = collectionId;
    _currentPage = 1;
    _hasMore = true;
    _currentQuotes.clear();
    notifyListeners();

    try {
      final response = await _collectionApi.getQuotes(id: collectionId);
      if (response.isSuccess) {
        _currentQuotes = response.items;
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

  Future<void> loadMoreQuotes() async {
    if (!_hasMore || _isLoading || _currentCollectionId == null) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _collectionApi.getQuotes(
        id: _currentCollectionId!,
        page: _currentPage,
      );
      if (response.isSuccess) {
        _currentQuotes.addAll(response.items);
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

  Future<bool> collect(String quoteId) async {
    try {
      final response = await _collectionApi.collect(quoteId: quoteId);
      return response.isSuccess;
    } catch (_) {
      return false;
    }
  }

  Future<bool> uncollect(String quoteId) async {
    try {
      final response = await _collectionApi.uncollect(quoteId: quoteId);
      return response.isSuccess;
    } catch (_) {
      return false;
    }
  }
}
