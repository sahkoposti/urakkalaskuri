import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { offerVatSummary } from '../src/core/pdf/offerDocument';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { customerFromRecord } from '../src/core/models/types';
import { input, line, record } from './pdfFixtures';

describe('Finding 5: offer VAT rates ignore määrä 0 lines', () => {
  const customer = customerFromRecord(
    record({ customerType: 'private' }, {
      structureLines: [{ ...line('a', 's1', 'A'), vatPercent: 25.5, unitPriceVat0: 1000, quantity: 1 }],
      totalPriceVat0: 1000,
      vatAmount: 255,
      totalPriceVat: 1255,
      vatPercent: 25.5,
    }),
  );

  test('priced 25,5 % + määrä 0 at 14 %: no VAT table, no 0,00 row; real two-rate still shows table', () => {
    const singleRate = record({}, {
      structureLines: [
        { ...line('a', 's1', 'Seinä'), vatPercent: 25.5, unitPriceVat0: 1000, quantity: 1, discountPercent: 0 },
        { ...line('z', 's2', 'Sokkeli'), vatPercent: 14, unitPriceVat0: 500, quantity: 0, discountPercent: 0 },
      ],
      totalPriceVat0: 1000,
      vatAmount: 255,
      totalPriceVat: 1255,
      vatPercent: 25.5,
    });

    expect(offerVatSummary(singleRate, customer)).toEqual([
      { vatPercent: 25.5, net: 1000, vat: 255, gross: 1255 },
    ]);
    const htmlSingle = renderTarjousHtml(buildPdfContext(input(singleRate)));
    expect(htmlSingle).not.toContain('class="offer-vat"');
    expect(htmlSingle).not.toContain('14 %');
    expect(htmlSingle).not.toContain('0,00 / 0,00');

    const twoRate = record({}, {
      structureLines: [
        { ...line('a', 's1', 'A'), vatPercent: 25.5, unitPriceVat0: 1000, quantity: 1, discountPercent: 0 },
        { ...line('b', 's2', 'B'), vatPercent: 10, unitPriceVat0: 500, quantity: 1, discountPercent: 0 },
      ],
      totalPriceVat0: 1500,
      vatAmount: 305,
      totalPriceVat: 1805,
      vatPercent: 25.5,
    });
    expect(offerVatSummary(twoRate, customerFromRecord(twoRate))).toEqual([
      { vatPercent: 25.5, net: 1000, vat: 255, gross: 1255 },
      { vatPercent: 10, net: 500, vat: 50, gross: 550 },
    ]);
    const htmlTwo = renderTarjousHtml(buildPdfContext(input(twoRate)));
    expect(htmlTwo).toContain('class="offer-vat"');
    expect(htmlTwo).toContain('25,5 %');
    expect(htmlTwo).toContain('10 %');
  });
});