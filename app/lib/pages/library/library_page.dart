import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/providers/quote_provider.dart';
import 'package:shi_ju/widgets/category_grid.dart';
import 'package:shi_ju/widgets/loading_view.dart';
import 'package:shi_ju/widgets/quote_list_item.dart';

class LibraryPage extends StatefulWidget {
  final int? initialCategoryId;

  const LibraryPage({super.key, this.initialCategoryId});

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  int? _selectedCategoryId;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _selectedCategoryId = widget.initialCategoryId;
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<QuoteProvider>().fetchList(
            categoryId: _selectedCategoryId,
            refresh: true,
          );
    });
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      context.read<QuoteProvider>().loadMore();
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('金句库'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: theme.colorScheme.surfaceContainerHighest),
        ),
      ),
      body: Consumer<QuoteProvider>(
        builder: (context, quoteProvider, _) {
          if (quoteProvider.isLoading && quoteProvider.quotes.isEmpty) {
            return const LoadingView();
          }
          return RefreshIndicator(
            onRefresh: () => quoteProvider.fetchList(
              categoryId: _selectedCategoryId,
              refresh: true,
            ),
            child: ListView.builder(
              controller: _scrollController,
              itemCount: quoteProvider.quotes.length + 1,
              itemBuilder: (context, index) {
                if (index == quoteProvider.quotes.length) {
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: quoteProvider.hasMore
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(
                              '没有更多了',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                    ),
                  );
                }
                final quote = quoteProvider.quotes[index];
                return QuoteListItem(
                  quote: quote,
                  onTap: () => Navigator.of(context).pushNamed(
                    '/quote-detail',
                    arguments: quote.id,
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
