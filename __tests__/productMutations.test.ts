jest.mock('@/src/core/utils/id', () => ({
  createId: () => 'prod-copy-id',
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-1',
}));

import { duplicateProduct, moveProductInList, nextProductSortOrder } from '../src/core/product/productMutations';
import type { Product } from '../src/core/models/types';

function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Laudoitus',
    unit: 'm²',
    unitPriceVat0: 12.5,
    purchasePriceVat0: 12.5,
    salePriceVat0: 18,
    description: 'Kuvaus',
    attributes: { consumption: 1.2, work_factor: 0.8 },
    structureIds: ['struct-1', 'struct-2'],
    structureId: 'struct-1',
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
    expect(copy.purchasePriceVat0).toBe(source.purchasePriceVat0);
    expect(copy.salePriceVat0).toBe(source.salePriceVat0);
    expect(copy.description).toBe(source.description);
    expect(copy.attributes).toEqual(source.attributes);
    expect(copy.attributes).not.toBe(source.attributes);
    expect(copy.createdAt).not.toEqual(source.createdAt);
    expect(copy.structureIds).toEqual(['struct-1', 'struct-2']);
    expect(copy.structureId).toBe('struct-1');
  });

  test('nextProductSortOrder appends after the current maximum', () => {
    expect(nextProductSortOrder([])).toBe(0);
    expect(nextProductSortOrder([sampleProduct({ sortOrder: 2 }), sampleProduct({ sortOrder: 5 })])).toBe(6);
    expect(nextProductSortOrder([sampleProduct()])).toBe(1);
  });

  test('moveProductInList swaps neighbors and rewrites sortOrder', () => {
    const first = sampleProduct({ id: 'a', name: 'A', sortOrder: 0 });
    const second = sampleProduct({ id: 'b', name: 'B', sortOrder: 1 });
    const third = sampleProduct({ id: 'c', name: 'C', sortOrder: 2 });
    const moved = moveProductInList([first, second, third], 2, -1);

    expect(moved.map((product) => product.id)).toEqual(['a', 'c', 'b']);
    expect(moved.map((product) => product.sortOrder)).toEqual([0, 1, 2]);
    expect(moveProductInList([first, second], 0, -1)).toEqual([first, second]);
  });

  test('duplicateProduct omits attributes when source has none', () => {
    const source = sampleProduct({ attributes: undefined, description: undefined });
    const copy = duplicateProduct(source);

    expect(copy.attributes).toBeUndefined();
    expect(copy.description).toBeUndefined();
  });
});
