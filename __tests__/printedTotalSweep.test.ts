import { customerFromRecord, type CustomerInfo, type StructureLine } from '../src/core/models/types';
import {
  buildPdfContext,
  cardShownTotals,
  formatPrintedDisplayPrice,
  printedOfferAmounts,
} from '../src/core/pdf/buildPdfContext';
import { roundedOfferLineAmount, sumRoundedOfferLines } from '../src/core/pdf/offerDocument';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import {
  calculationWithBusinessVatMode,
  calculationWithUrakkakorttiHidePrices,
  calculationWithUrakkakorttiMode,
} from '../src/core/pdf/urakkakorttiCard';
import { lineTotalVat0, toCardAmount } from '../src/core/structure/linePricing';
import { MANUAL_STRUCTURE_ID } from '../src/core/structure/types';
import { formatCurrency, roundToCents } from '../src/core/utils/formatters';
import { offerIncludesVat, priceBreakdownParts, reconcilePriceRows } from '../src/core/utils/priceDisplay';
import { input, line, record } from './pdfFixtures';

const plain = (value: string) => value.replace(/\s/g, ' ');
const euros = (value: string) => Number(value.replace(/[^\d,.-]/g, '').replace(',', '.'));

type DiscountKind = 'none' | 'line' | 'legacy';

const shapes: Array<{ name: string; parts: Array<{ quantity: number; unitPriceVat0: number; vatPercent?: number }> }> = [
  { name: '2,5 x 10,01', parts: [{ quantity: 2.5, unitPriceVat0: 10.01 }, { quantity: 2.5, unitPriceVat0: 10.01 }, { quantity: 2.5, unitPriceVat0: 10.01 }] },
  { name: '3 x 10,01', parts: [{ quantity: 1, unitPriceVat0: 10.01 }, { quantity: 1, unitPriceVat0: 10.01 }, { quantity: 1, unitPriceVat0: 10.01 }] },
  { name: '55,98', parts: [{ quantity: 1, unitPriceVat0: 55.98 }] },
  { name: '33,35', parts: [{ quantity: 1, unitPriceVat0: 33.35 }] },
  { name: '1,333 x 7,77', parts: [{ quantity: 1.333, unitPriceVat0: 7.77 }, { quantity: 0, unitPriceVat0: 999 }] },
];

const modes: Array<{ name: string; customer: CustomerInfo; vatMode?: 'alv0' | 'sis' }> = [
  { name: 'private', customer: { name: 'A', customerType: 'private' } },
  { name: 'private-reverse', customer: { name: 'A', customerType: 'private', reverseVat: true } },
  { name: 'business-alv0', customer: { name: 'B', customerType: 'business' }, vatMode: 'alv0' },
  { name: 'business-sis', customer: { name: 'B', customerType: 'business' }, vatMode: 'sis' },
  { name: 'business-reverse', customer: { name: 'B', customerType: 'business', reverseVat: true }, vatMode: 'sis' },
];

function structureLines(parts: Array<{ quantity: number; unitPriceVat0: number; vatPercent?: number }>, lineDiscount: number): StructureLine[] {
  const priced = parts.map((part, index) => ({
    ...line(`p${index}`, 's1', `Osa ${index}`),
    quantity: part.quantity,
    unitPriceVat0: part.unitPriceVat0,
    vatPercent: part.vatPercent ?? 25.5,
    discountPercent: part.quantity === 0 ? 0 : lineDiscount,
    materialsVat0: 0,
    contractPriceVat0: index === 0 ? 10.015 : 20.024,
  }));
  const manual: StructureLine = {
    ...line('m', 's1', 'Käsin'),
    structureId: MANUAL_STRUCTURE_ID,
    quantity: 1,
    unit: 'erä',
    unitPriceVat0: 7.77,
    vatPercent: 25.5,
    discountPercent: lineDiscount,
    materialsVat0: 0,
    contractPriceVat0: 4.4,
    snapshot: undefined,
    fieldValues: {},
  };
  return [...priced, manual];
}

