import type { Product } from '@/src/core/models/types';
import { productStructureIds } from '@/src/core/product/productStructures';
import { createId } from '@/src/core/utils/id';

export function productSortOrder(product: Pick<Product, 'sortOrder'>): number {
  return typeof product.sortOrder === 'number' && Number.isFinite(product.sortOrder)
    ? product.sortOrder
    : 0;
}

export function nextProductSortOrder(products: Pick<Product, 'sortOrder'>[]): number {
  if (products.length === 0) return 0;
  return Math.max(...products.map(productSortOrder)) + 1;
}

/** Siirtää tuotetta listassa ja numeroi sortOrder uudelleen 0…n-1. */
export function moveProductInList(products: Product[], index: number, direction: -1 | 1): Product[] {
  const target = index + direction;
  if (target < 0 || target >= products.length) return products;
  const next = [...products];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next.map((product, sortOrder) => ({ ...product, sortOrder }));
}

export function duplicateProduct(source: Product): Product {
  const structureIds = productStructureIds(source);
  return {
    ...source,
    id: createId(),
    name: `${source.name} (kopio)`,
    attributes: source.attributes ? { ...source.attributes } : undefined,
    structureIds: structureIds.length > 0 ? [...structureIds] : undefined,
    structureId: structureIds[0],
    createdAt: new Date(),
  };
}
