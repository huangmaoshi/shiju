import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/custom_quote.dart';
import 'package:shi_ju/services/api_client.dart';

class CustomQuoteApi {
  final ApiClient _client;

  CustomQuoteApi(this._client);

  Future<ApiListResponse<CustomQuote>> list({
    String? collectionId,
    int page = 1,
    int pageSize = 20,
  }) async {
    return _client.getList<CustomQuote>(
      '/custom-quotes/',
      queryParameters: {
        if (collectionId != null) 'collectionId': collectionId,
        'page': page,
        'pageSize': pageSize,
      },
      fromItem: CustomQuote.fromJson,
    );
  }

  Future<ApiResponse<CustomQuote>> create({
    required String content,
    String? source,
    String? author,
    String? note,
    String? collectionId,
  }) async {
    return _client.post<CustomQuote>(
      '/custom-quotes',
      data: {
        'content': content,
        if (source != null) 'source': source,
        if (author != null) 'author': author,
        if (note != null) 'note': note,
        if (collectionId != null) 'collectionId': collectionId,
      },
      fromData: CustomQuote.fromJson,
    );
  }

  Future<ApiResponse<void>> delete(String id) async {
    return _client.delete<void>('/custom-quotes/$id');
  }
}
