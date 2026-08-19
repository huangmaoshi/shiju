class DailyRecommend {
  final String id;
  final String date;
  final String quoteId;
  final Quote? quote;
  final String? topic;
  final String? commentary;
  final DateTime createdAt;

  DailyRecommend({
    required this.id,
    required this.date,
    required this.quoteId,
    this.quote,
    this.topic,
    this.commentary,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory DailyRecommend.fromJson(Map<String, dynamic> json) {
    return DailyRecommend(
      id: json['id'] as String,
      date: json['date'] as String? ?? '',
      quoteId: json['quoteId'] as String? ?? '',
      quote: json['quote'] != null
          ? Quote.fromJson(json['quote'] as Map<String, dynamic>)
          : null,
      topic: json['topic'] as String?,
      commentary: json['commentary'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'date': date,
        'quoteId': quoteId,
        'topic': topic,
        'commentary': commentary,
        'createdAt': createdAt.toIso8601String(),
      };
}
