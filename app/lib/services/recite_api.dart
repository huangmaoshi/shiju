import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/recite_plan.dart';
import 'package:shi_ju/services/api_client.dart';

class ReciteApi {
  final ApiClient _client;

  ReciteApi(this._client);

  Future<ApiListResponse<RecitePlan>> list({
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    return _client.getList<RecitePlan>(
      '/recite/',
      queryParameters: {
        if (status != null) 'status': status,
        'page': page,
        'pageSize': pageSize,
      },
      fromItem: RecitePlan.fromJson,
    );
  }

  Future<ApiResponse<RecitePlan>> add({required String quoteId}) async {
    return _client.post<RecitePlan>(
      '/recite/add',
      data: {'quoteId': quoteId},
      fromData: RecitePlan.fromJson,
    );
  }

  Future<ApiResponse<RecitePlan>> review({
    required String planId,
    required String action,
  }) async {
    return _client.post<RecitePlan>(
      '/recite/review',
      data: {'planId': planId, 'action': action},
      fromData: RecitePlan.fromJson,
    );
  }

  Future<ApiListResponse<RecitePlan>> today() async {
    return _client.getList<RecitePlan>(
      '/recite/today',
      fromItem: RecitePlan.fromJson,
    );
  }

  Future<ApiResponse<ReciteStats>> stats() async {
    return _client.get<ReciteStats>(
      '/recite/stats',
      fromData: ReciteStats.fromJson,
    );
  }
}
