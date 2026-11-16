import { tarjousDocumentTotal, urakkakorttiDocumentTotal } from '../src/core/documents/documentInputs';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { linesNeedingManualContract } from '../src/core/pdf/manualContract';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import {
  cardHeaderPrices,
  cardLinesNeedingManualContract,
} from '../src/core/pdf/urakkakorttiCard';
import { formatCurrency } from '../src/core/utils/formatters';
import { input, line, record } from './pdfFixtures';

/**
 * Riippumaton audit Finding 2: määrä 0 -rakenne ei saa näkyä urakkakortilla
 * (otsikko, rivierittely, käsihinta-kysely, materiaalitaulukko, Dokumentit-suma).
 */
describe('määrä 0 pois urakkakortilta (Finding 2)', () => {
  function lines(sokkeliUrakka: number) {
    return [
      {
        ...line('a', 's1', 'Seinä'),
        contractPriceVat0: 500,
        unitPriceVat0: 755,
        materialsVat0: 0,
        materialQuantities: [],
      },
      {
        ...line('b', 's2', 'Sokkeli'),
        quantity: 0,
        contractPriceVat0: sokkeliUrakka,
        unitPriceVat0: 500,
        materialsVat0: 0,
        materialQuantities: [
          { id: 'sk', productName: 'Sokkelimaali', quantity: 4, unit: 'l', source: 'manual' as const },
        ],
      },
    ];
  }

  test('seinä 500 € + määrä 0 Sokkeli: vain 500 €, ei Sokkeli-riviä, ei Sokkelimaalia, ei kyselyä', () => {
    const base = record({}, { structureLines: lines(400) });
    const offerOnlyA = record({}, { structureLines: [lines(400)[0]] });

    expect(cardHeaderPrices(base, 1.5)).toEqual({ alihankkija: 500, tyontekija: 333.33 });
    expect(urakkakorttiDocumentTotal(base, 1.5)).toBe(500);
    expect(linesNeedingManualContract(base).map((item) => item.id)).toEqual([]);
    expect(cardLinesNeedingManualContract(base).map((item) => item.id)).toEqual([]);

    const ctx = buildUrakkakorttiContext({ ...input(base), sivukulukerroin: 1.5 });
    expect(ctx.contractSum).toBe(formatCurrency(500));
    expect(ctx.contractRows.map((row) => row.label)).not.toContain('Urakka: Sokkeli');
    expect(ctx.contractRows).toEqual([]);
    expect(ctx.materials.map((row) => row.product)).not.toContain('Sokkelimaali');

    expect(tarjousDocumentTotal(base)).toBe(tarjousDocumentTotal(offerOnlyA));
    expect(buildPdfContext(input(base)).price).toEqual(buildPdfContext(input(offerOnlyA)).price);

    const missingUrakka = record({}, { structureLines: lines(0) });
    expect(linesNeedingManualContract(missingUrakka).map((item) => item.id)).toEqual([]);
    expect(cardLinesNeedingManualContract(missingUrakka).map((item) => item.id)).toEqual([]);
    expect(cardHeaderPrices(missingUrakka, 1.5).alihankkija).toBe(500);
    expect(buildUrakkakorttiContext({ ...input(missingUrakka), sivukulukerroin: 1.5 }).contractSum).toBe(
      formatCurrency(500),
    );
  });
});