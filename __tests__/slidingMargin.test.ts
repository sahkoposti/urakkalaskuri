import { slidingSellingPriceAlv0 } from '@/src/core/calculation/slidingMargin';
import { evaluateFormula } from '@/src/core/form/formula/evaluator';
import { buildSettingsFormulaContext } from '@/src/core/form/settingsFormulaContext';
import { defaultSettings } from '@/src/core/models/types';

const jsonParams = {
  lowAmount: 2000,
  lowPercent: 45,
  highAmount: 10000,
  highPercent: 30,
  commissionPercent: 7,
};

describe('slidingSellingPriceAlv0', () => {
  test('uses low kate at and below the small-job threshold', () => {
    const share = 1 - 0.45 - 0.07;
    const costs = 2000 * share;
    const price = slidingSellingPriceAlv0(costs, jsonParams);
    expect(price).toBeCloseTo(2000, 6);
    expect((price - costs - price * 0.07) / price).toBeCloseTo(0.45, 6);
  });

  test('uses high kate at and above the large-job threshold', () => {
    const share = 1 - 0.3 - 0.07;
    const costs = 10000 * share;
    const price = slidingSellingPriceAlv0(costs, jsonParams);
    expect(price).toBeCloseTo(10000, 6);
    expect((price - costs - price * 0.07) / price).toBeCloseTo(0.3, 6);
  });

  test('slides kate linearly against selling price in the middle', () => {
    const price = slidingSellingPriceAlv0(3000, jsonParams);
    expect(price).toBeGreaterThan(2000);
    expect(price).toBeLessThan(10000);
    const kate = (price - 3000 - price * 0.07) / price;
    const expectedKate = 0.45 + (0.3 - 0.45) * (price - 2000) / (10000 - 2000);
    expect(kate).toBeCloseTo(expectedKate, 6);
    expect(3000 + price * kate + price * 0.07).toBeCloseTo(price, 6);
  });

  test('matches the JSON sqrt branch when kate is 50%→30% without commission', () => {
    const costs = 4000;
    const price = slidingSellingPriceAlv0(costs, {
      lowAmount: 2000,
      lowPercent: 50,
      highAmount: 10000,
      highPercent: 30,
      commissionPercent: 0,
    });
    const jsonPrice = 20000 * (Math.sqrt(0.45 * 0.45 + costs / 10000) - 0.45);
    expect(price).toBeCloseTo(jsonPrice, 6);
  });
});

describe('liukuva_myyntihinta()', () => {
  test('reads sliding kate from settings context', () => {
    const context = {
      ...buildSettingsFormulaContext(defaultSettings),
    };
    const share = 1 - defaultSettings.marginLowPercent / 100 - defaultSettings.defaultCommissionPercent / 100;
    const costs = defaultSettings.marginLowAmount * share;
    expect(evaluateFormula('liukuva_myyntihinta(suorat)', { ...context, suorat: costs })).toBeCloseTo(
      defaultSettings.marginLowAmount,
      6,
    );
  });
});
