import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:urakkalaskuri/main.dart';

void main() {
  testWidgets('App renders home screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: UrakkalaskuriApp()));
    await tester.pumpAndSettle();
    expect(find.text('Uusi laskenta'), findsOneWidget);
  });
}
