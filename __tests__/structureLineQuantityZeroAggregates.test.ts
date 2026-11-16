import { defaultSettings, emptyCustomerInfo } from '../src/core/models/types';
import { offerMaterialsVatIncluded } from '../src/core/pdf/buildPdfContext';
import {
  aggregateStructureLines,
  lineTotalVat0,
  withDerivedLinePricing,
} from '../src/core/structure/linePricing';
import { emptyStructureLine } from '../src/core/structure/types';
import { buildCalculationRecordFromComposer } from '../src/core/wizard/buildCalculationRecord';

import { structure } from './pdfFixtures';

/**
 * Riippumaton audit Finding 3: määrä 0 ei saa kerryttää urakkaa, materiaaleja,
 * katea tai KTV:tä — rivi säilyy tallenteessa.
 */
describe('määrä 0 pois laskelman yhteissummista (Finding 3)', () => {
  const paint = structure('s1', 'Seinä');
  const base = structure('s2', 'Sokkeli');

  function pricedLine() {
    return {
      ...emptyStructureLine({ id: 'priced', structure: paint, vatPercent: 25.5 }),
      name: 'Seinä',
      quantity: 1,
      unitPriceVat0: 1000,
      contractPriceVat0: 500,
      materialsVat0: 100,
      commissionPercent: 5,
      discountPercent: 0,
    };
  }

  function zeroLine() {
    return {
      ...emptyStructureLine({ id: 'zero', structure: base, vatPercent: 25.5 }),
      name: 'Sokkeli',
      quantity: 0,
      unitPriceVat0: 0,
      contractPriceVat0: 400,
      materialsVat0: 300,
      commissionPercent: 0,
      discountPercent: 0,
    };
  }

  test('myynti 1000 + määrä 0 (urakka 400, materiaalit 300): vain yhden rivin kulut ja KTV 125,50 €', () => {
    const lines = [pricedLine(), zeroLine()];
    const priced = withDerivedLinePricing(pricedLine());
    expect(lineTotalVat0(priced)).toBe(1000);
    expect(withDerivedLinePricing(zeroLine()).marginEur).toBe(0);

    const totals = aggregateStructureLines(lines, 25.5, false);
    expect(totals.totalPriceVat0).toBe(1000);
    expect(totals.contractPriceVat0).toBe(500);
    expect(totals.materialsVat0).toBe(100);
    expect(totals.marginEur).toBeCloseTo(350, 2);
    expect(totals.marginPercent).toBeCloseTo(35, 2);

    const record = buildCalculationRecordFromComposer({
      id: 'c-f3',
      customer: { ...emptyCustomerInfo(), name: 'Fiktiivinen Asiakas' },
      structureLines: lines,
      settings: defaultSettings,
      products: [],
      structures: [paint, base],
      createdAt: new Date('2026-11-16T09:00:00Z'),
    });

    expect(record.structureLines).toHaveLength(2);
    expect(record.structureLines?.map((line) => line.id)).toEqual(['priced', 'zero']);
    expect(record.totalPriceVat0).toBe(1000);
    expect(record.contractPriceVat0).toBe(500);
    expect(record.materialsVat0).toBe(100);
    expect(record.marginEur).toBeCloseTo(350, 2);
    expect(record.marginPercent).toBeCloseTo(35, 2);

    expect(offerMaterialsVatIncluded(record)).toBe(125.5);

    const offerOnly = buildCalculationRecordFromComposer({
      id: 'c-f3-offer',
      customer: { ...emptyCustomerInfo(), name: 'Fiktiivinen Asiakas' },
      structureLines: [pricedLine()],
      settings: defaultSettings,
      products: [],
      structures: [paint, base],
      createdAt: new Date('2026-11-16T09:00:00Z'),
    });
    expect(record.totalPriceVat).toBe(offerOnly.totalPriceVat);
    expect(record.totalPriceVat0).toBe(offerOnly.totalPriceVat0);
  });
});