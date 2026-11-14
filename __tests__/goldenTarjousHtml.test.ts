import fs from 'fs';
import path from 'path';

import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';

import {
  buildGoldenPdfContextInput,
  GOLDEN_FIXED_DATE,
  GOLDEN_LOGO,
  goldenProducts,
} from './golden/goldenHtmlFixtures';

const GOLDEN_PATH = path.join(__dirname, 'golden', 'tarjous.golden.html');

function renderGoldenTarjousHtml(): string {
  const ctx = buildPdfContext(buildGoldenPdfContextInput());
  return renderTarjousHtml(ctx, { logoDataUri: GOLDEN_LOGO });
}

describe('golden full HTML: tarjous', () => {
  it('uses the modularity golden fixture (2+ structures, products, shades)', () => {
    const input = buildGoldenPdfContextInput();
    expect(input.structures.length).toBeGreaterThanOrEqual(2);
    expect(input.products.length).toBeGreaterThanOrEqual(2);
    expect(goldenProducts.length).toBeGreaterThanOrEqual(2);
    const shades =
      input.record.structureLines?.[0]?.materialQuantities?.[0]?.shades?.length ?? 0;
    expect(shades).toBeGreaterThanOrEqual(2);
    expect(input.generatedAt?.getTime()).toBe(GOLDEN_FIXED_DATE.getTime());
  });

  it('matches the committed golden HTML byte-for-byte', () => {
    const html = renderGoldenTarjousHtml();
    const expected = fs.readFileSync(GOLDEN_PATH, 'utf8');
    expect(html).toBe(expected);
  });
});
