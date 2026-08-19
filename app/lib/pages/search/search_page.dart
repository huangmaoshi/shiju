import 'package:flutter/material.dart';
import 'package:shi_ju/utils/storage_util.dart';
import 'package:shi_ju/widgets/empty_state.dart';
import 'package:shi_ju/widgets/loading_view.dart';
import 'package:shi_ju/widgets/quote_list_item.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/services/search_api.dart';
import 'package:shi_ju/models/search_result.dart';
import 'package:shi_ju/models/quote.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  SearchApi? _searchApi;
  StorageUtil? _storage;

  bool _isLoading = false;
  bool _hasSearched = false;
  List<Quote> _results = [];
  List<String> _history = [];
  List<HotKeyword> _hotKeywords = [];

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final client = await ApiClient.instance;
    _searchApi = SearchApi(client);
    _storage = await StorageUtil.instance;
    _loadHistory();
    _loadHot();
    _focusNode.requestFocus();
  }

  void _loadHistory() {
    if (_storage != null) {
      setState(() => _history = _storage!.getSearchHistory());
    }
  }

  Future<void> _loadHot() async {
    if (_searchApi == null) return;
    try {
      final response = await _searchApi!.hot();
      if (response.isSuccess) {
        setState(() => _hotKeywords = response.items);
      }
    } catch (_) {}
  }

  Future<void> _search(String keyword) async {
    keyword = keyword.trim();
    if (keyword.isEmpty || _searchApi == null || _storage == null) return;

    await _storage!.addSearchKeyword(keyword);
    _loadHistory();

    setState(() {
      _isLoading = true;
      _hasSearched = true;
      _results.clear();
    });

    try {
      final response = await _searchApi!.search(keyword: keyword);
      if (response.isSuccess && response.data != null) {
        setState(() => _results = response.data!.quotes);
      }
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _clearHistory() async {
    if (_storage == null) return;
    await _storage!.clearSearchHistory();
    setState(() => _history.clear());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          focusNode: _focusNode,
          decoration: const InputDecoration(
            hintText: '搜索金句、作者、出处',
            border: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
          onSubmitted: _search,
        ),
        actions: [
          TextButton(
            onPressed: () => _search(_controller.text),
            child: const Text('搜索'),
          ),
        ],
      ),
      body: _buildBody(theme),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_isLoading) return const LoadingView();
    if (_hasSearched) {
      if (_results.isEmpty) {
        return const EmptyState(
          icon: Icons.search_off,
          message: '没有找到相关金句',
        );
      }
      return ListView.builder(
        itemCount: _results.length,
        itemBuilder: (context, index) {
          final quote = _results[index];
          return QuoteListItem(
            quote: quote,
            onTap: () => Navigator.of(context).pushNamed(
              '/quote-detail',
              arguments: quote.id,
            ),
          );
        },
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_history.isNotEmpty) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '搜索历史',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              TextButton.icon(
                onPressed: _clearHistory,
                icon: const Icon(Icons.delete_outline, size: 16),
                label: const Text('清空'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _history
                .map((k) => ActionChip(
                      label: Text(k),
                      onPressed: () {
                        _controller.text = k;
                        _search(k);
                      },
                    ))
                .toList(),
          ),
          const SizedBox(height: 24),
        ],
        Text(
          '热门搜索',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _hotKeywords
              .map((k) => ActionChip(
                    label: Text(k.keyword),
                    onPressed: () {
                      _controller.text = k.keyword;
                      _search(k.keyword);
                    },
                  ))
              .toList(),
        ),
      ],
    );
  }
}
