import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/models/recite_plan.dart';
import 'package:shi_ju/pages/recite/recite_review_page.dart';
import 'package:shi_ju/providers/recite_provider.dart';
import 'package:shi_ju/widgets/empty_state.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class ReciteListPage extends StatefulWidget {
  const ReciteListPage({super.key});

  @override
  State<ReciteListPage> createState() => _ReciteListPageState();
}

class _ReciteListPageState extends State<ReciteListPage> {
  String _currentTab = 'today';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ReciteProvider>().fetchToday();
      context.read<ReciteProvider>().fetchStats();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('背诵计划'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: theme.colorScheme.surfaceContainerHighest),
        ),
      ),
      body: Column(
        children: [
          _buildStats(theme),
          _buildTabs(theme),
          Expanded(child: _buildList()),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ReciteReviewPage()),
          );
        },
        icon: const Icon(Icons.play_arrow),
        label: const Text('开始复习'),
      ),
    );
  }

  Widget _buildStats(ThemeData theme) {
    return Consumer<ReciteProvider>(
      builder: (context, recite, _) {
        final stats = recite.stats;
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              _buildStatItem(theme, '今日', '${stats?.todayCount ?? 0}'),
              _buildStatItem(theme, '已掌握', '${stats?.masteredCount ?? 0}'),
              _buildStatItem(theme, '连续', '${stats?.streakDays ?? 0}天'),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatItem(ThemeData theme, String label, String value) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabs(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _buildTab(theme, 'today', '今日'),
          const SizedBox(width: 12),
          _buildTab(theme, 'reviewing', '复习中'),
          const SizedBox(width: 12),
          _buildTab(theme, 'mastered', '已掌握'),
        ],
      ),
    );
  }

  Widget _buildTab(ThemeData theme, String value, String label) {
    final isSelected = _currentTab == value;
    return GestureDetector(
      onTap: () {
        setState(() => _currentTab = value);
        if (value == 'today') {
          context.read<ReciteProvider>().fetchToday();
        } else {
          context.read<ReciteProvider>().fetchList(status: value);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? theme.colorScheme.primary
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: isSelected
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurface,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    return Consumer<ReciteProvider>(
      builder: (context, recite, _) {
        if (_currentTab == 'today') {
          if (recite.todayPlans.isEmpty) {
            return const EmptyState(
              icon: Icons.check_circle_outline,
              message: '今天没有要背诵的内容',
            );
          }
          return _buildPlanList(recite.todayPlans);
        }
        if (recite.isLoading && recite.plans.isEmpty) {
          return const LoadingView();
        }
        if (recite.plans.isEmpty) {
          return const EmptyState(
            icon: Icons.inbox_outlined,
            message: '暂无背诵计划',
          );
        }
        return _buildPlanList(recite.plans);
      },
    );
  }

  Widget _buildPlanList(List<RecitePlan> plans) {
    final theme = Theme.of(context);
    return ListView.builder(
      itemCount: plans.length,
      padding: const EdgeInsets.all(16),
      itemBuilder: (context, index) {
        final plan = plans[index];
        final quote = plan.quote;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerLow,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                quote?.content ?? '加载中...',
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      plan.statusText,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '复习 ${plan.reviewCount} 次',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
