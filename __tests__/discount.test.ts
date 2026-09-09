import { applyDiscountToResult, clampDiscountPercent } from '../src/core/calculation/discount';
import {
  runFormCalculation,
} from '../src/core/calculation/calculationPipeline';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { defaultSettings } from '../src/core/models/types';

function defaultForm() {
  return normalizeFormDefinition(createMinimalFormDefinition());
}

describe('clampDiscountPercent', () => {
  test('clamps to 0–100', () => {
    expect(clampDiscountPercent(-5)).toBe(0);
    expect(clampDiscountPercent(0)).toBe(0);
    expect(clampDiscountPercent(5.5)).toBe(5.5);
    expect(clampDiscountPercent(100)).toBe(100);
    expect(clampDiscountPercent(150)).toBe(100);
    expect(clampDiscountPercent(Number.NaN)).toBe(0);
  });
});

describe('applyDiscountToResult', () => {
  const list = {
    contractPriceVat0: 2400,
    materialsVat0: 250,
    marginEur: 1599.14,
    commissionEur: 319.83,
    totalPriceVat0: 3640.61,
    vatAmount: 928.36,
    totalPriceVat: 4568.97,
    workDurationDays: 5,
    discountPercent: 0,
    discountEur: 0,
    totalPriceVatBeforeDiscount: 4568.97,
    totalPriceVat0BeforeDiscount: 3640.61,
  };

  test('does nothing at 0 %', () => {
    const next = applyDiscountToResult(list, 0, false);
    expect(next.totalPriceVat).toBeCloseTo(list.totalPriceVat, 2);
    expect(next.marginEur).toBeCloseTo(list.marginEur, 2);
    expect(next.discountPercent).toBe(0);
  });

  test('reduces totals and realized margin', () => {
    const next = applyDiscountToResult(list, 10, false);
    expect(next.discountPercent).toBe(10);
    expect(next.totalPriceVat).toBeCloseTo(list.totalPriceVat * 0.9, 2);
    expect(next.commissionEur).toBeCloseTo(list.commissionEur * 0.9, 2);
    expect(next.marginEur).toBeCloseTo(
      next.totalPriceVat - list.contractPriceVat0 - list.materialsVat0 - next.commissionEur,
      2,
    );
    expect(next.marginEur).toBeLessThan(list.marginEur);
    expect(next.discountEur).toBeCloseTo(list.totalPriceVat - next.totalPriceVat, 2);
  });

  test('100 % zeroes the selling price', () => {
    const next = applyDiscountToResult(list, 100, false);
    expect(next.totalPriceVat).toBe(0);
    expect(next.commissionEur).toBe(0);
    expect(next.marginEur).toBeCloseTo(-(list.contractPriceVat0 + list.materialsVat0), 2);
  });
});

describe('runFormCalculation discount', () => {
  const fieldValues = {
    kiintea_seinapinta_ala_m2: '120',
    aukkovahennykset: '18',
    laudoitustyyppi: '1.15',
    tyoryhma_kesto_pv: '5',
  };

  test('default 0 % matches previous totals', () => {
    const { result } = runFormCalculation({
      form: defaultForm(),
      fieldValues,
      materialLines: [],
      products: [],
      settings: defaultSettings,
    });
    expect(result.discountPercent).toBe(0);
    expect(result.totalPriceVat).toBeCloseTo(result.totalPriceVatBeforeDiscount, 5);
  });

  test('applies percent to totals and kate', () => {
    const form = defaultForm();
    const { result: list } = runFormCalculation({
      form,
      fieldValues: { ...fieldValues, alennus_prosentti: '0' },
      materialLines: [],
      products: [],
      settings: defaultSettings,
    });
    const { result } = runFormCalculation({
      form,
      fieldValues: { ...fieldValues, alennus_prosentti: '10' },
      materialLines: [],
      products: [],
      settings: defaultSettings,
    });

    expect(result.discountPercent).toBe(10);
    expect(result.totalPriceVat).toBeCloseTo(list.totalPriceVat * 0.9, 2);
    expect(result.marginEur).toBeLessThan(list.marginEur);
    const selling =
      result.contractPriceVat0 + result.materialsVat0 + result.marginEur + result.commissionEur;
    expect(selling).toBeCloseTo(result.totalPriceVat, 2);
  });

  test('clamps 150 % to 100 %', () => {
    const { result } = runFormCalculation({
      form: defaultForm(),
      fieldValues: { ...fieldValues, alennus_prosentti: '150' },
      materialLines: [],
      products: [],
      settings: defaultSettings,
    });
    expect(result.discountPercent).toBe(100);
    expect(result.totalPriceVat).toBe(0);
  });
});
