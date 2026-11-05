import { hasFormVersionMismatch } from '../src/core/form/formVersion';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import {
  calculationWithKtvPageIncluded,
  readKtvPageIncluded,
} from '../src/core/pdf/ktvPageIncluded';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { preserveCalculationSnapshot } from '../src/core/pdf/urakkakorttiCard';
import { ensureStructureLines } from '../src/core/structure/legacyCalculation';
import { input, record } from './pdfFixtures';

function priced() {
  return record({}, { formSnapshot: { formId: 'f', formVersion: 1, fields: [] } });
}

function priceBlock(html: string): string {
  const start = html.indexOf('class="price-block offer-totals"');
  const end = html.indexOf('class="offer-sign"');
  return html.slice(start, end);
}

function withoutStyle(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/, '');
}

describe('ktvPageIncluded', () => {
  it('treats a missing key as included and stores only false', () => {
    const source = priced();
    expect(readKtvPageIncluded(source.formSnapshot)).toBe(true);
    expect(readKtvPageIncluded(undefined)).toBe(true);
    expect(calculationWithKtvPageIncluded(source, true)).toBe(source);

    const off = calculationWithKtvPageIncluded(source, false);
    expect(off.formSnapshot?.ktvPageIncluded).toBe(false);
    expect(JSON.stringify(off.formSnapshot)).toContain('"ktvPageIncluded":false');
    expect(calculationWithKtvPageIncluded(off, false)).toBe(off);

    const on = calculationWithKtvPageIncluded(off, true);
    expect(on.formSnapshot?.ktvPageIncluded).toBeUndefined();
    expect(JSON.stringify(on.formSnapshot)).not.toContain('ktvPageIncluded');
    expect(readKtvPageIncluded(on.formSnapshot)).toBe(true);
  });

  it('keeps the key across a wizard rebuild', () => {
    const previous = calculationWithKtvPageIncluded(priced(), false).formSnapshot;
    const rebuilt = preserveCalculationSnapshot(
      record({}, { formSnapshot: { formId: 'new', formVersion: 4, fields: [] } }),
      previous,
    );
    expect(rebuilt.formSnapshot?.ktvPageIncluded).toBe(false);
    expect(rebuilt.formSnapshot?.formId).toBe('new');
  });

  it('omits the KTV page when off and keeps the page 1 total', () => {
    const base = priced();
    const onHtml = renderTarjousHtml(buildPdfContext(input(base)));
    const offHtml = renderTarjousHtml(buildPdfContext(input(calculationWithKtvPageIncluded(base, false))));
    expect(onHtml).toContain('class="ktv-page page-break"');
    expect(onHtml).toContain('1. Tarjouksen hinta');
    expect(onHtml).toContain('class="ktv-block"');
    expect(withoutStyle(offHtml)).not.toContain('ktv-page');
    expect(withoutStyle(offHtml)).not.toContain('ktv-block');
    expect(withoutStyle(offHtml)).not.toContain('page-break');
    expect(withoutStyle(offHtml)).not.toContain('Kotitalousvähennys');
    expect(priceBlock(onHtml)).toBe(priceBlock(offHtml));
    expect(priceBlock(onHtml)).toMatch(/\d[\d\u00a0\u202f]*[,.]\d{2}/);
  });

  it('prints the same HTML when the switch is turned back on', () => {
    const base = priced();
    const restored = calculationWithKtvPageIncluded(calculationWithKtvPageIncluded(base, false), true);
    expect(renderTarjousHtml(buildPdfContext(input(restored)))).toBe(renderTarjousHtml(buildPdfContext(input(base))));
  });

  it('stores only the flag when the calculation has no form snapshot', () => {
    const bare = record({});
    delete bare.formSnapshot;
    delete bare.structureLines;
    const off = calculationWithKtvPageIncluded(bare, false);
    expect(off.formSnapshot).toEqual({ ktvPageIncluded: false });
    expect(readKtvPageIncluded(off.formSnapshot)).toBe(false);
    const line = ensureStructureLines(off)[0];
    expect(line.formFilled).toBe(false);
    expect(line.formVersion).toBeUndefined();
    expect(hasFormVersionMismatch(line.formVersion ?? line.snapshot?.formVersion, 3)).toBe(false);
    expect(line.snapshot?.ktvPageIncluded).toBe(false);
  });

  it('still omits the page for a business customer even if the key is absent', () => {
    const html = withoutStyle(
      renderTarjousHtml(buildPdfContext(input(record({ customerType: 'business' })))),
    );
    expect(html).not.toContain('ktv-page');
  });
});
