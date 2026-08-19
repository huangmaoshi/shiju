import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/daily_recommend.dart';
import 'package:shi_ju/services/api_client.dart';

class DailyRecommendApi {
  final ApiClient _client;

  DailyRecommendApi(this._client);

  Future<ApiResponse<DailyRecommend>> today() async {
    return _client.get<DailyRecommend>(
      '/daily-recommend/today',
      fromData: DailyRecommend.fromJson,
    );
  }

  Future<ApiResponse<DailyRecommend>> getByDate(String date) async {
    return _client.get<DailyRecommend>(
      '/daily-recommend/$date',
      fromData: DailyRecommend.fromJson,
    );
  }
}
