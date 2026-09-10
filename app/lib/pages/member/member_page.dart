import 'package:flutter/material.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/member_api.dart';
import 'package:shi_ju/models/member.dart';
import 'package:shi_ju/theme/app_theme.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class MemberPage extends StatefulWidget {
  const MemberPage({super.key});

  @override
  State<MemberPage> createState() => _MemberPageState();
}

class _MemberPageState extends State<MemberPage> {
  MemberInfo? _memberInfo;
  List<MemberPlan> _plans = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final client = await ApiClient.instance;
    final api = MemberApi(client);
    try {
      final infoResponse = await api.info();
      final plansResponse = await api.plans();
      if (mounted) {
        setState(() {
          if (infoResponse.isSuccess && infoResponse.data != null) {
            _memberInfo = infoResponse.data;
          }
          if (plansResponse.isSuccess) {
            _plans = plansResponse.items;
          }
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
      appBar: AppBar(title: const Text('会员中心')),
      body: _isLoading
          ? const LoadingView()
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildMemberCard(theme),
                const SizedBox(height: 24),
                Text(
                  '会员套餐',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                ..._plans.map((plan) => _buildPlanItem(theme, plan)),
              ],
            ),
    );
  }

  Widget _buildMemberCard(ThemeData theme) {
    final info = _memberInfo;
    final isMember = info?.isMember ?? false;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isMember
              ? [const Color(0xFFFFD700), const Color(0xFFFFA500)]
              : [AppTheme.primary, AppTheme.primary.withOpacity(0.7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isMember ? Icons.workspace_premium : Icons.star,
                color: Colors.white,
                size: 28,
              ),
              const SizedBox(width: 8),
              Text(
                isMember ? '拾句会员' : '普通用户',
                style: theme.textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (isMember && info?.expireAt != null)
            Text(
              '到期时间：${info!.expireAt!.toString().substring(0, 10)}',
              style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white70),
            ),
          const SizedBox(height: 16),
          Text(
            isMember ? '剩余 ${info?.remainDays ?? 0} 天' : '开通会员，解锁更多高级功能',
            style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanItem(ThemeData theme, MemberPlan plan) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.name,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  plan.description,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${plan.days} 天',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '¥${plan.price.toStringAsFixed(0)}',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
