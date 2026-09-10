import 'package:flutter/material.dart';
import 'package:shi_ju/pages/collection/collection_page.dart';
import 'package:shi_ju/pages/collection_detail/collection_detail_page.dart';
import 'package:shi_ju/pages/daily/daily_page.dart';
import 'package:shi_ju/pages/home/home_page.dart';
import 'package:shi_ju/pages/library/library_page.dart';
import 'package:shi_ju/pages/login/login_page.dart';
import 'package:shi_ju/pages/member/member_page.dart';
import 'package:shi_ju/pages/profile/profile_page.dart';
import 'package:shi_ju/pages/quote_detail/quote_detail_page.dart';
import 'package:shi_ju/pages/recite/recite_list_page.dart';
import 'package:shi_ju/pages/recite/recite_review_page.dart';
import 'package:shi_ju/pages/search/search_page.dart';
import 'package:shi_ju/pages/server_config/server_config_page.dart';
import 'package:shi_ju/pages/splash/splash_page.dart';
import 'package:shi_ju/theme/app_theme.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const App();
  }
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '拾句',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: const SplashPage(),
      routes: {
        '/splash': (_) => const SplashPage(),
        '/login': (_) => const LoginPage(),
        '/server-config': (_) => const ServerConfigPage(),
        '/home': (_) => const HomePage(),
        '/library': (_) => const LibraryPage(),
        '/quote-detail': (_) => const QuoteDetailPage(),
        '/search': (_) => const SearchPage(),
        '/collection': (_) => const CollectionPage(),
        '/collection-detail': (_) => const CollectionDetailPage(),
        '/recite': (_) => const ReciteListPage(),
        '/recite-review': (_) => const ReciteReviewPage(),
        '/member': (_) => const MemberPage(),
        '/profile': (_) => const ProfilePage(),
        '/daily': (_) => const DailyPage(),
      },
    );
  }
}
