import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/search_result.dart';
import 'package:shi_ju/services/api_client.dart';

class SearchApi {
  final ApiClient _client;

  SearchApi(this._client);

  Future<ApiResponse<SearchResult>> search({
    required String keyword,
    int page = 1,
    int pageSize = 20,
  }) async {
    return _client.get<SearchResult>(
      '/search/quotes',
      queryParameters: {
        'keyword': keyword,
        'page': page,
        'pageSize': pageSize,
      },
      fromData: SearchResult.fromJson,
    );
  }

  Future<ApiListResponse<HotKeyword>> hot() async {
    return _client.getList<HotKeyword>(
      '/search/hot',
      fromItem: HotKeyword.fromJson,
    );
  }

  Future<ApiResponse<void>> saveHistory({required String keyword}) async {
    return _client.post<void>(
      '/search/history',
      data: {'keyword': keyword},
    );
  }

  Future<ApiResponse<void>> clearHistory() async {
    return _client.delete<void>('/search/history');
  }
}
