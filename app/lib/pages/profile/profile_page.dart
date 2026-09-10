import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/providers/auth_provider.dart';
import 'package:shi_ju/providers/recite_provider.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();
    final stats = context.watch<ReciteProvider>().stats;

    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: ListView(
        children: [
          _buildHeader(theme, auth),
          const SizedBox(height: 8),
          _buildStatsRow(theme, auth, stats),
          const SizedBox(height: 16),
          _buildMenuSection(theme, auth),
          const SizedBox(height: 24),
        ],
      ),
      bottomNavigationBar: const _BottomBar(currentIndex: 3),
    );
  }

  Widget _buildHeader(ThemeData theme, AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.person,
              size: 32,
              color: theme.colorScheme.onPrimaryContainer,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  auth.user?.nickname ?? '拾句用户',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  auth.isAuthenticated
                      ? (auth.user?.isMember == true ? '拾句会员' : '普通用户')
                      : '未登录',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (!auth.isAuthenticated)
            FilledButton.tonal(
              onPressed: () {
                Navigator.of(context).pushNamed('/login');
              },
              child: const Text('登录'),
            ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(ThemeData theme, AuthProvider auth, stats) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _buildStatCard(theme, '收藏', '${auth.user?.collectionCount ?? 0}'),
          const SizedBox(width: 12),
          _buildStatCard(theme, '背诵', '${stats?.totalCount ?? 0}'),
          const SizedBox(width: 12),
          _buildStatCard(theme, '连续', '${stats?.streakDays ?? 0}天'),
        ],
      ),
    );
  }

  Widget _buildStatCard(ThemeData theme, String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: theme.textTheme.headlineSmall?.copyWith(
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

  Widget _buildMenuSection(ThemeData theme, AuthProvider auth) {
    final items = [
      _MenuItem(icon: Icons.menu_book, label: '金句库', route: '/library'),
      _MenuItem(icon: Icons.bookmark, label: '我的摘抄本', route: '/collection'),
      _MenuItem(icon: Icons.playlist_add, label: '背诵计划', route: '/recite'),
      _MenuItem(icon: Icons.workspace_premium, label: '会员中心', route: '/member'),
    ];

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          ...items.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            return Column(
              children: [
                if (index > 0)
                  Divider(
                    height: 1,
                    indent: 56,
                    color: theme.colorScheme.surfaceContainerHighest,
                  ),
                ListTile(
                  leading: Icon(item.icon, color: theme.colorScheme.primary),
                  title: Text(item.label),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).pushNamed(item.route),
                ),
              ],
            );
          }),
          if (auth.isAuthenticated) ...[
            Divider(
              height: 1,
              indent: 56,
              color: theme.colorScheme.surfaceContainerHighest,
            ),
            ListTile(
              leading: Icon(Icons.logout, color: theme.colorScheme.error),
              title: Text(
                '退出登录',
                style: TextStyle(color: theme.colorScheme.error),
              ),
              onTap: () async {
                await auth.logout();
                if (mounted) {
                  Navigator.of(context).pushReplacementNamed('/login');
                }
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String label;
  final String route;
  _MenuItem({required this.icon, required this.label, required this.route});
}

class _BottomBar extends StatelessWidget {
  final int currentIndex;
  const _BottomBar({required this.currentIndex});

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: (index) {
        final routes = ['/home', '/library', '/collection', '/profile'];
        if (index != currentIndex) {
          Navigator.of(context).pushReplacementNamed(routes[index]);
        }
      },
      destinations: const [
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: '首页'),
        NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: '金句库'),
        NavigationDestination(icon: Icon(Icons.bookmark_border), selectedIcon: Icon(Icons.bookmark), label: '收藏'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
      ],
    );
  }
}
