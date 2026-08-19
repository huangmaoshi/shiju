class CustomQuote {
  final String id;
  final String userId;
  final String content;
  final String? source;
  final String? author;
  final String? note;
  final String? collectionId;
  final DateTime createdAt;
  final DateTime updatedAt;

  CustomQuote({
    required this.id,
    required this.userId,
    required this.content,
    this.source,
    this.author,
    this.note,
    this.collectionId,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory CustomQuote.fromJson(Map<String, dynamic> json) {
    return CustomQuote(
      id: json['id'] as String,
      userId: json['userId'] as String? ?? '',
      content: json['content'] as String? ?? '',
      source: json['source'] as String?,
      author: json['author'] as String?,
      note: json['note'] as String?,
      collectionId: json['collectionId'] as String?,
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
        'content': content,
        'source': source,
        'author': author,
        'note': note,
        'collectionId': collectionId,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}
