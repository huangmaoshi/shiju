class ApiResponse<T> {
  final int code;
  final String message;
  final T? data;

  ApiResponse({
    required this.code,
    required this.message,
    this.data,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>)? fromData,
  ) {
    final rawData = json['data'];
    T? parsedData;
    if (rawData != null && fromData != null && rawData is Map<String, dynamic>) {
      parsedData = fromData(rawData);
    } else if (rawData != null && fromData == null) {
      parsedData = rawData as T;
    }
    return ApiResponse<T>(
      code: json['code'] as int? ?? -1,
      message: json['message'] as String? ?? '',
      data: parsedData,
    );
  }

  bool get isSuccess => code == 0;

  Map<String, dynamic> toJson() => {
        'code': code,
        'message': message,
        'data': data,
      };
}

class ApiListResponse<T> {
  final int code;
  final String message;
  final List<T> items;
  final int total;
  final int page;
  final int pageSize;

  ApiListResponse({
    required this.code,
    required this.message,
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  factory ApiListResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    final data = json['data'];
    List<T> parsedItems = [];
    int total = 0;
    int page = 1;
    int pageSize = 20;

    if (data is List) {
      parsedItems = data
          .map((e) => fromItem(e as Map<String, dynamic>))
          .toList();
      total = parsedItems.length;
    } else if (data is Map<String, dynamic>) {
      final list = data['items'] ?? data['list'] ?? [];
      if (list is List) {
        parsedItems = list
            .map((e) => fromItem(e as Map<String, dynamic>))
            .toList();
      }
      total = data['total'] as int? ?? parsedItems.length;
      page = data['page'] as int? ?? 1;
      pageSize = data['pageSize'] as int? ?? 20;
    }

    return ApiListResponse<T>(
      code: json['code'] as int? ?? -1,
      message: json['message'] as String? ?? '',
      items: parsedItems,
      total: total,
      page: page,
      pageSize: pageSize,
    );
  }

  bool get isSuccess => code == 0;
  bool get hasMore => items.length < total;
}
