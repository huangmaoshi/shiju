import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/providers/recite_provider.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class ReciteReviewPage extends StatefulWidget {
  const ReciteReviewPage({super.key});

  @override
  State<ReciteReviewPage> createState() => _ReciteReviewPageState();
}

class _ReciteReviewPageState extends State<ReciteReviewPage> {
  int _currentIndex = 0;
  bool _showAnswer = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ReciteProvider>().fetchToday();
    });
  }

  void _next() {
    setState(() {
      _showAnswer = false;
      if (_currentIndex < context.read<ReciteProvider>().todayPlans.length - 1) {
        _currentIndex++;
      } else {
        Navigator.of(context).pop();
      }
    });
  }

  Future<void> _review(String action) async {
    final plan = context.read<ReciteProvider>().todayPlans[_currentIndex];
    await context.read<ReciteProvider>().review(
          planId: plan.id,
          action: action,
        );
    if (mounted) _next();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('背诵复习')),
      body: Consumer<ReciteProvider>(
        builder: (context, recite, _) {
          if (recite.todayPlans.isEmpty) {
            return const LoadingView();
          }
          if (_currentIndex >= recite.todayPlans.length) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle, size: 64, color: theme.colorScheme.primary),
                  const SizedBox(height: 16),
                  Text('今日背诵完成！', style: theme.textTheme.titleLarge),
                ],
              ),
            );
          }

          final plan = recite.todayPlans[_currentIndex];
          final quote = plan.quote;

          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                LinearProgressIndicator(
                  value: (_currentIndex + 1) / recite.todayPlans.length,
                  borderRadius: BorderRadius.circular(4),
                ),
                const SizedBox(height: 16),
                Text(
                  '${_currentIndex + 1} / ${recite.todayPlans.length}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      children: [
                        Expanded(
                          child: Center(
                            child: _showAnswer
                                ? Text(
                                    quote?.content ?? '',
                                    style: theme.textTheme.headlineMedium?.copyWith(
                                      height: 2,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    textAlign: TextAlign.center,
                                  )
                                : Text(
                                    quote?.content?.replaceAll(RegExp('.'), '●') ?? '',
                                    style: theme.textTheme.headlineMedium?.copyWith(
                                      height: 2,
                                      color: theme.colorScheme.onSurfaceVariant,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                          ),
                        ),
                        if (quote?.author != null || quote?.source != null)
                          Text(
                            [
                              if (quote?.author != null) quote!.author!,
                              if (quote?.source != null) quote!.source!,
                            ].join(' · '),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                if (!_showAnswer)
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton.tonal(
                      onPressed: () => setState(() => _showAnswer = true),
                      child: const Text('显示答案'),
                    ),
                  ),
                if (_showAnswer) ...[
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _review('hard'),
                          icon: const Icon(Icons.sentiment_dissatisfied),
                          label: const Text('困难'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () => _review('good'),
                          icon: const Icon(Icons.sentiment_satisfied),
                          label: const Text('一般'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.tonalIcon(
                          onPressed: () => _review('easy'),
                          icon: const Icon(Icons.sentiment_very_satisfied),
                          label: const Text('简单'),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }
}
