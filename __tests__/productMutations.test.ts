jest.mock('@/src/core/utils/id', () => ({
  createId: () => 'prod-copy-id',
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1',
}));

import { duplicateProduct } from '../src/core/product/productMutations';
import type { Product } from '../src/core/models/types';

function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Laudoitus',
    unit: 'm²',
    unitPriceVat0: 12.5,
    description: 'Kuvaus',
    attributes: { consumption: 1.2, work_factor: 0.8 },
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('productMutations', () => {
  test('duplicateProduct creates copy with new id and name suffix', () => {
    const source = sampleProduct();
    const copy = duplicateProduct(source);

    expect(copy.id).toBe('prod-copy-id');
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('Laudoitus (kopio)');
    expect(copy.unit).toBe(source.unit);
    expect(copy.unitPriceVat0).toBe(source.unitPriceVat0);
    expect(copy.description).toBe(source.description);
    expect(copy.attributes).toEqual(source.attributes);
    expect(copy.attributes).not.toBe(source.attributes);
    expect(copy.createdAt).not.toEqual(source.createdAt);
  });

  test('duplicateProduct omits attributes when source has none', () => {
    const source = sampleProduct({ attributes: undefined, description: undefined });
    const copy = duplicateProduct(source);

    expect(copy.attributes).toBeUndefined();
    expect(copy.description).toBeUndefined();
  });
});
