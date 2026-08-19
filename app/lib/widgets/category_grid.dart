import 'package:flutter/material.dart';
import 'package:shi_ju/models/category.dart';

class CategoryGrid extends StatelessWidget {
  final List<Category> categories;
  final int crossAxisCount;
  final Function(Category category)? onTap;

  const CategoryGrid({
    super.key,
    required this.categories,
    this.crossAxisCount = 4,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.9,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories[index];
        return InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap != null ? () => onTap!(category) : null,
          child: Container(
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _parseIcon(category.icon),
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  category.name,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (category.quoteCount > 0) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${category.quoteCount}句',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  IconData _parseIcon(String? icon) {
    if (icon == null || icon.isEmpty) return Icons.category_outlined;
    switch (icon) {
      case 'star':
        return Icons.star_outline;
      case 'book':
        return Icons.book_outlined;
      case 'school':
        return Icons.school_outlined;
      case 'favorite':
        return Icons.favorite_border;
      case 'work':
        return Icons.work_outline;
      case 'life':
        return Icons.lightbulb_outline;
      case 'nature':
        return Icons.eco_outlined;
      case 'history':
        return Icons.history_edu_outlined;
      default:
        return Icons.category_outlined;
    }
  }
}
