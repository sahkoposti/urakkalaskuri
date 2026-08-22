import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../models/models.dart';

final databaseProvider = Provider<AppDatabase>((ref) => AppDatabase.instance);

final settingsProvider = FutureProvider<AppSettings>((ref) async {
  return ref.watch(databaseProvider).getSettings();
});

final productsProvider = FutureProvider<List<Product>>((ref) async {
  return ref.watch(databaseProvider).getProducts();
});

final calculationsProvider = FutureProvider<List<CalculationRecord>>((ref) async {
  return ref.watch(databaseProvider).getCalculations();
});

final calculationProvider = FutureProvider.family<CalculationRecord?, String>((ref, id) async {
  return ref.watch(databaseProvider).getCalculation(id);
});
