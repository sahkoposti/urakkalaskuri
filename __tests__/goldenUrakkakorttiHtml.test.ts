import fs from 'fs';
import path from 'path';

import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';

import {
  buildGoldenUrakkakorttiInput,
  GOLDEN_FIXED_DATE,
  goldenProducts,
} from './golden/goldenHtmlFixtures';

const GOLDEN_PATH = path.join(__dirname, 'golden', 'urakkakortti.golden.html');

function renderGoldenUrakkakorttiHtml(): string {
  return renderUrakkakorttiHtml(buildUrakkakorttiContext(buildGoldenUrakkakorttiInput()));
}

describe('golden full HTML: urakkakortti', () => {
  it('uses the modularity golden fixture (2+ structures, products, shades)', () => {
    const input = buildGoldenUrakkakorttiInput();
    expect(input.structures.length).toBeGreaterThanOrEqual(2);
    expect(input.products.length).toBeGreaterThanOrEqual(2);
    expect(goldenProducts.length).toBeGreaterThanOrEqual(2);
    const shades =
      input.record.structureLines?.[0]?.materialQuantities?.[0]?.shades?.length ?? 0;
    expect(shades).toBeGreaterThanOrEqual(2);
    expect(input.generatedAt?.getTime()).toBe(GOLDEN_FIXED_DATE.getTime());
  });

  it('matches the committed golden HTML byte-for-byte', () => {
    const html = renderGoldenUrakkakorttiHtml();
    const expected = fs.readFileSync(GOLDEN_PATH, 'utf8');
    expect(html).toBe(expected);
  });
});
