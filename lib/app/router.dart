import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/models/models.dart';
import '../features/history/history_screen.dart';
import '../features/home/home_screen.dart';
import '../features/products/products_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/wizard/wizard_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/wizard', builder: (_, __) => const WizardScreen()),
      GoRoute(path: '/summary', builder: (_, __) => const SummaryScreen()),
      GoRoute(path: '/products', builder: (_, __) => const ProductsScreen()),
      GoRoute(
        path: '/products/new',
        builder: (_, __) => const ProductEditScreen(),
      ),
      GoRoute(
        path: '/products/:id',
        builder: (context, state) {
          final product = state.extra as Product?;
          return ProductEditScreen(product: product);
        },
      ),
      GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
      GoRoute(
        path: '/history/:id',
        builder: (_, state) => HistoryDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    ],
  );
});
