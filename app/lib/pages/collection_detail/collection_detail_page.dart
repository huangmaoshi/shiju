import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/providers/collection_provider.dart';
import 'package:shi_ju/widgets/empty_state.dart';
import 'package:shi_ju/widgets/loading_view.dart';
import 'package:shi_ju/widgets/quote_list_item.dart';

class CollectionDetailPage extends StatefulWidget {
  const CollectionDetailPage({super.key});

  @override
  State<CollectionDetailPage> createState() => _CollectionDetailPageState();
}

class _CollectionDetailPageState extends State<CollectionDetailPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is String) {
        context.read<CollectionProvider>().fetchQuotes(collectionId: args);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('摘抄本详情')),
      body: Consumer<CollectionProvider>(
        builder: (context, collectionProvider, _) {
          if (collectionProvider.isLoading && collectionProvider.currentQuotes.isEmpty) {
            return const LoadingView();
          }
          if (collectionProvider.currentQuotes.isEmpty) {
            return const EmptyState(
              icon: Icons.inbox_outlined,
              message: '这个摘抄本还是空的',
            );
          }
          return ListView.builder(
            itemCount: collectionProvider.currentQuotes.length,
            itemBuilder: (context, index) {
              final quote = collectionProvider.currentQuotes[index];
              return QuoteListItem(
                quote: quote,
                onTap: () => Navigator.of(context).pushNamed(
                  '/quote-detail',
                  arguments: quote.id,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
