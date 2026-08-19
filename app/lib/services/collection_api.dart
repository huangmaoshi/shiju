import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/collection.dart';
import 'package:shi_ju/models/quote.dart';
import 'package:shi_ju/services/api_client.dart';

class CollectionApi {
  final ApiClient _client;

  CollectionApi(this._client);

  Future<ApiListResponse<Collection>> list({int page = 1, int pageSize = 20}) async {
    return _client.getList<Collection>(
      '/collections/',
      queryParameters: {'page': page, 'pageSize': pageSize},
      fromItem: Collection.fromJson,
    );
  }

  Future<ApiResponse<Collection>> create({
    required String name,
    String? description,
    String? coverImage,
    bool isPublic = false,
  }) async {
    return _client.post<Collection>(
      '/collections',
      data: {
        'name': name,
        if (description != null) 'description': description,
        if (coverImage != null) 'coverImage': coverImage,
        'isPublic': isPublic,
      },
      fromData: Collection.fromJson,
    );
  }

  Future<ApiResponse<Collection>> update({
    required String id,
    String? name,
    String? description,
    String? coverImage,
    bool? isPublic,
  }) async {
    return _client.put<Collection>(
      '/collections/$id',
      data: {
        if (name != null) 'name': name,
        if (description != null) 'description': description,
        if (coverImage != null) 'coverImage': coverImage,
        if (isPublic != null) 'isPublic': isPublic,
      },
      fromData: Collection.fromJson,
    );
  }

  Future<ApiResponse<void>> delete(String id) async {
    return _client.delete<void>('/collections/$id');
  }

  Future<ApiListResponse<Quote>> getQuotes({
    required String id,
    int page = 1,
    int pageSize = 20,
  }) async {
    return _client.getList<Quote>(
      '/collections/$id/quotes',
      queryParameters: {'page': page, 'pageSize': pageSize},
      fromItem: Quote.fromJson,
    );
  }

  Future<ApiResponse<void>> addQuote({
    required String collectionId,
    required String quoteId,
  }) async {
    return _client.post<void>(
      '/collections/$collectionId/quotes',
      data: {'quoteId': quoteId},
    );
  }

  Future<ApiResponse<void>> removeQuote({
    required String collectionId,
    required String recordId,
  }) async {
    return _client.delete<void>(
      '/collections/$collectionId/quotes/$recordId',
    );
  }

  Future<ApiResponse<void>> collect({required String quoteId}) async {
    return _client.post<void>(
      '/collections/collect',
      data: {'quoteId': quoteId},
    );
  }

  Future<ApiResponse<void>> uncollect({required String quoteId}) async {
    return _client.post<void>(
      '/collections/uncollect',
      data: {'quoteId': quoteId},
    );
  }
}
