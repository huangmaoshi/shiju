import 'package:flutter/material.dart';
import 'package:shi_ju/models/daily_recommend.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/daily_recommend_api.dart';
import 'package:shi_ju/theme/app_theme.dart';
import 'package:shi_ju/widgets/empty_state.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class DailyPage extends StatefulWidget {
  const DailyPage({super.key});

  @override
  State<DailyPage> createState() => _DailyPageState();
}

class _DailyPageState extends State<DailyPage> {
  DailyRecommend? _recommend;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final client = await ApiClient.instance;
    final api = DailyRecommendApi(client);
    try {
      final response = await api.today();
      if (mounted) {
        setState(() {
          if (response.isSuccess) _recommend = response.data;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('每日推荐')),
      body: _isLoading
          ? const LoadingView()
          : _recommend == null
              ? const EmptyState(
                  icon: Icons.wb_sunny_outlined,
                  message: '今日暂无推荐',
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppTheme.primaryContainer,
                              theme.colorScheme.surface,
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.wb_sunny, color: AppTheme.primary),
                                const SizedBox(width: 8),
                                Text(
                                  '${_recommend!.date}',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    color: AppTheme.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            Text(
                              _recommend!.quote?.content ?? '',
                              style: theme.textTheme.headlineMedium?.copyWith(
                                height: 2,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 16),
                            if (_recommend!.quote?.author != null ||
                                _recommend!.quote?.source != null)
                              Text(
                                [
                                  if (_recommend!.quote?.author != null)
                                    _recommend!.quote!.author!,
                                  if (_recommend!.quote?.source != null)
                                    _recommend!.quote!.source!,
                                ].join(' · '),
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (_recommend!.topic != null) ...[
                        const SizedBox(height: 24),
                        Text(
                          '今日话题',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _recommend!.topic!,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onPrimaryContainer,
                            ),
                          ),
                        ),
                      ],
                      if (_recommend!.commentary != null) ...[
                        const SizedBox(height: 24),
                        Text(
                          '深度解析',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _recommend!.commentary!,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            height: 1.8,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}
