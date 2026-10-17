import {
  customerSeesVatInclusive,
  defaultPricesIncludeVat,
  labeledWithVatMode,
  priceBreakdownParts,
  summaryShowsVatInclusive,
  vat0Tag,
  vatInclTag,
  workPriceVat0,
} from '../src/core/utils/priceDisplay';

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
    expect(summaryShowsVatInclusive(business, [{ pricesIncludeVat: true }])).toBe(false);
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
});
