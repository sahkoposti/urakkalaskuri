import { applyOwnedVatTotals } from '../src/core/calculation/pricingSkeleton';

describe('applyOwnedVatTotals', () => {
  test('derives ALV and VAT-inclusive total from kokonaishinta_alv0', () => {
    const context: Record<string, number> = { kokonaishinta_alv0: 1000 };
    applyOwnedVatTotals(context, 25.5, false);
    expect(context.alv_maara).toBeCloseTo(255, 5);
    expect(context.kokonaishinta).toBeCloseTo(1255, 5);
  });

  test('reverse VAT zeroes ALV and keeps VAT0 as the selling price', () => {
    const context = { kokonaishinta_alv0: 1000, alv_maara: 99, kokonaishinta: 99 };
    applyOwnedVatTotals(context, 25.5, true);
    expect(context.alv_maara).toBe(0);
    expect(context.kokonaishinta).toBe(1000);
  });

  test('VAT-inclusive override derives kokonaishinta_alv0', () => {
    const context: Record<string, number> = { kokonaishinta: 1255, kokonaishinta_alv0: 10 };
    applyOwnedVatTotals(context, 25.5, false, { sellingPriceVatOverridden: true });
    expect(context.kokonaishinta_alv0).toBeCloseTo(1000, 5);
    expect(context.alv_maara).toBeCloseTo(255, 5);
    expect(context.kokonaishinta).toBe(1255);
  });

  test('VAT-inclusive override with reverse VAT copies the total to VAT0', () => {
    const context: Record<string, number> = { kokonaishinta: 800, kokonaishinta_alv0: 10 };
    applyOwnedVatTotals(context, 25.5, true, { sellingPriceVatOverridden: true });
    expect(context.alv_maara).toBe(0);
    expect(context.kokonaishinta_alv0).toBe(800);
    expect(context.kokonaishinta).toBe(800);
  });
});
