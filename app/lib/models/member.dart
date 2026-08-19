class MemberInfo {
  final String userId;
  final bool isMember;
  final DateTime? expireAt;
  final String? planType;
  final int totalDays;
  final int remainDays;
  final List<MemberPlan>? plans;

  MemberInfo({
    required this.userId,
    this.isMember = false,
    this.expireAt,
    this.planType,
    this.totalDays = 0,
    this.remainDays = 0,
    this.plans,
  });

  factory MemberInfo.fromJson(Map<String, dynamic> json) {
    List<MemberPlan>? plans;
    if (json['plans'] != null) {
      plans = (json['plans'] as List)
          .map((e) => MemberPlan.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return MemberInfo(
      userId: json['userId'] as String? ?? '',
      isMember: json['isMember'] as bool? ?? false,
      expireAt: json['expireAt'] != null
          ? DateTime.parse(json['expireAt'] as String)
          : null,
      planType: json['planType'] as String?,
      totalDays: json['totalDays'] as int? ?? 0,
      remainDays: json['remainDays'] as int? ?? 0,
      plans: plans,
    );
  }

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'isMember': isMember,
        'expireAt': expireAt?.toIso8601String(),
        'planType': planType,
        'totalDays': totalDays,
        'remainDays': remainDays,
        'plans': plans?.map((e) => e.toJson()).toList(),
      };
}

class MemberPlan {
  final String id;
  final String name;
  final String description;
  final double price;
  final int days;
  final String? icon;

  MemberPlan({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.days,
    this.icon,
  });

  factory MemberPlan.fromJson(Map<String, dynamic> json) {
    return MemberPlan(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      days: json['days'] as int? ?? 0,
      icon: json['icon'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'price': price,
        'days': days,
        'icon': icon,
      };
}
