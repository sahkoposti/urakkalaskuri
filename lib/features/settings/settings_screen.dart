import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/models.dart';
import '../../core/providers/providers.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _vatController;
  late final TextEditingController _marginController;
  late final TextEditingController _commissionController;
  late final TextEditingController _hourlyRateController;
  late final TextEditingController _crewController;
  late final TextEditingController _workdayController;

  @override
  void initState() {
    super.initState();
    _vatController = TextEditingController();
    _marginController = TextEditingController();
    _commissionController = TextEditingController();
    _hourlyRateController = TextEditingController();
    _crewController = TextEditingController();
    _workdayController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final settings = await ref.read(settingsProvider.future);
    _vatController.text = settings.vatPercent.toString();
    _marginController.text = settings.defaultMarginPercent.toString();
    _commissionController.text = settings.defaultCommissionPercent.toString();
    _hourlyRateController.text = settings.defaultHourlyRate.toString();
    _crewController.text = settings.defaultCrewSize.toString();
    _workdayController.text = settings.workdayHours.toString();
    setState(() {});
  }

  @override
  void dispose() {
    _vatController.dispose();
    _marginController.dispose();
    _commissionController.dispose();
    _hourlyRateController.dispose();
    _crewController.dispose();
    _workdayController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final settings = AppSettings(
      vatPercent: double.parse(_vatController.text.replaceAll(',', '.')),
      defaultMarginPercent: double.parse(_marginController.text.replaceAll(',', '.')),
      defaultCommissionPercent: double.parse(_commissionController.text.replaceAll(',', '.')),
      defaultHourlyRate: double.parse(_hourlyRateController.text.replaceAll(',', '.')),
      defaultCrewSize: int.parse(_crewController.text),
      workdayHours: double.parse(_workdayController.text.replaceAll(',', '.')),
    );
    await ref.read(databaseProvider).saveSettings(settings);
    ref.invalidate(settingsProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Asetukset tallennettu')),
      );
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Asetukset')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _vatController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'ALV (%)'),
              validator: _requiredNumber,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _marginController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Myyntikatetavoite (%)'),
              validator: _requiredNumber,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _commissionController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Myyntipalkkio (%)'),
              validator: _requiredNumber,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _hourlyRateController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Tuntihinta (alv0) €/h'),
              validator: _requiredNumber,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _crewController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Oletustyöryhmän koko (hlö)'),
              validator: (v) => v == null || int.tryParse(v) == null ? 'Anna luku' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _workdayController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Työpäivän pituus (h)'),
              validator: _requiredNumber,
            ),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: _save, child: const Text('Tallenna')),
          ],
        ),
      ),
    );
  }

  String? _requiredNumber(String? value) {
    if (value == null || double.tryParse(value.replaceAll(',', '.')) == null) {
      return 'Anna kelvollinen luku';
    }
    return null;
  }
}