describe('printed total sweep', () => {
  const discounts: DiscountKind[] = ['none', 'line', 'legacy'];

  it.each(modes.flatMap((mode) => shapes.flatMap((shape) => discounts.map((discount) => [mode.name, shape.name, discount, mode, shape] as const))))(
    '%s / %s / %s: headings, price block, KTV and screen share one cent',
    (_modeName, _shapeName, discount, mode, shape) => {
      const lineDiscount = discount === 'line' ? 10 : 0;
      const lines = structureLines(shape.parts, lineDiscount);
      const legacy = discount === 'legacy';
      const base = record(mode.customer, {
        structureLines: lines,
        discountPercent: legacy ? 10 : lineDiscount,
        materialsVat0: 0,
        vatPercent: 25.5,
        vatAmount: 0,
        totalPriceVat0BeforeDiscount: legacy ? 15 : 0.01,
        totalPriceVat0: legacy ? 10 : 0.01,
        totalPriceVatBeforeDiscount: legacy ? 20 : 0.01,
        totalPriceVat: legacy ? 12.34 : 0.01,
      });
      const rec = mode.vatMode ? calculationWithBusinessVatMode(base, mode.vatMode) : base;
      const customer = customerFromRecord(rec);
      const ctx = buildPdfContext(input(rec, { structures: [] }));
      const printed = printedOfferAmounts(rec, customer);
      const closing = euros(ctx.price.rows.find((row) => row.emphasis)?.value ?? '');
      const headingSum = roundToCents(
        ctx.sections.reduce((sum, section) => sum + (section.heading?.price ? euros(section.heading.price) : 0), 0),
      );
      const inclusive = offerIncludesVat(customer, rec.formSnapshot);

      if (legacy) {
        expect(printed.source).toBe('stored');
        expect(closing).toBe(roundToCents(inclusive ? rec.totalPriceVat : rec.totalPriceVat0));
        expect(headingSum).not.toBe(closing);
      } else {
        expect(printed.source).toBe('lines');
        expect(printed.gross).toBe(closing);
        if (discount === 'none') {
          expect(headingSum).toBe(closing);
          if (inclusive) {
            const veroton = ctx.price.rows.find((row) => row.label === 'Veroton');
            const alv = ctx.price.rows.find((row) => row.label.startsWith('ALV '));
            expect(veroton && alv).toBeTruthy();
            expect(euros(veroton!.value)).toBe(sumRoundedOfferLines(rec, false, 'paid'));
            expect(roundToCents(euros(veroton!.value) + euros(alv!.value))).toBe(closing);
          }
        } else {
          const rivit = euros(ctx.price.rows[0].value);
          const alennus = Math.abs(euros(ctx.price.rows[1].value));
          expect(headingSum).toBe(rivit);
          expect(roundToCents(rivit - alennus)).toBe(closing);
          expect(closing).toBe(sumRoundedOfferLines(rec, inclusive, 'paid'));
        }
      }

      const block = ctx.price.rows;
      const rivitRow = block.find((row) => row.label.startsWith('Rivit'));
      const aleRow = block.find((row) => row.label.startsWith('Alennus'));
      const afterRow = block.find((row) => row.label.startsWith('Alennettu'));
      if (rivitRow && aleRow && afterRow) {
        expect(roundToCents(euros(rivitRow.value) - Math.abs(euros(aleRow.value)))).toBe(euros(afterRow.value));
      }

      if (customer.customerType !== 'business' && !customer.reverseVat) {
        expect(ctx.ktv?.totalPriceVat).toBe(closing);
      } else {
        expect(ctx.ktv).toBeUndefined();
      }

      expect(plain(formatPrintedDisplayPrice(rec, customer))).toBe(plain(formatCurrency(closing)));
      const shown = cardShownTotals(rec, customer);
      expect(roundToCents(inclusive ? shown.totalPriceVat : shown.totalPriceVat0)).toBe(closing);

      const parts = priceBreakdownParts(rec, inclusive);
      const discountIn = parts.showDiscount ? parts.discountAmount : 0;
      const rows = reconcilePriceRows(parts.materials, parts.work, discountIn, closing);
      const gap = roundToCents(
        closing - (roundToCents(parts.materials) + roundToCents(parts.work) - roundToCents(Math.max(0, discountIn))),
      );
      if (Math.abs(gap) > 0.02) {
        expect(rows).toEqual({ materials: parts.materials, work: parts.work, discount: discountIn });
      } else {
        expect(roundToCents(rows.materials + rows.work - rows.discount)).toBe(closing);
      }

      const sample = lines.find((item) => item.quantity !== 0 && item.structureId !== MANUAL_STRUCTURE_ID);
      expect(sample).toBeTruthy();
      expect(toCardAmount(lineTotalVat0(sample!), inclusive, sample!.vatPercent)).toBe(
        roundedOfferLineAmount(sample!, inclusive, 'paid'),
      );
    },
  );

  it('mixed VAT rates: heading sum, VAT table and Loppusumma match', () => {
    for (const mode of [modes[0], modes[3]]) {
      const lines = structureLines(
        [
          { quantity: 2.5, unitPriceVat0: 10.01, vatPercent: 25.5 },
          { quantity: 1.333, unitPriceVat0: 7.77, vatPercent: 10 },
        ],
        0,
      );
      const base = record(mode.customer, {
        structureLines: lines,
        discountPercent: 0,
        materialsVat0: 0,
        vatPercent: 25.5,
        totalPriceVat0: 0.01,
        totalPriceVat: 0.01,
        totalPriceVat0BeforeDiscount: 0.01,
        totalPriceVatBeforeDiscount: 0.01,
      });
      const rec = mode.vatMode ? calculationWithBusinessVatMode(base, mode.vatMode) : base;
      const ctx = buildPdfContext(input(rec, { structures: [] }));
      const closing = euros(ctx.price.rows.find((row) => row.emphasis)?.value ?? '');
      const headingSum = roundToCents(
        ctx.sections.reduce((sum, section) => sum + (section.heading?.price ? euros(section.heading.price) : 0), 0),
      );
      expect(headingSum).toBe(closing);
      expect(ctx.vatSummary.length).toBeGreaterThan(1);
      expect(roundToCents(ctx.vatSummary.reduce((sum, row) => sum + row.gross, 0))).toBe(closing);
      for (const row of ctx.vatSummary) expect(roundToCents(row.net + row.vat)).toBe(row.gross);
      const html = renderTarjousHtml(ctx);
      expect(html).toContain('class="offer-vat"');
    }
  });

  it('single-rate VAT table is omitted and still holds the stored aggregate', () => {
    const ctx = buildPdfContext(input(record({})));
    expect(ctx.vatSummary).toEqual([{ vatPercent: 25.5, net: 2000, vat: 510, gross: 2510 }]);
    expect(renderTarjousHtml(ctx)).not.toContain('class="offer-vat"');
  });

  it('urakkakortti does not print the offer total, and Urakan summa is the rounded row sum', () => {
    const lines = structureLines([{ quantity: 2.5, unitPriceVat0: 10.01 }, { quantity: 1, unitPriceVat0: 33.35 }], 0);
    const rec = record({ name: 'A', customerType: 'private' }, { structureLines: lines, materialsVat0: 0 });
    const source = input(rec, { structures: [] });
    for (const cardRecord of [rec, calculationWithUrakkakorttiMode(rec, 'tyontekija')]) {
      const ctx = buildUrakkakorttiContext({ ...source, record: cardRecord });
      const html = plain(renderUrakkakorttiHtml(ctx));
      expect(html).not.toContain('Loppusumma');
      expect(html).not.toContain('Rivit yhteensä');
      expect(html).not.toContain('Alennettu');
      const amounts = ctx.contractRows.filter((row) => !row.emphasis).map((row) => euros(row.value));
      const total = euros(ctx.contractRows.find((row) => row.emphasis)?.value ?? '');
      expect(roundToCents(amounts.reduce((sum, amount) => sum + amount, 0))).toBe(total);
      expect(euros(ctx.contractSum ?? '')).toBe(total);
    }
    const hidden = renderUrakkakorttiHtml(
      buildUrakkakorttiContext({ ...source, record: calculationWithUrakkakorttiHidePrices(rec, true) }),
    );
    expect(hidden).not.toContain('Urakan summa');
    expect(hidden).not.toContain('€');
    expect(hidden).not.toContain('Loppusumma');
  });
});
