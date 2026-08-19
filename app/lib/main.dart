import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shi_ju/app.dart';
import 'package:shi_ju/providers/auth_provider.dart';
import 'package:shi_ju/providers/collection_provider.dart';
import 'package:shi_ju/providers/home_provider.dart';
import 'package:shi_ju/providers/quote_provider.dart';
import 'package:shi_ju/providers/recite_provider.dart';
import 'package:shi_ju/providers/sync_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final authProvider = await AuthProvider.create();
  final homeProvider = await HomeProvider.create();
  final quoteProvider = await QuoteProvider.create();
  final collectionProvider = await CollectionProvider.create();
  final reciteProvider = await ReciteProvider.create();
  final syncProvider = await SyncProvider.create();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProvider),
        ChangeNotifierProvider.value(value: homeProvider),
        ChangeNotifierProvider.value(value: quoteProvider),
        ChangeNotifierProvider.value(value: collectionProvider),
        ChangeNotifierProvider.value(value: reciteProvider),
        ChangeNotifierProvider.value(value: syncProvider),
      ],
      child: const App(),
    ),
  );
}
