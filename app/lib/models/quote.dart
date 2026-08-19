class Quote {
  final String id;
  final String content;
  final String? source;
  final String? author;
  final String? translation;
  final String? annotation;
  final int categoryId;
  final int? subCategoryId;
  final String? coverImage;
  final int viewCount;
  final int collectCount;
  final int reciteCount;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? categoryName;
  final bool? isCollected;

  Quote({
    required this.id,
    required this.content,
    this.source,
    this.author,
    this.translation,
    this.annotation,
    required this.categoryId,
    this.subCategoryId,
    this.coverImage,
    this.viewCount = 0,
    this.collectCount = 0,
    this.reciteCount = 0,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.categoryName,
    this.isCollected,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory Quote.fromJson(Map<String, dynamic> json) {
    return Quote(
      id: json['id'] as String,
      content: json['content'] as String? ?? '',
      source: json['source'] as String?,
      author: json['author'] as String?,
      translation: json['translation'] as String?,
      annotation: json['annotation'] as String?,
      categoryId: (json['categoryId'] as num?)?.toInt() ?? 0,
      subCategoryId: (json['subCategoryId'] as num?)?.toInt(),
      coverImage: json['coverImage'] as String?,
      viewCount: json['viewCount'] as int? ?? 0,
      collectCount: json['collectCount'] as int? ?? 0,
      reciteCount: json['reciteCount'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
      categoryName: json['categoryName'] as String?,
      isCollected: json['isCollected'] as bool?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'content': content,
        'source': source,
        'author': author,
        'translation': translation,
        'annotation': annotation,
        'categoryId': categoryId,
        'subCategoryId': subCategoryId,
        'coverImage': coverImage,
        'viewCount': viewCount,
        'collectCount': collectCount,
        'reciteCount': reciteCount,
        'isActive': isActive,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'categoryName': categoryName,
        'isCollected': isCollected,
      };
}
