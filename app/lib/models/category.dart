class Category {
  final int id;
  final String name;
  final String? icon;
  final String? description;
  final int parentId;
  final int sortOrder;
  final int quoteCount;
  final bool isActive;
  final List<Category>? children;

  Category({
    required this.id,
    required this.name,
    this.icon,
    this.description,
    this.parentId = 0,
    this.sortOrder = 0,
    this.quoteCount = 0,
    this.isActive = true,
    this.children,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    List<Category>? children;
    if (json['children'] != null) {
      children = (json['children'] as List)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return Category(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String? ?? '',
      icon: json['icon'] as String?,
      description: json['description'] as String?,
      parentId: (json['parentId'] as num?)?.toInt() ?? 0,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      quoteCount: json['quoteCount'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      children: children,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'icon': icon,
        'description': description,
        'parentId': parentId,
        'sortOrder': sortOrder,
        'quoteCount': quoteCount,
        'isActive': isActive,
        'children': children?.map((e) => e.toJson()).toList(),
      };
}
