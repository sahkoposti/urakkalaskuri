import { exportProductToContext } from '../src/core/form/productContext';
import {
  productMarginEur,
  productMarginPercent,
  productPurchasePriceVat0,
  productSalePriceVat0,
} from '../src/core/product/productPricing';
import type { Product } from '../src/core/models/types';

function product(partial: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Maali',
    unit: 'l',
    unitPriceVat0: 10,
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

describe('productPricing', () => {
  test('uses unit price as ostohinta when purchase price is missing', () => {
    expect(productPurchasePriceVat0(product())).toBe(10);
    expect(productSalePriceVat0(product())).toBe(10);
    expect(productMarginEur(product())).toBe(0);
  });

  test('computes margin from sale and purchase prices', () => {
    const priced = product({ purchasePriceVat0: 8, salePriceVat0: 10, unitPriceVat0: 8 });
    expect(productPurchasePriceVat0(priced)).toBe(8);
    expect(productSalePriceVat0(priced)).toBe(10);
    expect(productMarginEur(priced)).toBe(2);
    expect(productMarginPercent(priced)).toBeCloseTo(20);
  });

  test('reads prices from attributes when columns are missing', () => {
    const priced = product({
      unitPriceVat0: 0,
      attributes: { purchase_price: 4, sale_price: 5 },
    });
    expect(productPurchasePriceVat0(priced)).toBe(4);
    expect(productSalePriceVat0(priced)).toBe(5);
    expect(productMarginPercent(priced)).toBeCloseTo(20);
  });

  test('exports ostohinta, myyntihinta and kate into formula context', () => {
    const context: Record<string, number> = {};
    exportProductToContext(
      'kaytettava_maali',
      product({ purchasePriceVat0: 8, salePriceVat0: 10, unitPriceVat0: 8 }),
      context,
    );
    expect(context['kaytettava_maali.ostohinta']).toBe(8);
    expect(context['kaytettava_maali.yksikkohinta']).toBe(8);
    expect(context['kaytettava_maali.myyntihinta']).toBe(10);
    expect(context['kaytettava_maali.kate']).toBe(2);
    expect(context['kaytettava_maali.kate_prosentti']).toBeCloseTo(20);
  });
});
