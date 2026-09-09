import {
  aggregateStructureLines,
  fromCardAmount,
  lineTotalVat0,
  toCardAmount,
  withDerivedLinePricing,
} from '../src/core/structure/linePricing';
import type { StructureLine } from '../src/core/structure/types';

function line(partial: Partial<StructureLine> = {}): StructureLine {
  return {
    id: 'l1',
    structureId: 's1',
    name: 'Ulkoverhoilun maalaus',
    quantity: 1,
    unitPriceVat0: 3393.52,
    materialsVat0: 365,
    discountPercent: 5,
    vatPercent: 25.5,
    contractPriceVat0: 0,
    workDurationDays: 0,
    commissionPercent: 7,
    commissionEur: 0,
    marginEur: 0,
    marginPercent: 0,
    fieldValues: {},
    formFilled: false,
    overrides: [],
    ...partial,
  };
}

describe('linePricing', () => {
  test('yhteensä = hinta × määrä × (1 − ale)', () => {
    expect(lineTotalVat0(line({ quantity: 1, unitPriceVat0: 100, discountPercent: 5 }))).toBe(95);
    expect(lineTotalVat0(line({ quantity: 2, unitPriceVat0: 100, discountPercent: 0 }))).toBe(200);
  });

  test('kate ilman urakkaa = myynti − materiaalit − palkkio', () => {
    const priced = withDerivedLinePricing(
      line({ unitPriceVat0: 1000, quantity: 1, discountPercent: 0, materialsVat0: 200, commissionPercent: 10 }),
    );
    expect(priced.commissionEur).toBe(100);
    expect(priced.marginEur).toBe(700);
    expect(priced.marginPercent).toBe(70);
  });

  test('aggregaatti summaa rivit ja laskee ALV:n', () => {
    const totals = aggregateStructureLines(
      [
        line({ id: 'a', unitPriceVat0: 100, discountPercent: 0, materialsVat0: 10, commissionPercent: 0 }),
        line({ id: 'b', unitPriceVat0: 50, discountPercent: 0, materialsVat0: 5, commissionPercent: 0 }),
      ],
      25.5,
      false,
    );
    expect(totals.totalPriceVat0).toBe(150);
    expect(totals.materialsVat0).toBe(15);
    expect(totals.vatAmount).toBeCloseTo(150 * 0.255, 10);
  });

  test('käänteinen ALV: ei ALV-euroja', () => {
    const totals = aggregateStructureLines([line({ discountPercent: 0, commissionPercent: 0 })], 25.5, true);
    expect(totals.vatAmount).toBe(0);
    expect(totals.totalPriceVat).toBe(totals.totalPriceVat0);
  });

  test('kortin ALV-valinta muuntaa hinnan näytön ja syötteen välillä', () => {
    expect(toCardAmount(100, false, 25.5)).toBe(100);
    expect(toCardAmount(100, true, 25.5)).toBe(125.5);
    expect(fromCardAmount(125.5, true, 25.5)).toBe(100);
    expect(fromCardAmount(100, false, 25.5)).toBe(100);
  });
});
