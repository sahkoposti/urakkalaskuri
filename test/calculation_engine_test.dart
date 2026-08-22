import 'package:flutter_test/flutter_test.dart';
import 'package:urakkalaskuri/core/calculation/calculation_engine.dart';

void main() {
  test('example from v1 plan', () {
    final result = runCalculation(
      const CalculationInput(
        groupDurationHours: 40,
        crewSize: 2,
        hourlyRate: 30,
        materialsVat0: 250,
        marginPercent: 35,
        commissionPercent: 7,
        vatPercent: 25.5,
        workdayHours: 8,
      ),
    );

    expect(result.contractPriceVat0, closeTo(2400, 0.01));
    expect(result.totalPriceVat0, closeTo(4568.97, 0.01));
    expect(result.marginEur, closeTo(1599.14, 0.01));
    expect(result.commissionEur, closeTo(319.83, 0.01));
    expect(result.workDurationDays, closeTo(5, 0.01));
  });

  test('rejects margin + commission >= 100%', () {
    expect(
      () => runCalculation(
        const CalculationInput(
          groupDurationHours: 10,
          crewSize: 2,
          hourlyRate: 30,
          materialsVat0: 0,
          marginPercent: 60,
          commissionPercent: 40,
          vatPercent: 25.5,
          workdayHours: 8,
        ),
      ),
      throwsA(isA<CalculationValidationException>()),
    );
  });
}
