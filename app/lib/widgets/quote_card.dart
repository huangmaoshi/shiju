import 'package:flutter/material.dart';
import 'package:shi_ju/models/quote.dart';

class QuoteCard extends StatelessWidget {
  final Quote quote;
  final VoidCallback? onTap;
  final bool showAuthor;
  final bool showSource;

  const QuoteCard({
    super.key,
    required this.quote,
    this.onTap,
    this.showAuthor = true,
    this.showSource = true,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                quote.content,
                style: theme.textTheme.bodyLarge?.copyWith(
                  height: 1.8,
                  fontSize: 16,
                ),
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  if (showAuthor && quote.author != null)
                    _buildMeta(
                      context,
                      icon: Icons.person_outline,
                      text: quote.author!,
                    ),
                  if (showAuthor && quote.author != null && showSource && quote.source != null)
                    const SizedBox(width: 16),
                  if (showSource && quote.source != null)
                    _buildMeta(
                      context,
                      icon: Icons.book_outlined,
                      text: quote.source!,
                    ),
                  const Spacer(),
                  Icon(
                    quote.isCollected == true
                        ? Icons.favorite
                        : Icons.favorite_border,
                    size: 18,
                    color: quote.isCollected == true
                        ? Colors.red
                        : theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMeta(BuildContext context, {required IconData icon, required String text}) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(
          text,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
