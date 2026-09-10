import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/models/quote.dart';
import 'package:shi_ju/providers/collection_provider.dart';
import 'package:shi_ju/providers/quote_provider.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class QuoteDetailPage extends StatefulWidget {
  const QuoteDetailPage({super.key});

  @override
  State<QuoteDetailPage> createState() => _QuoteDetailPageState();
}

class _QuoteDetailPageState extends State<QuoteDetailPage> {
  Quote? _quote;
  bool _isCollected = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is String) {
        _loadQuote(args);
      }
    });
  }

  Future<void> _loadQuote(String id) async {
    setState(() => _isLoading = true);
    final quote = await context.read<QuoteProvider>().getById(id);
    if (mounted && quote != null) {
      setState(() {
        _quote = quote;
        _isCollected = quote.isCollected ?? false;
        _isLoading = false;
      });
    } else {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleCollect() async {
    if (_quote == null) return;
    final collectionProvider = context.read<CollectionProvider>();
    setState(() => _isCollected = !_isCollected);
    final success = _isCollected
        ? await collectionProvider.collect(_quote!.id)
        : await collectionProvider.uncollect(_quote!.id);
    if (!success) {
      setState(() => _isCollected = !_isCollected);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('操作失败')),
        );
      }
    }
  }

  Future<void> _copyContent() async {
    if (_quote == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('已复制到剪贴板')),
    );
  }

  Future<void> _addRecite() async {
    if (_quote == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('已加入背诵计划')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            icon: Icon(_isCollected ? Icons.favorite : Icons.favorite_border),
            color: _isCollected ? Colors.red : null,
            onPressed: _toggleCollect,
          ),
          IconButton(
            icon: const Icon(Icons.content_copy),
            onPressed: _copyContent,
          ),
          IconButton(
            icon: const Icon(Icons.playlist_add),
            onPressed: _addRecite,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingView()
          : _quote == null
              ? Center(
                  child: Text(
                    '金句不存在',
                    style: theme.textTheme.bodyLarge,
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primaryContainer.withOpacity(0.3),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          _quote!.content,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            height: 2,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      if (_quote!.author != null)
                        _buildInfoRow(theme, '作者', _quote!.author!),
                      if (_quote!.source != null)
                        _buildInfoRow(theme, '出处', _quote!.source!),
                      if (_quote!.translation != null) ...[
                        const SizedBox(height: 24),
                        Text(
                          '译文',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _quote!.translation!,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            height: 1.8,
                          ),
                        ),
                      ],
                      if (_quote!.annotation != null) ...[
                        const SizedBox(height: 24),
                        Text(
                          '赏析',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _quote!.annotation!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            height: 1.8,
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          _buildStat(theme, Icons.visibility, '${_quote!.viewCount}'),
                          const SizedBox(width: 24),
                          _buildStat(theme, Icons.favorite, '${_quote!.collectCount}'),
                          const SizedBox(width: 24),
                          _buildStat(theme, Icons.record_voice_over, '${_quote!.reciteCount}'),
                        ],
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildInfoRow(ThemeData theme, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 50,
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStat(ThemeData theme, IconData icon, String count) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 4),
        Text(
          count,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
