import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/providers/collection_provider.dart';
import 'package:shi_ju/widgets/empty_state.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class CollectionPage extends StatefulWidget {
  const CollectionPage({super.key});

  @override
  State<CollectionPage> createState() => _CollectionPageState();
}

class _CollectionPageState extends State<CollectionPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CollectionProvider>().fetchCollections(refresh: true);
    });
  }

  Future<void> _showCreateDialog() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('新建摘抄本'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(hintText: '摘抄本名称'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(controller.text.trim()),
              child: const Text('创建'),
            ),
          ],
        );
      },
    );
    if (!mounted) return;
    if (result != null && result.isNotEmpty) {
      context.read<CollectionProvider>().createCollection(name: result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('我的摘抄本'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _showCreateDialog,
          ),
        ],
      ),
      body: Consumer<CollectionProvider>(
        builder: (context, collectionProvider, _) {
          if (collectionProvider.isLoading && collectionProvider.collections.isEmpty) {
            return const LoadingView();
          }
          if (collectionProvider.collections.isEmpty) {
            return EmptyState(
              icon: Icons.bookmark_border,
              message: '还没有摘抄本，快去创建一个吧',
              actionLabel: '新建摘抄本',
              onAction: _showCreateDialog,
            );
          }
          return RefreshIndicator(
            onRefresh: () => collectionProvider.fetchCollections(refresh: true),
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.85,
              ),
              itemCount: collectionProvider.collections.length,
              itemBuilder: (context, index) {
                final collection = collectionProvider.collections[index];
                return InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => Navigator.of(context).pushNamed(
                    '/collection-detail',
                    arguments: collection.id,
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 90,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primaryContainer.withValues(alpha: 0.5),
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(16),
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              Icons.menu_book,
                              size: 36,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                collection.name,
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${collection.quoteCount} 句',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
      bottomNavigationBar: const _BottomBar(currentIndex: 2),
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
        NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: '首页'),
        NavigationDestination(icon: Icon(Icons.menu_book_outlined), selectedIcon: Icon(Icons.menu_book), label: '金句库'),
        NavigationDestination(icon: Icon(Icons.bookmark_border), selectedIcon: Icon(Icons.bookmark), label: '收藏'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
      ],
    );
  }
}
