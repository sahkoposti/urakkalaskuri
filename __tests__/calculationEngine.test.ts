import {
  CalculationValidationError,
  runCalculation,
} from '../src/core/calculation/calculationEngine';

describe('runCalculation', () => {
  test('example from v1 plan', () => {
    const result = runCalculation({
      groupDurationHours: 40,
      crewSize: 2,
      hourlyRate: 30,
      materialsVat0: 250,
      marginPercent: 35,
      commissionPercent: 7,
      vatPercent: 25.5,
      workdayHours: 8,
    });

    expect(result.contractPriceVat0).toBeCloseTo(2400, 2);
    expect(result.totalPriceVat0).toBeCloseTo(4568.97, 2);
    expect(result.marginEur).toBeCloseTo(1599.14, 2);
    expect(result.commissionEur).toBeCloseTo(319.83, 2);
    expect(result.workDurationDays).toBeCloseTo(5, 2);
  });

  test('rejects margin + commission >= 100%', () => {
    expect(() =>
      runCalculation({
        groupDurationHours: 10,
        crewSize: 2,
        hourlyRate: 30,
        materialsVat0: 0,
        marginPercent: 60,
        commissionPercent: 40,
        vatPercent: 25.5,
        workdayHours: 8,
      }),
    ).toThrow(CalculationValidationError);
  });

  test('reverse VAT sets vat amount to zero', () => {
    const result = runCalculation({
      groupDurationHours: 40,
      crewSize: 2,
      hourlyRate: 30,
      materialsVat0: 250,
      marginPercent: 35,
      commissionPercent: 7,
      vatPercent: 25.5,
      workdayHours: 8,
      reverseVat: true,
    });

    expect(result.vatAmount).toBe(0);
    expect(result.totalPriceVat).toBeCloseTo(result.totalPriceVat0, 2);
  });
});
