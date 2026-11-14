import { tarjousDocumentTotal, urakkakorttiDocumentTotal } from '../src/core/documents/documentInputs';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import {
  calculationWithUrakkakorttiMode,
  calculationWithUrakkakorttiRivihinnat,
  cardHeaderPrices,
  readUrakkakorttiMode,
} from '../src/core/pdf/urakkakorttiCard';
import { printSivukulukerroin } from '../src/core/pdf/defaultOfferSettings';
import { input, line, record } from './pdfFixtures';

function cardHtml(rec: ReturnType<typeof record>, factor?: number) {
  const base = input(rec);
  return renderUrakkakorttiHtml(
    buildUrakkakorttiContext({
      record: rec,
      company: base.company,
      structures: base.structures,
      products: base.products,
      settings: base.settings,
      generatedAt: new Date(2026, 9, 10),
      sivukulukerroin: factor,
    }),
  );
}

describe('card header prices', () => {
  const priced = record({}, {
    structureLines: [{ ...line('l1', 's1', 'Julkisivu'), contractPriceVat0: 342.39 }],
  });

  it('prints 342,39 and 228,26 once each', () => {
    expect(printSivukulukerroin(1.5)).toBe(1.5);
    expect(cardHeaderPrices(priced, 1.5)).toEqual({ alihankkija: 342.39, tyontekija: 228.26 });
    const html = cardHtml(priced, 1.5);
    expect(html).toContain('Urakkasumma alihankkija');
    expect(html).toContain('Urakkasumma työntekijä');
    expect(html).toContain('342,39');
    expect(html).toContain('228,26');
    expect(html.split('Urakkasumma alihankkija')).toHaveLength(2);
    expect(html.split('Urakkasumma työntekijä')).toHaveLength(2);
    expect(html).not.toContain('Urakka (alv0)');
    expect(html).not.toContain('Urakan summa');
    expect(urakkakorttiDocumentTotal(priced, 1.5)).toBe(342.39);
  });

  it('keeps a per-line override and falls back to 1,5 when the factor is invalid', () => {
    const overridden = calculationWithUrakkakorttiRivihinnat(priced, { l1: 300 });
    expect(cardHeaderPrices(overridden, 1.5)).toEqual({ alihankkija: 300, tyontekija: 200 });
    expect(cardHeaderPrices(priced, 3).tyontekija).toBe(114.13);
    for (const factor of [1, 0.5, 3.01, Number.NaN, undefined]) {
      expect(printSivukulukerroin(factor)).toBe(1.5);
      expect(cardHeaderPrices(priced, factor)).toEqual({ alihankkija: 342.39, tyontekija: 228.26 });
    }
    const html = cardHtml(priced, 0.5);
    expect(html).toContain('Urakkasumma työntekijä');
    expect(html).toContain('228,26');
    expect(urakkakorttiDocumentTotal(calculationWithUrakkakorttiMode(priced, 'tyontekija'), 1.5)).toBe(342.39);
  });

  it('loads legacy mode keys without using them for the new totals', () => {
    for (const mode of ['tyontekija', 'alihankkija'] as const) {
      const legacy = calculationWithUrakkakorttiMode(priced, mode);
      expect(readUrakkakorttiMode(legacy.formSnapshot)).toBe(mode);
      expect(cardHeaderPrices(legacy, 1.5).alihankkija).toBe(342.39);
      expect(cardHtml(legacy, 1.5)).toContain('Urakkakortti');
      expect(cardHtml(legacy, 1.5)).not.toContain('Urakkakortti: Työntekijä');
    }
    const unknown = {
      ...priced,
      formSnapshot: { formId: 'f', formVersion: 1, fields: [], urakkakorttiMode: 'vanha' as never },
    };
    expect(readUrakkakorttiMode(unknown.formSnapshot)).toBe('alihankkija');
    expect(cardHeaderPrices(unknown, 1.5).alihankkija).toBe(342.39);
  });

  it('leaves a zero-quantity line out of the header and the document total', () => {
    const lines = [
      { ...line('a', 's1', 'Seinä'), contractPriceVat0: 4200 },
      { ...line('b', 's2', 'Sokkeli'), contractPriceVat0: 1500 },
      { ...line('z', 's3', 'Piilo'), quantity: 0, contractPriceVat0: 999 },
    ];
    const rec = record({}, { structureLines: lines });
    expect(cardHeaderPrices(rec, 1.5)).toEqual({ alihankkija: 5700, tyontekija: 3800 });
    expect(urakkakorttiDocumentTotal(rec, 1.5)).toBe(5700);
    expect(cardHeaderPrices(calculationWithUrakkakorttiRivihinnat(rec, { z: 5000 }), 1.5).alihankkija).toBe(5700);
    const html = cardHtml(rec, 1.5).replace(/\s/g, ' ');
    expect(html).toContain('5 700,00');
    expect(html).not.toContain('999');
    expect(html).not.toContain('Piilo');

    const allNonZero = record({}, {
      structureLines: lines.map((item) => (item.id === 'z' ? { ...item, quantity: 1 } : item)),
    });
    expect(cardHeaderPrices(allNonZero, 1.5)).toEqual({ alihankkija: 6699, tyontekija: 4466 });
    expect(urakkakorttiDocumentTotal(allNonZero, 1.5)).toBe(6699);

    const allZero = record({}, { structureLines: lines.map((item) => ({ ...item, quantity: 0 })) });
    expect(cardHeaderPrices(allZero, 1.5)).toEqual({ alihankkija: 0, tyontekija: 0 });
    expect(urakkakorttiDocumentTotal(allZero, 1.5)).toBe(0);
    expect(() => cardHtml(allZero, 1.5)).not.toThrow();
    expect(cardHeaderPrices(record({}, {
      structureLines: [{ ...line('z', 's1', 'Miinusnolla'), quantity: -0, contractPriceVat0: 999 }],
    }), 1.5)).toEqual({ alihankkija: 0, tyontekija: 0 });

    const kept = lines.filter((item) => item.id !== 'z');
    const offerWith = buildPdfContext(input(rec)).price;
    const offerWithout = buildPdfContext(input(record({}, { structureLines: kept }))).price;
    expect(offerWith).toEqual(offerWithout);
    expect(tarjousDocumentTotal(rec)).toBe(tarjousDocumentTotal(record({}, { structureLines: kept })));
  });

  it('treats one remaining non-zero line as a single-line card', () => {
    const rec = record({}, {
      structureLines: [
        { ...line('a', 's1', 'Seinä'), contractPriceVat0: 4200, workDurationDays: 7 },
        { ...line('z', 's3', 'Piilo'), quantity: 0, contractPriceVat0: 999, workDurationDays: 1 },
      ],
      workDurationDays: 3,
    });
    const ctx = buildUrakkakorttiContext({ ...input(rec), sivukulukerroin: 1.5 });
    expect(ctx.contractRows).toEqual([]);
    expect(ctx.contractSum?.replace(/\s/g, ' ')).toBe('4 200,00 €');
    expect(ctx.infoRows).toContainEqual({ label: 'Työn arvioitu kesto', value: '10 pv' });
  });
});
