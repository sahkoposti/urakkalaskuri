import {
  parseStoredStructureIds,
  productBelongsToStructure,
  productStructureIds,
  sameStructureIds,
  withProductStructureIds,
} from '../src/core/product/productStructures';
import type { Product } from '../src/core/models/types';

function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Maali',
    unit: 'l',
    unitPriceVat0: 10,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('productStructures', () => {
  test('reads structureIds and falls back to structureId', () => {
    expect(productStructureIds(sampleProduct({ structureIds: ['a', 'b'] }))).toEqual(['a', 'b']);
    expect(productStructureIds(sampleProduct({ structureId: 'a' }))).toEqual(['a']);
    expect(productStructureIds(sampleProduct())).toEqual([]);
  });

  test('productBelongsToStructure matches any assigned structure', () => {
    const product = sampleProduct({ structureIds: ['roof', 'wall'] });
    expect(productBelongsToStructure(product, 'wall')).toBe(true);
    expect(productBelongsToStructure(product, 'floor')).toBe(false);
  });

  test('parseStoredStructureIds prefers json list and de-duplicates', () => {
    expect(parseStoredStructureIds('["a","a","b"]', 'legacy')).toEqual(['a', 'b']);
    expect(parseStoredStructureIds(null, 'legacy')).toEqual(['legacy']);
    expect(parseStoredStructureIds('[]', 'legacy')).toEqual([]);
  });

  test('withProductStructureIds keeps the first id as structureId', () => {
    const next = withProductStructureIds(sampleProduct(), ['wall', 'roof']);
    expect(next.structureIds).toEqual(['wall', 'roof']);
    expect(next.structureId).toBe('wall');
  });

  test('sameStructureIds ignores order', () => {
    expect(sameStructureIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameStructureIds(['a'], ['a', 'b'])).toBe(false);
  });
});
