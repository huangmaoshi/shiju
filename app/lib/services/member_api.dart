import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/member.dart';
import 'package:shi_ju/services/api_client.dart';

class MemberApi {
  final ApiClient _client;

  MemberApi(this._client);

  Future<ApiResponse<MemberInfo>> info() async {
    return _client.get<MemberInfo>(
      '/member/info',
      fromData: MemberInfo.fromJson,
    );
  }

  Future<ApiListResponse<MemberPlan>> plans() async {
    return _client.getList<MemberPlan>(
      '/member/plans',
      fromItem: MemberPlan.fromJson,
    );
  }
}
