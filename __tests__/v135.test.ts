import fs from 'fs';
import path from 'path';

import { NAME_FIELD_KIND, textInputPropsFor } from '../src/components/textInputProps';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext, urakkakorttiBodyBlocks } from '../src/core/pdf/urakkakortti';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import {
  STRUCTURE_LINE_ADDITIONAL_INFO_DEFAULT_EXPANDED,
  structureLineAdditionalInfoCollapsed,
} from '../src/core/structure/structureLineAdditionalInfoUi';
import { input, line, record } from './pdfFixtures';

describe('v1.3.5', () => {
  it('defaults structure Lisätiedot collapsed', () => {
    expect(STRUCTURE_LINE_ADDITIONAL_INFO_DEFAULT_EXPANDED).toBe(false);
    expect(structureLineAdditionalInfoCollapsed(false, 'teksti')).toBe(true);
    expect(structureLineAdditionalInfoCollapsed(true, '')).toBe(false);
  });

  it('aggregates materials from multiple structures with shades on one combined quantity line', () => {
    const rec = record(
      {},
      {
        structureLines: [
          {
            ...line('a', 's1', 'Ulkomaalaus'),
            materialQuantities: [
              {
                id: 'p1',
                productName: 'Nova 7',
                quantity: 0,
                source: 'manual',
                shades: [
                  { id: 's1', name: 'G47', quantity: 3, unit: 'l' },
                  { id: 's2', name: '505X', quantity: 5, unit: 'l' },
                ],
              },
            ],
          },
          {
            ...line('b', 's2', 'Sokkeli'),
            materialQuantities: [
              { id: 'p2', productName: 'Pohjuste', quantity: 4, unit: 'l', source: 'manual' },
            ],
          },
        ],
      },
    );
    const ctx = buildUrakkakorttiContext(input(rec));
    expect(ctx.materials.filter((row) => row.structureHeader).map((row) => row.product)).toEqual([
      'Ulkomaalaus',
      'Sokkeli',
    ]);
    expect(urakkakorttiBodyBlocks(ctx).at(-1)).toBe('materials');
    const html = renderUrakkakorttiHtml(ctx);
    const materials = html.slice(html.indexOf('class="uk-materials'));
    expect(materials).toContain('G47');
    expect(materials).toContain('<td class="value">3 l</td>');
    expect(materials).toContain('<td class="value">5 l</td>');
    expect(materials).toContain('<td class="value">4 l</td>');
    expect(materials).not.toContain('<th>Yksikkö</th>');
    expect(html.indexOf('Materiaalit')).toBeGreaterThan(html.indexOf('Huomioitavaa') || -1);
  });

  it('orders offer PDF: sections, totals, then Lisätiedot blocks', () => {
    const rec = record(
      {},
      {
        structureLines: [{ ...line('a', 's1', 'Ulkomaalaus'), additionalInfo: 'Rakenteen lisätieto.' }],
      },
    );
    const html = renderTarjousHtml(
      buildPdfContext(
        input(rec, {
          offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: 'Yrityksen lisätieto.' },
        }),
      ),
    );
    const at = (needle: string) => html.indexOf(needle);
    expect(at('class="doc-section offer-section"')).toBeLessThan(at('class="price-block offer-totals"'));
    expect(at('class="price-block offer-totals"')).toBeLessThan(at('Rakenteen lisätieto.'));
    expect(at('Rakenteen lisätieto.')).toBeLessThan(at('Yrityksen lisätieto.'));
  });

  it('disables word autocapitalize on product, structure and line names', () => {
    for (const field of ['productName', 'structureName', 'lineName'] as const) {
      expect(textInputPropsFor(NAME_FIELD_KIND[field]).autoCapitalize).toBe('none');
    }
    expect(textInputPropsFor(NAME_FIELD_KIND.customerName).autoCapitalize).toBe('words');
  });

  it('uses code (no autocapitalize) for admin page and option titles', () => {
    expect(textInputPropsFor('code').autoCapitalize).toBe('none');
  });

  it('keeps sentence autocapitalize for address and words for postal locality', () => {
    const customerStep = fs.readFileSync(
      path.join(__dirname, '../src/features/asiakkaat/components/CustomerStep.tsx'),
      'utf8',
    );
    expect(customerStep).toContain('label="Osoite"');
    expect(customerStep).toMatch(/label="Osoite"[\s\S]*?kind="sentence"/);
    expect(customerStep).toMatch(/label="Postitoimipaikka"[\s\S]*?kind="words"/);
    expect(textInputPropsFor('sentence').autoCapitalize).toBe('sentences');
    expect(textInputPropsFor('words').autoCapitalize).toBe('words');
  });
});
