import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { formatCurrency, formatPercent } from '../src/core/utils/formatters';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, line, record } from './pdfFixtures';

function vatInGross(gross: number, rate: number): number {
  return Math.round((gross - gross / (1 + rate / 100)) * 100) / 100;
}

describe('Finding 6: Sisältää ALV after line-level discount (single rate)', () => {
  test('repro 1 129,50 € + legacy calc discount + two-rate unchanged', () => {
    const singleRate = record({}, {
      structureLines: [
        { ...line('a', 's1', 'Työ'), quantity: 1, unitPriceVat0: 1000, discountPercent: 10, vatPercent: 25.5 },
      ],
      discountPercent: 10,
      totalPriceVat0BeforeDiscount: 1000,
      totalPriceVat0: 900,
      totalPriceVatBeforeDiscount: 1255,
      totalPriceVat: 1129.5,
      vatAmount: 229.5,
      vatPercent: 25.5,
    });
    const ctx = buildPdfContext(input(singleRate));
    const expectedVat = formatCurrency(vatInGross(1129.5, 25.5));
    expect(ctx.price.rows.map((row) => row.label)).toEqual([
      'Yhteensä alv 0',
      'Alv 25,5 %',
      'Yhteensä sis. alv',
      'Alennus yhteensä 10 %',
      'Alennettu hinta yhteensä',
      `Sisältää ALV ${formatPercent(25.5)}`,
    ]);
    expect(ctx.price.rows.find((row) => row.label === 'Alennettu hinta yhteensä')?.value.replace(/\s/g, ' ')).toBe(
      '1 129,50 €',
    );
    expect(ctx.price.rows.find((row) => row.label.startsWith('Sisältää ALV'))?.value.replace(/\s/g, ' ')).toBe(
      expectedVat.replace(/\s/g, ' '),
    );
    const html = renderTarjousHtml(ctx);
    expect(html.indexOf('Alennettu hinta yhteensä')).toBeLessThan(html.indexOf('Sisältää ALV 25,5 %'));

    const legacy = record({}, {
      structureLines: [{ ...line('l1', 's1', 'Urakka'), quantity: 1, unitPriceVat0: 2000, discountPercent: 0 }],
      discountPercent: 10,
      totalPriceVat0BeforeDiscount: 2000,
      totalPriceVat0: 1800,
      totalPriceVatBeforeDiscount: 2510,
      totalPriceVat: 2259,
      vatAmount: 459,
    });
    const legacyCtx = buildPdfContext(input(legacy));
    expect(legacyCtx.price.rows.some((row) => row.label.startsWith('Sisältää ALV'))).toBe(true);
    expect(legacyCtx.price.rows.map((row) => row.label)).toEqual([
      'Rivit yhteensä',
      'Alennus yhteensä 10 %',
      'Alennettu hinta yhteensä',
      `Sisältää ALV ${formatPercent(25.5)}`,
    ]);

    const twoRate = record({}, {
      structureLines: [
        { ...line('a', 's1', 'A'), quantity: 1, unitPriceVat0: 100, discountPercent: 10, vatPercent: 25.5 },
        { ...line('b', 's1', 'B'), quantity: 1, unitPriceVat0: 100, discountPercent: 10, vatPercent: 10 },
      ],
      discountPercent: 10,
      totalPriceVat0: 180,
      totalPriceVatBeforeDiscount: 235.5,
      totalPriceVat: 211.95,
    });
    const two = buildPdfContext(input(twoRate));
    expect(two.price.rows.map((row) => row.label)).toEqual([
      'Yhteensä alv 0',
      'Alv 25,5 %',
      'Alv 10 %',
      'Yhteensä sis. alv',
      'Alennus yhteensä 10 %',
      'Alennettu hinta yhteensä',
      'Sisältää ALV 25,5 %',
      'Sisältää ALV 10 %',
    ]);
  });
});