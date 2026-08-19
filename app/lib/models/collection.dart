class Collection {
  final String id;
  final String userId;
  final String name;
  final String? description;
  final String? coverImage;
  final bool isPublic;
  final int quoteCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  Collection({
    required this.id,
    required this.userId,
    required this.name,
    this.description,
    this.coverImage,
    this.isPublic = false,
    this.quoteCount = 0,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory Collection.fromJson(Map<String, dynamic> json) {
    return Collection(
      id: json['id'] as String,
      userId: json['userId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      coverImage: json['coverImage'] as String?,
      isPublic: json['isPublic'] as bool? ?? false,
      quoteCount: json['quoteCount'] as int? ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'name': name,
        'description': description,
        'coverImage': coverImage,
        'isPublic': isPublic,
        'quoteCount': quoteCount,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}
