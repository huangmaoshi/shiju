import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/providers/auth_provider.dart';
import 'package:shi_ju/theme/app_theme.dart';
import 'package:shi_ju/widgets/loading_view.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _nicknameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  int _tapCount = 0;
  DateTime? _lastTapAt;

  @override
  void dispose() {
    _nicknameController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _onWechatLogin() async {
    final auth = context.read<AuthProvider>();
    await auth.wechatLogin(
      code: 'mock_code_${DateTime.now().millisecondsSinceEpoch}',
      nickname: _nicknameController.text.trim().isEmpty
          ? '拾句用户'
          : _nicknameController.text.trim(),
    );
    if (!mounted) return;
    if (auth.isAuthenticated) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }

  Future<void> _onAccountLogin() async {
    final auth = context.read<AuthProvider>();
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入账号和密码')),
      );
      return;
    }

    await auth.accountLogin(username: username, password: password);
    if (!mounted) return;
    if (auth.isAuthenticated) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }

  void _handleLogoTap() {
    final now = DateTime.now();
    if (_lastTapAt != null && now.difference(_lastTapAt!).inMilliseconds < 700) {
      _tapCount++;
    } else {
      _tapCount = 1;
    }

    _lastTapAt = now;

    if (_tapCount >= 5) {
      _tapCount = 0;
      Navigator.of(context).pushNamed('/server-config');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.primaryContainer,
              theme.colorScheme.surface,
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              children: [
                const Spacer(flex: 2),
                GestureDetector(
                  onTap: _handleLogoTap,
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.format_quote,
                      color: Colors.white,
                      size: 48,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  '拾句',
                  style: theme.textTheme.displayLarge?.copyWith(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '记录每一句闪耀的文字',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const Spacer(flex: 3),
                Consumer<AuthProvider>(
                  builder: (context, auth, _) {
                    if (auth.isLoading) return const LoadingView();
                    return Column(
                      children: [
                        TextField(
                          controller: _nicknameController,
                          decoration: const InputDecoration(
                            hintText: '请输入昵称（可选）',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: _usernameController,
                          decoration: const InputDecoration(
                            hintText: '账号',
                            prefixIcon: Icon(Icons.account_circle_outlined),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(
                            hintText: '密码',
                            prefixIcon: Icon(Icons.lock_outline),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: FilledButton.icon(
                            onPressed: _onAccountLogin,
                            icon: const Icon(Icons.login, size: 22),
                            label: const Text('账号密码登录'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: FilledButton.icon(
                            onPressed: _onWechatLogin,
                            icon: const Icon(Icons.chat, size: 22),
                            label: const Text('微信一键登录'),
                          ),
                        ),
                        if (auth.error != null) ...[
                          const SizedBox(height: 16),
                          Text(
                            auth.error!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.error,
                            ),
                          ),
                        ],
                      ],
                    );
                  },
                ),
                const SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
