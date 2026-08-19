class User {
  final String id;
  final String? openid;
  final String nickname;
  final String? avatarUrl;
  final bool isMember;
  final DateTime? memberExpireAt;
  final int quoteCount;
  final int collectionCount;
  final int reciteCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  User({
    required this.id,
    this.openid,
    required this.nickname,
    this.avatarUrl,
    this.isMember = false,
    this.memberExpireAt,
    this.quoteCount = 0,
    this.collectionCount = 0,
    this.reciteCount = 0,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      openid: json['openid'] as String?,
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      isMember: json['isMember'] as bool? ?? false,
      memberExpireAt: json['memberExpireAt'] != null
          ? DateTime.parse(json['memberExpireAt'] as String)
          : null,
      quoteCount: json['quoteCount'] as int? ?? 0,
      collectionCount: json['collectionCount'] as int? ?? 0,
      reciteCount: json['reciteCount'] as int? ?? 0,
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
        'openid': openid,
        'nickname': nickname,
        'avatarUrl': avatarUrl,
        'isMember': isMember,
        'memberExpireAt': memberExpireAt?.toIso8601String(),
        'quoteCount': quoteCount,
        'collectionCount': collectionCount,
        'reciteCount': reciteCount,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}
