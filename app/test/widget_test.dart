import 'package:flutter_test/flutter_test.dart';
import 'package:shi_ju/app.dart';

void main() {
  testWidgets('App builds without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const App());

    expect(find.byType(App), findsOneWidget);
  });
}
