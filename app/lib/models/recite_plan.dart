import 'package:shi_ju/models/quote.dart';

enum ReciteStatus { pending, reviewing, mastered, skipped }

class RecitePlan {
  final String id;
  final String userId;
  final String quoteId;
  final ReciteStatus status;
  final int priority;
  final int reviewCount;
  final DateTime? nextReviewAt;
  final DateTime? lastReviewAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Quote? quote;

  RecitePlan({
    required this.id,
    required this.userId,
    required this.quoteId,
    this.status = ReciteStatus.pending,
    this.priority = 0,
    this.reviewCount = 0,
    this.nextReviewAt,
    this.lastReviewAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.quote,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory RecitePlan.fromJson(Map<String, dynamic> json) {
    return RecitePlan(
      id: json['id'] as String,
      userId: json['userId'] as String? ?? '',
      quoteId: json['quoteId'] as String? ?? '',
      status: _parseStatus(json['status'] as String?),
      priority: json['priority'] as int? ?? 0,
      reviewCount: json['reviewCount'] as int? ?? 0,
      nextReviewAt: json['nextReviewAt'] != null
          ? DateTime.parse(json['nextReviewAt'] as String)
          : null,
      lastReviewAt: json['lastReviewAt'] != null
          ? DateTime.parse(json['lastReviewAt'] as String)
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : DateTime.now(),
      quote: json['quote'] != null
          ? Quote.fromJson(json['quote'] as Map<String, dynamic>)
          : null,
    );
  }

  static ReciteStatus _parseStatus(String? status) {
    switch (status) {
      case 'reviewing':
        return ReciteStatus.reviewing;
      case 'mastered':
        return ReciteStatus.mastered;
      case 'skipped':
        return ReciteStatus.skipped;
      default:
        return ReciteStatus.pending;
    }
  }

  String get statusText {
    switch (status) {
      case ReciteStatus.pending:
        return '待背诵';
      case ReciteStatus.reviewing:
        return '复习中';
      case ReciteStatus.mastered:
        return '已掌握';
      case ReciteStatus.skipped:
        return '已跳过';
    }
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'quoteId': quoteId,
        'status': status.name,
        'priority': priority,
        'reviewCount': reviewCount,
        'nextReviewAt': nextReviewAt?.toIso8601String(),
        'lastReviewAt': lastReviewAt?.toIso8601String(),
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
      };
}

class ReciteStats {
  final int totalCount;
  final int todayCount;
  final int masteredCount;
  final int reviewingCount;
  final int streakDays;

  ReciteStats({
    this.totalCount = 0,
    this.todayCount = 0,
    this.masteredCount = 0,
    this.reviewingCount = 0,
    this.streakDays = 0,
  });

  factory ReciteStats.fromJson(Map<String, dynamic> json) {
    return ReciteStats(
      totalCount: json['totalCount'] as int? ?? 0,
      todayCount: json['todayCount'] as int? ?? 0,
      masteredCount: json['masteredCount'] as int? ?? 0,
      reviewingCount: json['reviewingCount'] as int? ?? 0,
      streakDays: json['streakDays'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'totalCount': totalCount,
        'todayCount': todayCount,
        'masteredCount': masteredCount,
        'reviewingCount': reviewingCount,
        'streakDays': streakDays,
      };
}
