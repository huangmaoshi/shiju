import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/pages/library/library_page.dart';
import 'package:shi_ju/pages/collection/collection_page.dart';
import 'package:shi_ju/pages/profile/profile_page.dart';
import 'package:shi_ju/pages/search/search_page.dart';
import 'package:shi_ju/providers/home_provider.dart';
import 'package:shi_ju/widgets/category_grid.dart';
import 'package:shi_ju/widgets/empty_state.dart';
import 'package:shi_ju/widgets/loading_view.dart';
import 'package:shi_ju/widgets/quote_card.dart';
import 'package:shi_ju/models/category.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HomeProvider>().loadAll();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('拾句'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SearchPage()),
              );
            },
          ),
        ],
      ),
      body: Consumer<HomeProvider>(
        builder: (context, home, _) {
          if (home.isLoading && home.categories.isEmpty && home.randomQuote == null) {
            return const LoadingView();
          }
          return RefreshIndicator(
            onRefresh: home.loadAll,
            child: ListView(
              children: [
                const SizedBox(height: 16),
                _buildDailySection(home, theme),
                const SizedBox(height: 24),
                _buildRandomSection(home, theme),
                const SizedBox(height: 24),
                _buildCategorySection(home, theme),
                const SizedBox(height: 100),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: _BottomBar(currentIndex: 0),
    );
  }

  Widget _buildDailySection(HomeProvider home, ThemeData theme) {
    final quote = home.dailyQuote;
    if (quote == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        elevation: 0,
        color: theme.colorScheme.primaryContainer.withValues(alpha: 0.5),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.wb_sunny_outlined,
                    color: theme.colorScheme.primary,
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '每日一句',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  if (home.dailyRecommend?.topic != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surface,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        home.dailyRecommend!.topic!,
                        style: theme.textTheme.labelSmall,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                quote.content,
                style: theme.textTheme.bodyLarge?.copyWith(height: 1.8),
              ),
              if (quote.author != null || quote.source != null) ...[
                const SizedBox(height: 12),
                Text(
                  [
                    if (quote.author != null) quote.author!,
                    if (quote.source != null && quote.author != null) '·',
                    if (quote.source != null) quote.source!,
                  ].join(' '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRandomSection(HomeProvider home, ThemeData theme) {
    final quote = home.randomQuote;
    if (quote == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text(
                '随机金句',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: home.refreshRandom,
              ),
            ],
          ),
        ),
        QuoteCard(
          quote: quote,
          onTap: () => Navigator.of(context).pushNamed(
            '/quote-detail',
            arguments: quote.id,
          ),
        ),
      ],
    );
  }

  Widget _buildCategorySection(HomeProvider home, ThemeData theme) {
    final categories = home.categories;
    if (categories.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            '分类浏览',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        CategoryGrid(
          categories: categories,
          onTap: (category) {
            Navigator.of(context).pushNamed(
              '/library',
              arguments: category.id,
            );
          },
        ),
      ],
    );
  }
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
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: '首页',
        ),
        NavigationDestination(
          icon: Icon(Icons.menu_book_outlined),
          selectedIcon: Icon(Icons.menu_book),
          label: '金句库',
        ),
        NavigationDestination(
          icon: Icon(Icons.bookmark_border),
          selectedIcon: Icon(Icons.bookmark),
          label: '收藏',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: '我的',
        ),
      ],
    );
  }
}
