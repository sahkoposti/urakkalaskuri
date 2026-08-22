import type { Product } from '@/src/core/models/types';
import { createId } from '@/src/core/utils/id';

export function duplicateProduct(source: Product): Product {
  return {
    ...source,
    id: createId(),
    name: `${source.name} (kopio)`,
    attributes: source.attributes ? { ...source.attributes } : undefined,
    createdAt: new Date(),
  };
}
