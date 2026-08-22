import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:intl/intl.dart';

import '../../core/providers/providers.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common_widgets.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final calculationsAsync = ref.watch(calculationsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Historia')),
      body: calculationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Virhe: $e')),
        data: (records) {
          if (records.isEmpty) {
            return const Center(child: Text('Ei tallennettuja laskelmia.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: records.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final record = records[index];
              return AppCard(
                onTap: () => context.push('/history/${record.id}'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(record.projectName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    if (record.customer != null) Text(record.customer!),
                    const SizedBox(height: 8),
                    Text(formatCurrency(record.totalPriceVat0), style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(DateFormat('d.M.yyyy').format(record.createdAt)),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class HistoryDetailScreen extends ConsumerWidget {
  const HistoryDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recordAsync = ref.watch(calculationProvider(id));

    return Scaffold(
      appBar: AppBar(title: const Text('Laskelman tiedot')),
      body: recordAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Virhe: $e')),
        data: (record) {
          if (record == null) {
            return const Center(child: Text('Laskelmaa ei löytynyt.'));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionTitle(record.projectName),
              const SizedBox(height: 16),
              AppCard(
                child: Column(
                  children: [
                    ResultRow(label: 'Asiakas', value: record.customer ?? '–'),
                    ResultRow(label: 'Kesto (h)', value: formatDecimal(record.groupDurationHours)),
                    ResultRow(label: 'Työryhmä', value: '${record.crewSize} hlö'),
                    ResultRow(label: 'Urakkahinta (alv0)', value: formatCurrency(record.contractPriceVat0)),
                    ResultRow(label: 'Materiaalit (alv0)', value: formatCurrency(record.materialsVat0)),
                    ResultRow(label: 'Myyntikate (€)', value: formatCurrency(record.marginEur)),
                    ResultRow(label: 'Myyntipalkkio (€)', value: formatCurrency(record.commissionEur)),
                    ResultRow(label: 'Kokonaishinta (alv0)', value: formatCurrency(record.totalPriceVat0), highlight: true),
                    ResultRow(label: 'Kokonaishinta (alv)', value: formatCurrency(record.totalPriceVat), highlight: true),
                    ResultRow(label: 'Työkesto (pv)', value: formatDecimal(record.workDurationDays)),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
