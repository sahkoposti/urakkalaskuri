import { customerFromRecord, defaultSettings, emptyCustomerInfo } from '../src/core/models/types';
import { printedOfferAmounts } from '../src/core/pdf/buildPdfContext';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { emptyStructureLine } from '../src/core/structure/types';
import { buildCalculationRecordFromComposer } from '../src/core/wizard/buildCalculationRecord';

import { input, record, structure } from './pdfFixtures';

describe('Finding 8: per-line VAT in saved record totals', () => {
  const s1 = structure('s1', 'A');
  const s2 = structure('s2', 'B');

  test('25,5 % + 14 % → saved 2395 / 395; single-rate unchanged; legacy duration without structureLines', () => {
    const multi = buildCalculationRecordFromComposer({
      id: 'c-vat',
      customer: { ...emptyCustomerInfo(), name: 'Fiktiivinen' },
      structureLines: [
        { ...emptyStructureLine({ id: 'a', structure: s1, vatPercent: 25.5 }), unitPriceVat0: 1000, quantity: 1 },
        { ...emptyStructureLine({ id: 'b', structure: s2, vatPercent: 14 }), unitPriceVat0: 1000, quantity: 1 },
      ],
      settings: defaultSettings,
      products: [],
      structures: [s1, s2],
      createdAt: new Date('2026-11-16T10:00:00Z'),
    });
    expect(multi.totalPriceVat0).toBe(2000);
    expect(multi.vatAmount).toBe(395);
    expect(multi.totalPriceVat).toBe(2395);
    const customer = customerFromRecord(multi);
    expect(printedOfferAmounts(multi, customer)).toMatchObject({ gross: 2395, vat: 395, net: 2000, source: 'lines' });

    const singleRate = buildCalculationRecordFromComposer({
      id: 'c-vat1',
      customer: { ...emptyCustomerInfo(), name: 'Fiktiivinen' },
      structureLines: [
        { ...emptyStructureLine({ id: 'a', structure: s1, vatPercent: 25.5 }), unitPriceVat0: 1000, quantity: 1 },
        { ...emptyStructureLine({ id: 'b', structure: s2, vatPercent: 25.5 }), unitPriceVat0: 1000, quantity: 1 },
      ],
      settings: defaultSettings,
      products: [],
      structures: [s1, s2],
      createdAt: new Date('2026-11-16T10:00:00Z'),
    });
    expect(singleRate.totalPriceVat).toBe(2510);
    expect(singleRate.vatAmount).toBe(510);

    const legacy = record({}, { structureLines: [], workDurationDays: 5 });
    const ctx = buildUrakkakorttiContext(input(legacy));
    expect(ctx.infoRows).toContainEqual({ label: 'Työn arvioitu kesto', value: '7 pv' });
  });
});