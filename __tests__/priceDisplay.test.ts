import { cardShownTotals, formatPrintedDisplayPrice, printedOfferAmounts } from '../src/core/pdf/buildPdfContext';
import { roundedLineCardPrices } from '../src/core/pdf/offerDocument';
import { formatCurrency, roundToCents } from '../src/core/utils/formatters';
import {
  customerSeesVatInclusive,
  defaultPricesIncludeVat,
  labeledWithVatMode,
  offerIncludesVat,
  priceBreakdownParts,
  reconcilePriceRows,
  summaryShowsVatInclusive,
  vat0Tag,
  vatInclTag,
  workPriceVat0,
} from '../src/core/utils/priceDisplay';
import { line, record } from './pdfFixtures';

describe('vat labels', () => {
  test('uses ALV 0 and ALV 25,5', () => {
    expect(vat0Tag()).toBe('ALV 0');
    expect(vatInclTag(25.5)).toBe('ALV 25,5');
    expect(labeledWithVatMode('Materiaalit', true, 25.5)).toBe('Materiaalit (ALV 25,5)');
    expect(labeledWithVatMode('Työ', false, 25.5)).toBe('Työ (ALV 0)');
  });

  test('työ on myynti miinus materiaalit', () => {
    expect(workPriceVat0(1000, 365)).toBe(635);
  });

  test('yritys näkee ALV 0, yksityinen ALV:llisen', () => {
    expect(customerSeesVatInclusive({ name: 'A', customerType: 'private' })).toBe(true);
    expect(customerSeesVatInclusive({ name: 'B', customerType: 'business' })).toBe(false);
    expect(
      customerSeesVatInclusive({ name: 'C', customerType: 'business', reverseVat: true }),
    ).toBe(false);
    expect(defaultPricesIncludeVat({ name: 'A', customerType: 'private' })).toBe(true);
    expect(defaultPricesIncludeVat({ name: 'B', customerType: 'business' })).toBe(false);
  });

  test('yhteenveto on ALV 0 yritysasiakkaalla ja kun rivit ovat ALV 0', () => {
    const privateCustomer = { name: 'A', customerType: 'private' as const };
    const business = { name: 'B', customerType: 'business' as const };
    const reverseBusiness = { name: 'C', customerType: 'business' as const, reverseVat: true };
    const sis = { businessVatMode: 'sis' as const };
    expect(summaryShowsVatInclusive(business, [{ pricesIncludeVat: true }])).toBe(false);
    expect(summaryShowsVatInclusive(business, [{ pricesIncludeVat: true }], sis)).toBe(true);
    expect(summaryShowsVatInclusive(business, [{ pricesIncludeVat: false }])).toBe(false);
    expect(summaryShowsVatInclusive(business, [{}])).toBe(false);
    expect(summaryShowsVatInclusive(reverseBusiness, [{ pricesIncludeVat: true }], sis)).toBe(false);
    expect(offerIncludesVat(business)).toBe(false);
    expect(offerIncludesVat(business, { businessVatMode: 'alv0' })).toBe(false);
    expect(offerIncludesVat(business, sis)).toBe(true);
    expect(offerIncludesVat(reverseBusiness, sis)).toBe(false);
    expect(offerIncludesVat(privateCustomer)).toBe(true);
    expect(summaryShowsVatInclusive(privateCustomer, [{ pricesIncludeVat: true }])).toBe(true);
    expect(
      summaryShowsVatInclusive(privateCustomer, [
        { pricesIncludeVat: false },
        { pricesIncludeVat: false },
      ]),
    ).toBe(false);
  });

  test('alennus ei vähennä työtä kahteen kertaan', () => {
    const parts = priceBreakdownParts(
      {
        materialsVat0: 200,
        discountPercent: 10,
        totalPriceVat0: 900,
        totalPriceVat: 1129.5,
        vatAmount: 229.5,
        vatPercent: 25.5,
        totalPriceVat0BeforeDiscount: 1000,
        totalPriceVatBeforeDiscount: 1255,
      },
      true,
    );
    expect(parts.work).toBeCloseTo(800 * 1.255, 10);
    expect(parts.materials + parts.work - parts.discountAmount).toBeCloseTo(parts.priceAfterDiscount, 10);
  });

  test('3 x 10,01: suurempi rivi ottaa sentin, jotta summa on kokonaishinta', () => {
    const rows = reconcilePriceRows(0, 30.03 * 1.255, 0, 37.68);
    expect(rows).toEqual({ materials: 0, work: 37.68, discount: 0 });
    expect(roundToCents(rows.materials + rows.work - rows.discount)).toBe(37.68);
  });

  test('enintään 2 senttiä tasataan, sitä suurempaa eroa ei piiloteta', () => {
    expect(reconcilePriceRows(10, 20.01, 0, 30.03)).toEqual({ materials: 10, work: 20.03, discount: 0 });
    expect(reconcilePriceRows(100, 50, 0, 100)).toEqual({ materials: 100, work: 50, discount: 0 });
  });
});

