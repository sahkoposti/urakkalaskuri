import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/models.dart';

class WizardLineDraft {
  WizardLineDraft({
    required this.product,
    required this.quantity,
  });

  final Product product;
  final double quantity;

  double get lineTotalVat0 => quantity * product.unitPriceVat0;
}

class WizardDraft {
  WizardDraft({
    this.projectName = '',
    this.customer = '',
    this.groupDurationHours,
    this.crewSize,
    this.marginPercent,
    this.commissionPercent,
    this.lines = const [],
  });

  final String projectName;
  final String customer;
  final double? groupDurationHours;
  final int? crewSize;
  final double? marginPercent;
  final double? commissionPercent;
  final List<WizardLineDraft> lines;

  double get materialsVat0 => lines.fold(0, (sum, line) => sum + line.lineTotalVat0);

  WizardDraft copyWith({
    String? projectName,
    String? customer,
    double? groupDurationHours,
    int? crewSize,
    double? marginPercent,
    double? commissionPercent,
    List<WizardLineDraft>? lines,
  }) {
    return WizardDraft(
      projectName: projectName ?? this.projectName,
      customer: customer ?? this.customer,
      groupDurationHours: groupDurationHours ?? this.groupDurationHours,
      crewSize: crewSize ?? this.crewSize,
      marginPercent: marginPercent ?? this.marginPercent,
      commissionPercent: commissionPercent ?? this.commissionPercent,
      lines: lines ?? this.lines,
    );
  }
}

class WizardDraftNotifier extends StateNotifier<WizardDraft> {
  WizardDraftNotifier(this.ref) : super(WizardDraft());

  final Ref ref;

  void reset(AppSettings settings) {
    state = WizardDraft(
      crewSize: settings.defaultCrewSize,
      marginPercent: settings.defaultMarginPercent,
      commissionPercent: settings.defaultCommissionPercent,
    );
  }

  void updateProjectName(String value) => state = state.copyWith(projectName: value);
  void updateCustomer(String value) => state = state.copyWith(customer: value);
  void updateDuration(double value) => state = state.copyWith(groupDurationHours: value);
  void updateCrewSize(int value) => state = state.copyWith(crewSize: value);
  void updateMargin(double value) => state = state.copyWith(marginPercent: value);
  void updateCommission(double value) => state = state.copyWith(commissionPercent: value);
  void updateLines(List<WizardLineDraft> lines) => state = state.copyWith(lines: lines);
}

final wizardDraftProvider =
    StateNotifierProvider<WizardDraftNotifier, WizardDraft>((ref) {
  return WizardDraftNotifier(ref);
});
