class CalculationInput {
  const CalculationInput({
    required this.groupDurationHours,
    required this.crewSize,
    required this.hourlyRate,
    required this.materialsVat0,
    required this.marginPercent,
    required this.commissionPercent,
    required this.vatPercent,
    required this.workdayHours,
  });

  final double groupDurationHours;
  final int crewSize;
  final double hourlyRate;
  final double materialsVat0;
  final double marginPercent;
  final double commissionPercent;
  final double vatPercent;
  final double workdayHours;
}

class CalculationResult {
  const CalculationResult({
    required this.contractPriceVat0,
    required this.materialsVat0,
    required this.marginEur,
    required this.commissionEur,
    required this.totalPriceVat0,
    required this.vatAmount,
    required this.totalPriceVat,
    required this.materialsVat,
    required this.workDurationDays,
  });

  final double contractPriceVat0;
  final double materialsVat0;
  final double marginEur;
  final double commissionEur;
  final double totalPriceVat0;
  final double vatAmount;
  final double totalPriceVat;
  final double materialsVat;
  final double workDurationDays;
}

class CalculationValidationException implements Exception {
  CalculationValidationException(this.message);
  final String message;

  @override
  String toString() => message;
}

CalculationResult runCalculation(CalculationInput input) {
  if (input.groupDurationHours <= 0) {
    throw CalculationValidationException('Työryhmän keston on oltava suurempi kuin 0.');
  }
  if (input.crewSize <= 0) {
    throw CalculationValidationException('Työryhmän koon on oltava vähintään 1.');
  }
  if (input.hourlyRate <= 0) {
    throw CalculationValidationException('Tuntihinnan on oltava suurempi kuin 0.');
  }
  if (input.workdayHours <= 0) {
    throw CalculationValidationException('Työpäivän pituuden on oltava suurempi kuin 0.');
  }

  final margin = input.marginPercent / 100;
  final commission = input.commissionPercent / 100;
  if (margin + commission >= 1) {
    throw CalculationValidationException(
      'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.',
    );
  }

  final contractPrice = input.groupDurationHours * input.crewSize * input.hourlyRate;
  final materials = input.materialsVat0;
  final totalPriceVat0 = (contractPrice + materials) / (1 - margin - commission);
  final marginEur = totalPriceVat0 * margin;
  final commissionEur = totalPriceVat0 * commission;
  final vatRate = input.vatPercent / 100;
  final vatAmount = totalPriceVat0 * vatRate;
  final totalPriceVat = totalPriceVat0 + vatAmount;
  final materialsVat = materials * (1 + vatRate);
  final workDurationDays = input.groupDurationHours / input.workdayHours;

  return CalculationResult(
    contractPriceVat0: contractPrice,
    materialsVat0: materials,
    marginEur: marginEur,
    commissionEur: commissionEur,
    totalPriceVat0: totalPriceVat0,
    vatAmount: vatAmount,
    totalPriceVat: totalPriceVat,
    materialsVat: materialsVat,
    workDurationDays: workDurationDays,
  );
}