describe('printed total on screen', () => {
  const customer = { name: 'Matti Meikäläinen', customerType: 'private' as const };
  const plain = (value: string) => value.replace(/\s/g, ' ');

  function threeLines(discountPercent: number) {
    const storedGross = 30.03 * 1.255;
    return record(customer, {
      structureLines: [0, 1, 2].map((index) => ({
        ...line(`a${index}`, 's1', `Osa ${index}`),
        quantity: 1,
        unitPriceVat0: 10.01,
        discountPercent,
        vatPercent: 25.5,
        materialsVat0: 0,
      })),
      discountPercent,
      totalPriceVat0BeforeDiscount: 30.03,
      totalPriceVat0: discountPercent > 0 ? 27.03 : 30.03,
      totalPriceVatBeforeDiscount: storedGross,
      totalPriceVat: discountPercent > 0 ? 33.92 : storedGross,
      vatAmount: (discountPercent > 0 ? 33.92 : storedGross) - (discountPercent > 0 ? 27.03 : 30.03),
      vatPercent: 25.5,
      materialsVat0: 0,
    });
  }

  test('private without discount: card and history use the rounded line sum', () => {
    const rec = threeLines(0);
    const printed = printedOfferAmounts(rec, customer);
    expect(printed).toEqual({ net: 30.03, vat: 7.65, gross: 37.68, source: 'lines' });
    expect(printed.net + printed.vat).toBe(printed.gross);
    const shown = cardShownTotals(rec, customer);
    expect(shown).toEqual({ totalPriceVat0: 30.03, totalPriceVat: 37.68, vatAmount: 7.65, usedPrintedLines: true });
    expect(plain(formatPrintedDisplayPrice(rec, customer))).toBe('37,68 €');
    expect(plain(formatCurrency(rec.totalPriceVat))).toBe('37,69 €');
  });

  test('one line card reconciles Veroton + ALV to the rounded Yht', () => {
    const prices = roundedLineCardPrices(
      { ...line('a', 's1', 'Osa'), quantity: 1, unitPriceVat0: 10.01, discountPercent: 0, vatPercent: 25.5 },
      false,
    );
    expect(prices.totalPriceVat0).toBe(10.01);
    expect(prices.totalPriceVat).toBe(12.56);
    expect(prices.vatAmount).toBe(2.55);
    expect(roundToCents(prices.totalPriceVat0 + prices.vatAmount)).toBe(prices.totalPriceVat);
  });

  test('legacy record discount keeps the stored total on screen', () => {
    const rec = record(customer, {
      structureLines: [{ ...line('a', 's1', 'Lista'), quantity: 1, unitPriceVat0: 90.6, discountPercent: 0, vatPercent: 25.5 }],
      discountPercent: 5,
      totalPriceVat0BeforeDiscount: 90.6,
      totalPriceVat0: 86.07,
      totalPriceVatBeforeDiscount: 113.7,
      totalPriceVat: 108.02,
      vatAmount: 21.95,
      vatPercent: 25.5,
    });
    const printed = printedOfferAmounts(rec, customer);
    expect(printed.gross).toBe(108.02);
    expect(printed.source).toBe('stored');
    expect(cardShownTotals(rec, customer).totalPriceVat).toBe(108.02);
    expect(plain(formatPrintedDisplayPrice(rec, customer))).toBe('108,02 €');
  });

  test('without structure lines the screen keeps the stored total', () => {
    const rec = record(customer, { structureLines: [], totalPriceVat: 37.68765, totalPriceVat0: 30.03, vatAmount: 7.65765 });
    const shown = cardShownTotals(rec, customer);
    expect(shown.usedPrintedLines).toBe(false);
    expect(shown.totalPriceVat).toBe(37.68765);
    expect(plain(formatPrintedDisplayPrice(rec, customer))).toBe(plain(formatCurrency(37.68765)));
  });
});
