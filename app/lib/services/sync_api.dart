import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/services/api_client.dart';

class SyncApi {
  final ApiClient _client;

  SyncApi(this._client);

  Future<ApiResponse<Map<String, dynamic>>> pull({DateTime? since}) async {
    return _client.get<Map<String, dynamic>>(
      '/sync/pull',
      queryParameters: since != null
          ? {'since': since.toIso8601String()}
          : null,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> push({
    required Map<String, dynamic> changes,
  }) async {
    return _client.post<Map<String, dynamic>>(
      '/sync/push',
      data: changes,
    );
  }

  Future<ApiResponse<Map<String, dynamic>>> batch({
    required List<Map<String, dynamic>> operations,
  }) async {
    return _client.post<Map<String, dynamic>>(
      '/sync/batch',
      data: {'operations': operations},
    );
  }
}
