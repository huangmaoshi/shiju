import 'package:shi_ju/models/category.dart';
import 'package:shi_ju/models/quote.dart';

class SearchResult {
  final List<Quote> quotes;
  final List<Category> categories;
  final int total;
  final String keyword;

  SearchResult({
    this.quotes = const [],
    this.categories = const [],
    this.total = 0,
    this.keyword = '',
  });

  factory SearchResult.fromJson(Map<String, dynamic> json) {
    List<Quote> quotes = [];
    List<Category> categories = [];

    final quotesData = json['quotes'] ?? json['items'] ?? [];
    if (quotesData is List) {
      quotes = quotesData
          .map((e) => Quote.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    final catData = json['categories'] ?? [];
    if (catData is List) {
      categories = catData
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    return SearchResult(
      quotes: quotes,
      categories: categories,
      total: json['total'] as int? ?? quotes.length,
      keyword: json['keyword'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'quotes': quotes.map((e) => e.toJson()).toList(),
        'categories': categories.map((e) => e.toJson()).toList(),
        'total': total,
        'keyword': keyword,
      };
}

class HotKeyword {
  final String keyword;
  final int searchCount;

  HotKeyword({
    required this.keyword,
    this.searchCount = 0,
  });

  factory HotKeyword.fromJson(Map<String, dynamic> json) {
    return HotKeyword(
      keyword: json['keyword'] as String? ?? '',
      searchCount: json['searchCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'keyword': keyword,
        'searchCount': searchCount,
      };
}
