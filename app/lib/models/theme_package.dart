class ThemePackage {
  final String id;
  final String name;
  final String? description;
  final String? primaryColor;
  final String? secondaryColor;
  final String? accentColor;
  final bool isPremium;
  final String? coverImage;

  ThemePackage({
    required this.id,
    required this.name,
    this.description,
    this.primaryColor,
    this.secondaryColor,
    this.accentColor,
    this.isPremium = false,
    this.coverImage,
  });

  factory ThemePackage.fromJson(Map<String, dynamic> json) {
    return ThemePackage(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      primaryColor: json['primaryColor'] as String?,
      secondaryColor: json['secondaryColor'] as String?,
      accentColor: json['accentColor'] as String?,
      isPremium: json['isPremium'] as bool? ?? false,
      coverImage: json['coverImage'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'primaryColor': primaryColor,
        'secondaryColor': secondaryColor,
        'accentColor': accentColor,
        'isPremium': isPremium,
        'coverImage': coverImage,
      };
}
