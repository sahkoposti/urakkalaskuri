import { mergeLineMaterials, type MaterialRowSource } from '../src/core/materials/mergeMaterialRows';
import { customerFromRecord } from '../src/core/models/types';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import {
  buildOfferRows,
  buildOfferSections,
  offerVatSummary,
} from '../src/core/pdf/offerDocument';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { aggregateStructureLines } from '../src/core/structure/linePricing';
import { ensureStructureLines } from '../src/core/structure/legacyCalculation';
import { MANUAL_STRUCTURE_ID } from '../src/core/structure/types';

import { input, line, record, structure } from './pdfFixtures';

describe('Finding 10: negative structure määrä excluded like zero', () => {
  const structures = [structure('s1', 'Seinä'), structure('s2', 'Sokkeli')];

  function lines() {
    return [
      {
        ...line('ok', 's1', 'Normaali'),
        quantity: 1,
        unitPriceVat0: 1000,
        contractPriceVat0: 500,
        materialsVat0: 100,
        materialQuantities: [],
      },
      {
        ...line('neg', MANUAL_STRUCTURE_ID, 'Negatiivinen'),
        quantity: -2,
        unitPriceVat0: 999,
        contractPriceVat0: 400,
        materialsVat0: 50,
        materialQuantities: [
          { id: 'm-neg', productName: 'Piilomaali', quantity: 3, unit: 'l', source: 'manual' as const },
        ],
      },
    ];
  }

  test('offer: no −2 heading row; rows/VAT like single priced line', () => {
    const rec = record({}, {
      structureLines: lines(),
      totalPriceVat0: 1000,
      vatAmount: 255,
      totalPriceVat: 1255,
      vatPercent: 25.5,
    });
    const customer = customerFromRecord(rec);
    const source = input(rec, { structures, products: [] });

    const sections = buildOfferSections(source);
    expect(sections.map((section) => section.heading?.quantity)).not.toContain('-2');
    expect(sections.map((section) => section.heading?.quantityLabel).join('\n')).not.toMatch(/−2|(^|[^\d])-2/);
    expect(buildOfferRows(source).map((row) => row.quantity)).not.toContain('-2');

    expect(offerVatSummary(rec, customer)).toEqual([
      { vatPercent: 25.5, net: 1000, vat: 255, gross: 1255 },
    ]);

    const html = renderTarjousHtml(buildPdfContext(source));
    expect(html).not.toMatch(/−2|class="offer-heading"[^>]*>[^<]*-2/);
    expect(html).not.toContain('Piilomaali');
  });

  test('urakkakortti, totals, merged materials: negative line excluded', () => {
    const rec = record({}, { structureLines: lines() });
    const totals = aggregateStructureLines(ensureStructureLines(rec), 25.5, false);
    expect(totals.totalPriceVat0).toBe(1000);
    expect(totals.contractPriceVat0).toBe(500);
    expect(totals.materialsVat0).toBe(100);

    const ctx = buildUrakkakorttiContext({ ...input(rec), structures, products: [] });
    expect(ctx.contractRows.map((row) => row.label)).not.toContain('Urakka: Negatiivinen');
    expect(ctx.materials.map((row) => row.product)).not.toContain('Piilomaali');

    const sources: MaterialRowSource[] = [
      {
        lineId: 'neg',
        lineName: 'Negatiivinen',
        lineQuantity: -2,
        row: {
          id: 'm-neg',
          productName: 'Piilomaali',
          quantity: 3,
          unit: 'l',
          source: 'manual',
        },
      },
    ];
    expect(mergeLineMaterials(sources)).toEqual([]);
  });
});