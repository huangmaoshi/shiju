import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/quote.dart';
import 'package:shi_ju/services/api_client.dart';

class QuoteApi {
  final ApiClient _client;

  QuoteApi(this._client);

  Future<ApiListResponse<Quote>> list({
    int? categoryId,
    int? subCategoryId,
    String? keyword,
    int page = 1,
    int pageSize = 20,
    String sort = 'latest',
  }) async {
    return _client.getList<Quote>(
      '/quotes/',
      queryParameters: {
        if (categoryId != null) 'categoryId': categoryId,
        if (subCategoryId != null) 'subCategoryId': subCategoryId,
        if (keyword != null && keyword.isNotEmpty) 'keyword': keyword,
        'page': page,
        'pageSize': pageSize,
        'sort': sort,
      },
      fromItem: Quote.fromJson,
    );
  }

  Future<ApiResponse<Quote>> getById(String id) async {
    return _client.get<Quote>(
      '/quotes/$id',
      fromData: Quote.fromJson,
    );
  }

  Future<ApiResponse<Quote>> random({int? categoryId}) async {
    return _client.get<Quote>(
      '/quotes/random',
      queryParameters: categoryId != null ? {'categoryId': categoryId} : null,
      fromData: Quote.fromJson,
    );
  }
}
