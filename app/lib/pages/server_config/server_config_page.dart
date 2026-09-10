import 'package:flutter/material.dart';
import 'package:shi_ju/config/api_config.dart';
import 'package:shi_ju/services/api_client.dart';
import 'package:shi_ju/utils/storage_util.dart';

class ServerConfigPage extends StatefulWidget {
  const ServerConfigPage({super.key});

  @override
  State<ServerConfigPage> createState() => _ServerConfigPageState();
}

class _ServerConfigPageState extends State<ServerConfigPage> {
  final TextEditingController _baseUrlController = TextEditingController();
  bool _isSaving = false;
  StorageUtil? _storage;

  @override
  void initState() {
    super.initState();
    _loadCurrentUrl();
  }

  Future<void> _loadCurrentUrl() async {
    _storage = await StorageUtil.instance;
    if (!mounted) return;
    final currentUrl = _storage?.apiBaseUrl ?? ApiConfig.defaultBaseUrl;
    _baseUrlController.text = currentUrl;
  }

  Future<void> _saveConfig() async {
    final trimmed = _baseUrlController.text.trim();
    final nextUrl = trimmed.isEmpty ? ApiConfig.defaultBaseUrl : trimmed;

    setState(() => _isSaving = true);

    try {
      _storage ??= await StorageUtil.instance;
      await _storage!.saveApiBaseUrl(nextUrl);
      final apiClient = await ApiClient.instance;
      apiClient.updateBaseUrl(nextUrl);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('服务器地址已保存')),
      );
      Navigator.of(context).pop();
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  void dispose() {
    _baseUrlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('服务器配置'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '请设置后端 API 地址',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              Text(
                '当前默认地址：${ApiConfig.defaultBaseUrl}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _baseUrlController,
                decoration: const InputDecoration(
                  labelText: 'API Base URL',
                  hintText: 'http://192.168.1.10:6010/api/v1',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _isSaving ? null : _saveConfig,
                  child: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('保存并重连'),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () {
                  _baseUrlController.text = ApiConfig.defaultBaseUrl;
                },
                child: const Text('恢复默认地址'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
