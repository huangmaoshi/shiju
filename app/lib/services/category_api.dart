import 'package:shi_ju/models/api_response.dart';
import 'package:shi_ju/models/category.dart';
import 'package:shi_ju/services/api_client.dart';

class CategoryApi {
  final ApiClient _client;

  CategoryApi(this._client);

  Future<ApiListResponse<Category>> list() async {
    return _client.getList<Category>(
      '/categories/',
      fromItem: Category.fromJson,
    );
  }
}
