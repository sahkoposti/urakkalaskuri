class AppSettings {
  const AppSettings({
    required this.vatPercent,
    required this.defaultMarginPercent,
    required this.defaultCommissionPercent,
    required this.defaultHourlyRate,
    required this.defaultCrewSize,
    required this.workdayHours,
  });

  final double vatPercent;
  final double defaultMarginPercent;
  final double defaultCommissionPercent;
  final double defaultHourlyRate;
  final int defaultCrewSize;
  final double workdayHours;

  static const defaults = AppSettings(
    vatPercent: 25.5,
    defaultMarginPercent: 35,
    defaultCommissionPercent: 7,
    defaultHourlyRate: 30,
    defaultCrewSize: 2,
    workdayHours: 8,
  );

  AppSettings copyWith({
    double? vatPercent,
    double? defaultMarginPercent,
    double? defaultCommissionPercent,
    double? defaultHourlyRate,
    int? defaultCrewSize,
    double? workdayHours,
  }) {
    return AppSettings(
      vatPercent: vatPercent ?? this.vatPercent,
      defaultMarginPercent: defaultMarginPercent ?? this.defaultMarginPercent,
      defaultCommissionPercent:
          defaultCommissionPercent ?? this.defaultCommissionPercent,
      defaultHourlyRate: defaultHourlyRate ?? this.defaultHourlyRate,
      defaultCrewSize: defaultCrewSize ?? this.defaultCrewSize,
      workdayHours: workdayHours ?? this.workdayHours,
    );
  }
}

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.unit,
    required this.unitPriceVat0,
    this.description,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String unit;
  final double unitPriceVat0;
  final String? description;
  final DateTime createdAt;
}

class CalculationLine {
  const CalculationLine({
    required this.id,
    required this.productId,
    required this.productName,
    required this.unit,
    required this.unitPriceVat0,
    required this.quantity,
    required this.lineTotalVat0,
  });

  final String id;
  final String? productId;
  final String productName;
  final String unit;
  final double unitPriceVat0;
  final double quantity;
  final double lineTotalVat0;
}

class CalculationRecord {
  const CalculationRecord({
    required this.id,
    required this.projectName,
    this.customer,
    required this.groupDurationHours,
    required this.crewSize,
    required this.hourlyRate,
    required this.marginPercent,
    required this.commissionPercent,
    required this.contractPriceVat0,
    required this.materialsVat0,
    required this.marginEur,
    required this.commissionEur,
    required this.totalPriceVat0,
    required this.vatAmount,
    required this.totalPriceVat,
    required this.workDurationDays,
    required this.createdAt,
    this.lines = const [],
  });

  final String id;
  final String projectName;
  final String? customer;
  final double groupDurationHours;
  final int crewSize;
  final double hourlyRate;
  final double marginPercent;
  final double commissionPercent;
  final double contractPriceVat0;
  final double materialsVat0;
  final double marginEur;
  final double commissionEur;
  final double totalPriceVat0;
  final double vatAmount;
  final double totalPriceVat;
  final double workDurationDays;
  final DateTime createdAt;
  final List<CalculationLine> lines;
}
