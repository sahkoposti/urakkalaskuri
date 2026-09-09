import {
  customerSeesVatInclusive,
  labeledWithVatMode,
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
  });
});
