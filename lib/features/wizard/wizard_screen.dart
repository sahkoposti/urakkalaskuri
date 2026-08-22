import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../core/calculation/calculation_engine.dart';
import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common_widgets.dart';
import '../../theme/app_theme.dart';
import 'wizard_state.dart';

class WizardScreen extends ConsumerStatefulWidget {
  const WizardScreen({super.key});

  @override
  ConsumerState<WizardScreen> createState() => _WizardScreenState();
}

class _WizardScreenState extends ConsumerState<WizardScreen> {
  int _step = 0;
  final _projectController = TextEditingController();
  final _customerController = TextEditingController();
  final _durationController = TextEditingController();
  final _crewController = TextEditingController();
  final _marginController = TextEditingController();
  final _commissionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initDefaults());
  }

  Future<void> _initDefaults() async {
    final settings = await ref.read(settingsProvider.future);
    ref.read(wizardDraftProvider.notifier).reset(settings);
    _crewController.text = settings.defaultCrewSize.toString();
    _marginController.text = settings.defaultMarginPercent.toString();
    _commissionController.text = settings.defaultCommissionPercent.toString();
  }

  @override
  void dispose() {
    _projectController.dispose();
    _customerController.dispose();
    _durationController.dispose();
    _crewController.dispose();
    _marginController.dispose();
    _commissionController.dispose();
    super.dispose();
  }

  bool _validateStep() {
    switch (_step) {
      case 0:
        if (_projectController.text.trim().isEmpty) {
          _showError('Anna projektin nimi.');
          return false;
        }
        ref.read(wizardDraftProvider.notifier).updateProjectName(_projectController.text.trim());
        return true;
      case 1:
        ref.read(wizardDraftProvider.notifier).updateCustomer(_customerController.text.trim());
        return true;
      case 2:
        final duration = double.tryParse(_durationController.text.replaceAll(',', '.'));
        if (duration == null || duration <= 0) {
          _showError('Anna kelvollinen kesto tunneissa.');
          return false;
        }
        ref.read(wizardDraftProvider.notifier).updateDuration(duration);
        return true;
      case 3:
        final crew = int.tryParse(_crewController.text);
        if (crew == null || crew <= 0) {
          _showError('Anna kelvollinen työryhmän koko.');
          return false;
        }
        ref.read(wizardDraftProvider.notifier).updateCrewSize(crew);
        return true;
      case 4:
        return true;
      case 5:
        final margin = double.tryParse(_marginController.text.replaceAll(',', '.'));
        if (margin == null || margin < 0) {
          _showError('Anna kelvollinen myyntikatetavoite.');
          return false;
        }
        ref.read(wizardDraftProvider.notifier).updateMargin(margin);
        return true;
      case 6:
        final commission = double.tryParse(_commissionController.text.replaceAll(',', '.'));
        if (commission == null || commission < 0) {
          _showError('Anna kelvollinen myyntipalkkio.');
          return false;
        }
        ref.read(wizardDraftProvider.notifier).updateCommission(commission);
        return true;
      default:
        return true;
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _next() async {
    if (!_validateStep()) return;
    if (_step < 6) {
      setState(() => _step++);
      return;
    }
    await _finish();
  }

  Future<void> _finish() async {
    final draft = ref.read(wizardDraftProvider);
    final settings = await ref.read(settingsProvider.future);
    try {
      final result = runCalculation(
        CalculationInput(
          groupDurationHours: draft.groupDurationHours!,
          crewSize: draft.crewSize!,
          hourlyRate: settings.defaultHourlyRate,
          materialsVat0: draft.materialsVat0,
          marginPercent: draft.marginPercent!,
          commissionPercent: draft.commissionPercent!,
          vatPercent: settings.vatPercent,
          workdayHours: settings.workdayHours,
        ),
      );
      if (!mounted) return;
      context.push('/summary', extra: {'draft': draft, 'result': result, 'settings': settings});
    } on CalculationValidationException catch (e) {
      _showError(e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(wizardDraftProvider);
    final productsAsync = ref.watch(productsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Laskenta (${_step + 1}/7)'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/'),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: _buildStep(context, draft, productsAsync)),
            const SizedBox(height: 16),
            Row(
              children: [
                if (_step > 0)
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => setState(() => _step--),
                      child: const Text('Takaisin'),
                    ),
                  ),
                if (_step > 0) const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _next,
                    child: Text(_step == 6 ? 'Laske' : 'Seuraava'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(
    BuildContext context,
    WizardDraft draft,
    AsyncValue<List<Product>> productsAsync,
  ) {
    switch (_step) {
      case 0:
        return _stepLayout(
          'Projektin nimi',
          TextField(
            controller: _projectController,
            decoration: const InputDecoration(labelText: 'Projektin nimi *'),
            autofocus: true,
          ),
        );
      case 1:
        return _stepLayout(
          'Asiakas',
          TextField(
            controller: _customerController,
            decoration: const InputDecoration(labelText: 'Asiakas (valinnainen)'),
          ),
        );
      case 2:
        return _stepLayout(
          'Työryhmän arvioitu kesto',
          TextField(
            controller: _durationController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Kesto (h) *'),
          ),
        );
      case 3:
        return _stepLayout(
          'Työryhmän koko',
          TextField(
            controller: _crewController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Henkilömäärä *'),
          ),
        );
      case 4:
        return _stepLayout(
          'Materiaalit',
          productsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Virhe: $e'),
            data: (products) => _MaterialsStep(
              products: products,
              lines: draft.lines,
              onChanged: (lines) => ref.read(wizardDraftProvider.notifier).updateLines(lines),
            ),
          ),
        );
      case 5:
        return _stepLayout(
          'Myyntikatetavoite',
          TextField(
            controller: _marginController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Kate (%) *'),
          ),
        );
      case 6:
        return _stepLayout(
          'Myyntipalkkio',
          TextField(
            controller: _commissionController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Palkkio (%) *'),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _stepLayout(String title, Widget child) {
    return ListView(
      children: [
        SectionTitle(title, center: true),
        const SizedBox(height: 24),
        child,
      ],
    );
  }
}

class _MaterialsStep extends StatefulWidget {
  const _MaterialsStep({
    required this.products,
    required this.lines,
    required this.onChanged,
  });

  final List<Product> products;
  final List<WizardLineDraft> lines;
  final ValueChanged<List<WizardLineDraft>> onChanged;

  @override
  State<_MaterialsStep> createState() => _MaterialsStepState();
}

class _MaterialsStepState extends State<_MaterialsStep> {
  Product? _selected;
  final _quantityController = TextEditingController();

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  void _addLine() {
    final quantity = double.tryParse(_quantityController.text.replaceAll(',', '.'));
    if (_selected == null || quantity == null || quantity <= 0) return;
    final updated = [
      ...widget.lines,
      WizardLineDraft(product: _selected!, quantity: quantity),
    ];
    widget.onChanged(updated);
    _quantityController.clear();
    setState(() => _selected = null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.products.isEmpty)
          const Text('Ei tuotteita. Voit jatkaa ilman materiaalirivejä.')
        else ...[
          DropdownButtonFormField<Product>(
            initialValue: _selected,
            decoration: const InputDecoration(labelText: 'Tuote'),
            items: widget.products
                .map((p) => DropdownMenuItem(value: p, child: Text('${p.name} (${formatCurrency(p.unitPriceVat0)}/${p.unit})')))
                .toList(),
            onChanged: (value) => setState(() => _selected = value),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _quantityController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Määrä'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: _addLine, child: const Text('Lisää rivi')),
        ],
        const SizedBox(height: 16),
        ...widget.lines.map(
          (line) => AppCard(
            child: Row(
              children: [
                Expanded(
                  child: Text('${line.product.name} × ${formatDecimal(line.quantity)} ${line.product.unit}'),
                ),
                Text(formatCurrency(line.lineTotalVat0)),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.accent),
                  onPressed: () {
                    widget.onChanged(widget.lines.where((l) => l != line).toList());
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class SummaryScreen extends ConsumerWidget {
  const SummaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extra = GoRouterState.of(context).extra as Map<String, dynamic>?;
    if (extra == null) {
      return const Scaffold(body: Center(child: Text('Ei laskentaa')));
    }
    final draft = extra['draft'] as WizardDraft;
    final result = extra['result'] as CalculationResult;
    final settings = extra['settings'] as AppSettings;

    return Scaffold(
      appBar: AppBar(title: const Text('Yhteenveto')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SectionTitle('Tulos'),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              children: [
                ResultRow(label: 'Työryhmän kesto (h)', value: formatDecimal(draft.groupDurationHours!)),
                ResultRow(label: 'Työryhmän koko (hlö)', value: draft.crewSize.toString()),
                ResultRow(label: 'Urakkahinta (alv0)', value: formatCurrency(result.contractPriceVat0)),
                ResultRow(label: 'Materiaalit (alv0)', value: formatCurrency(result.materialsVat0)),
                ResultRow(label: 'Myyntikate (€)', value: formatCurrency(result.marginEur)),
                ResultRow(label: 'Myyntikate (%)', value: formatPercent(draft.marginPercent!)),
                ResultRow(label: 'Myyntipalkkio (€)', value: formatCurrency(result.commissionEur)),
                ResultRow(label: 'Myyntipalkkio (%)', value: formatPercent(draft.commissionPercent!)),
                const Divider(),
                ResultRow(
                  label: 'Kokonaishinta (alv0)',
                  value: formatCurrency(result.totalPriceVat0),
                  highlight: true,
                ),
                ResultRow(label: 'ALV (${formatPercent(settings.vatPercent)})', value: formatCurrency(result.vatAmount)),
                ResultRow(
                  label: 'Kokonaishinta (alv)',
                  value: formatCurrency(result.totalPriceVat),
                  highlight: true,
                ),
                ResultRow(label: 'Työkesto (pv)', value: formatDecimal(result.workDurationDays)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () async {
              final record = CalculationRecord(
                id: const Uuid().v4(),
                projectName: draft.projectName,
                customer: draft.customer.isEmpty ? null : draft.customer,
                groupDurationHours: draft.groupDurationHours!,
                crewSize: draft.crewSize!,
                hourlyRate: settings.defaultHourlyRate,
                marginPercent: draft.marginPercent!,
                commissionPercent: draft.commissionPercent!,
                contractPriceVat0: result.contractPriceVat0,
                materialsVat0: result.materialsVat0,
                marginEur: result.marginEur,
                commissionEur: result.commissionEur,
                totalPriceVat0: result.totalPriceVat0,
                vatAmount: result.vatAmount,
                totalPriceVat: result.totalPriceVat,
                workDurationDays: result.workDurationDays,
                createdAt: DateTime.now(),
                lines: draft.lines
                    .map(
                      (line) => CalculationLine(
                        id: const Uuid().v4(),
                        productId: line.product.id,
                        productName: line.product.name,
                        unit: line.product.unit,
                        unitPriceVat0: line.product.unitPriceVat0,
                        quantity: line.quantity,
                        lineTotalVat0: line.lineTotalVat0,
                      ),
                    )
                    .toList(),
              );
              await ref.read(databaseProvider).saveCalculation(record);
              ref.invalidate(calculationsProvider);
              if (context.mounted) context.go('/history');
            },
            child: const Text('Tallenna laskelma'),
          ),
        ],
      ),
    );
  }
}
