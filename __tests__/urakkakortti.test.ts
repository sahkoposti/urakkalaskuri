import { buildFormSnapshot } from '../src/core/form/formSummaryHelpers';
import {
  effectiveContractVat0,
  linesNeedingManualContract,
  parseManualContractInputs,
  withManualContractPrices,
} from '../src/core/pdf/manualContract';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext, type BuildUrakkakorttiInput } from '../src/core/pdf/urakkakortti';
import { withDerivedLinePricing } from '../src/core/structure/linePricing';
import { form, input, line, record } from './pdfFixtures';
import type { CalculationRecord } from '../src/core/models/types';

function ukInput(rec: CalculationRecord): BuildUrakkakorttiInput {
  const base = input(rec);
  return {
    record: rec,
    company: base.company,
    structures: base.structures,
    products: base.products,
    settings: base.settings,
    generatedAt: new Date(2026, 9, 10),
  };
}

const bodyOf = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');

describe('manual contract price', () => {
  it('uses the form contract first, then the manual sum', () => {
    expect(effectiveContractVat0({ contractPriceVat0: 1000, manualContractPriceVat0: 5 })).toBe(1000);
    expect(effectiveContractVat0({ contractPriceVat0: 0, manualContractPriceVat0: 800 })).toBe(800);
    expect(effectiveContractVat0({ contractPriceVat0: 0 })).toBe(0);
  });

  it('lists lines that need a manual sum and applies valid values only', () => {
    const lines = [{ ...line('a', 's1', 'A'), contractPriceVat0: 0, formFilled: false }, line('b', 's1', 'B')];
    const rec = record({}, { structureLines: lines });
    expect(linesNeedingManualContract(rec).map((l) => l.id)).toEqual(['a']);
    const applied = withManualContractPrices(lines, { a: 1234.567, b: -1 });
    expect(applied[0].manualContractPriceVat0).toBe(1234.57);
    expect(applied[1].manualContractPriceVat0).toBeUndefined();
    expect(linesNeedingManualContract(record({}, { structureLines: applied }))).toEqual([]);
  });

  it('manual sum survives line re-pricing (edit + save keeps it) and does not change the contract', () => {
    const priced = withDerivedLinePricing({ ...line('a', 's1', 'A'), contractPriceVat0: 0, manualContractPriceVat0: 900 });
    expect(priced.manualContractPriceVat0).toBe(900);
    expect(priced.contractPriceVat0).toBe(0);
  });

  it('parses dialog inputs with decimal comma and rejects empty/invalid', () => {
    expect(parseManualContractInputs({ a: '1 200,50' })).toEqual({ ok: true, values: { a: 1200.5 } });
    expect(parseManualContractInputs({ a: '', b: 'x', c: '0', d: '5' })).toEqual({ ok: false, invalidLineIds: ['a', 'b', 'c'] });
  });
});

describe('urakkakortti', () => {
  it('single line: contract, duration, crew, specs, notes area; snapshot', () => {
    const rec = record({ notes: 'Koira pihalla' });
    const ctx = buildUrakkakorttiContext(ukInput(rec));
    expect(ctx.contractRows).toEqual([{ label: 'Tekijöiden urakka (alv0)', value: expect.stringMatching(/1\s000,00\s€/) }]);
    expect(ctx.infoRows.map((r) => r.label)).toEqual(['Työn arvioitu kesto', 'Työryhmän koko']);
    expect(ctx.specGrid.mode).toBe('single');
    const html = renderUrakkakorttiHtml(ctx);
    expect(html).toContain('Urakkakortti');
    expect(html).toContain('Koira pihalla');
    expect(html).toContain('Muistiinpanot:');
    expect(html).toMatchSnapshot();
  });

  it('multi-structure: one card with per-line contract sums and total', () => {
    const lines = [line('a', 's1', 'Ulkomaalaus'), { ...line('b', 's2', 'Sokkeli', '30'), contractPriceVat0: 0, manualContractPriceVat0: 450 }];
    const ctx = buildUrakkakorttiContext(ukInput(record({}, { structureLines: lines })));
    expect(ctx.contractRows.map((r) => r.label)).toEqual([
      'Tekijöiden urakka: Ulkomaalaus',
      'Tekijöiden urakka: Sokkeli',
      'Tekijöiden urakka yhteensä (alv0)',
    ]);
    expect(ctx.contractRows[2].value.replace(/\s/g, ' ')).toBe('1 450,00 €');
    expect(ctx.specGrid.cards.map((c) => c.title)).toEqual(['Ulkomaalaus: Pinta-alat', 'Sokkeli: Pinta-alat']);
  });

  it('all content pages are printed, regardless of the offer page selection; € spec rows dropped', () => {
    const snap = buildFormSnapshot(form, { kiintea_seinapinta_ala_m2: '10' }, { kiintea_seinapinta_ala_m2: 10 });
    snap.fields.push({ key: 'hinta_x', label: 'Josta matka-ajan kustannus (ALV 0)', unit: '€', value: '99,00 €', pageTitle: 'Hinnat' });
    const ctx = buildUrakkakorttiContext(ukInput(record({}, { structureLines: [{ ...line('a', 's1', 'A'), snapshot: snap }] })));
    const html = bodyOf(renderUrakkakorttiHtml(ctx));
    expect(html).toContain('Pinta-alat');
    expect(html).not.toContain('matka-ajan kustannus');
  });

  it('material list: product | quantity | unit, without prices; omitted when no saved lines', () => {
    const rec = record({}, {
      lines: [{ id: 'm1', productName: 'Maali X', unit: 'l', unitPriceVat0: 12.34, quantity: 18.5, lineTotalVat0: 228.29 }],
    });
    const html = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(rec))));
    expect(html).toContain('<td>Maali X</td><td class="value">18,5</td><td>l</td>');
    expect(html).not.toMatch(/12,34|228,29/);
    expect(bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput(record({})))))).not.toContain('Materiaalit');
  });

  it('forbidden strings: no customer price, VAT, margin, commission, KHV, validity or offer number', () => {
    const rec = record({ notes: 'Huom' }, {
      offerNumber: 10285,
      discountPercent: 10,
      lines: [{ id: 'm1', productName: 'Maali', unit: 'l', unitPriceVat0: 12.34, quantity: 2, lineTotalVat0: 24.68 }],
    });
    for (const customer of [{}, { customerType: 'business' as const, reverseVat: true }]) {
      const html = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(ukInput({ ...rec, customer: record(customer).customer }))));
      expect(html).not.toMatch(/ALV|Kate|Palkkio|Loppusumma|Hinta|Ale %|Kotitalous|Voimassa|Tarjousnumero|10285|Lisätiedot:/);
      expect(html).not.toMatch(/2\s510|2\s000,00|333,33|77,77|502,00/);
      const euroLines = html.split('\n').filter((l) => l.includes('€'));
      expect(euroLines.every((l) => l.includes('Tekijöiden urakka'))).toBe(true);
      expect((html.match(/€/g) ?? []).length).toBe(1);
    }
  });
});
