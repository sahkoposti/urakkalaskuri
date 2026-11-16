import { mergedMaterialsForLines } from '../src/core/materials/mergeMaterialRows';
import { defaultSettings, emptyCustomerInfo } from '../src/core/models/types';
import { offerMaterialsVatIncluded } from '../src/core/pdf/buildPdfContext';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { cardHeaderPrices } from '../src/core/pdf/urakkakorttiCard';
import { aggregateStructureLines, lineTotalVat0, withDerivedLinePricing } from '../src/core/structure/linePricing';
import { scaleWorkDuration } from '../src/core/structure/lineQuantityScale';
import { emptyStructureLine } from '../src/core/structure/types';
import { resolveDisplayedWorkDurationDays } from '../src/core/structure/workDurationDisplay';
import { buildCalculationRecordFromComposer } from '../src/core/wizard/buildCalculationRecord';

import { input, structure } from './pdfFixtures';

const paint = structure('s1', 'Ikkuna');

function exampleLine(quantity = 2) {
  return {
    ...emptyStructureLine({ id: 'l1', structure: paint, vatPercent: 25.5 }),
    name: 'Ikkuna',
    quantity,
    unitPriceVat0: 1000,
    contractPriceVat0: 600,
    materialsVat0: 100,
    commissionPercent: 0,
    discountPercent: 0,
    workDurationDays: 6 / defaultSettings.workdayHours,
    materialQuantities: [{ id: 'm1', productName: 'Maali', quantity: 10, unit: 'l', source: 'manual' as const }],
  };
}

function savedRecord(lines: ReturnType<typeof exampleLine>[]) {
  return buildCalculationRecordFromComposer({
    id: 'c-qty',
    customer: { ...emptyCustomerInfo(), name: 'Fiktiivinen Asiakas' },
    structureLines: lines,
    settings: defaultSettings,
    products: [],
    structures: [paint],
    createdAt: new Date('2026-11-16T08:00:00Z'),
  });
}

describe('määrä kertoo urakan, materiaalit, tunnit ja KTV:n', () => {
  test('määrä 2: myynti 2000, urakka 1200, materiaalit 200, KTV 251, kortti 1 200,00 €', () => {
    const line = exampleLine(2);
    const priced = withDerivedLinePricing(line);
    expect(lineTotalVat0(priced)).toBe(2000);
    expect(priced.contractPriceVat0).toBe(600);
    expect(priced.materialsVat0).toBe(100);
    expect(priced.marginEur).toBe(600);
    expect(priced.marginPercent).toBe(30);

    const totals = aggregateStructureLines(
      [line, { ...exampleLine(0), id: 'zero', contractPriceVat0: 999, materialsVat0: 999, unitPriceVat0: 999 }],
      25.5,
      false,
    );
    expect(totals.totalPriceVat0).toBe(2000);
    expect(totals.contractPriceVat0).toBe(1200);
    expect(totals.materialsVat0).toBe(200);
    expect(totals.marginEur).toBe(600);

    const record = savedRecord([line]);
    expect(record.totalPriceVat0).toBe(2000);
    expect(record.contractPriceVat0).toBe(1200);
    expect(record.materialsVat0).toBe(200);
    expect(record.marginEur).toBe(600);
    expect(record.structureLines?.[0].contractPriceVat0).toBe(600);
    expect(record.structureLines?.[0].materialsVat0).toBe(100);
    expect(offerMaterialsVatIncluded(record)).toBe(251);

    expect(cardHeaderPrices(record, 1.5)).toEqual({ alihankkija: 1200, tyontekija: 800 });
    const ctx = buildUrakkakorttiContext({ ...input(record), sivukulukerroin: 1.5 });
    expect(ctx.contractSum?.replace(/\s/g, ' ')).toBe('1 200,00 €');
    expect(ctx.employeeSum?.replace(/\s/g, ' ')).toBe('800,00 €');

    const materials = mergedMaterialsForLines([{ line }], []);
    expect(materials.map((row) => ({ name: row.productName, quantity: row.quantity }))).toEqual([
      { name: 'Maali', quantity: 20 },
    ]);
  });

  test('3 × 6 h on 18 h ja päivät tulevat työpäivän pituudesta', () => {
    const workdayHours = defaultSettings.workdayHours;
    expect(workdayHours).toBe(8);
    const atEight = scaleWorkDuration(6 / workdayHours, 3, workdayHours);
    expect(atEight.hours).toBeCloseTo(18, 10);
    expect(atEight.days).toBeCloseTo(18 / workdayHours, 10);
    expect(atEight.days).toBeCloseTo(2.25, 10);

    const atTen = scaleWorkDuration(6 / 10, 3, 10);
    expect(atTen.hours).toBeCloseTo(18, 10);
    expect(atTen.days).toBeCloseTo(1.8, 10);

    expect(scaleWorkDuration(0.75, 3, 0)).toEqual({ hours: 0, days: 0.75 });

    expect(
      resolveDisplayedWorkDurationDays(
        { workDurationDays: 6 / workdayHours, quantity: 3, overrides: [] },
        1,
        workdayHours,
      ),
    ).toBe(3);
    expect(
      resolveDisplayedWorkDurationDays(
        {
          workDurationDays: 6 / workdayHours,
          quantity: 3,
          displayWorkDurationDays: 4,
          overrides: ['workDurationDisplay'],
        },
        1,
        workdayHours,
      ),
    ).toBe(4);
  });
});
