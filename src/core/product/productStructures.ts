import type { Product } from '@/src/core/models/types';

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of ids) {
    const id = value?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function productStructureIds(
  product: Pick<Product, 'structureId' | 'structureIds'>,
): string[] {
  if (product.structureIds && product.structureIds.length > 0) {
    return uniqueIds(product.structureIds);
  }
  return uniqueIds([product.structureId]);
}

export function productBelongsToStructure(
  product: Pick<Product, 'structureId' | 'structureIds'>,
  structureId: string,
): boolean {
  return productStructureIds(product).includes(structureId);
}

export function sameStructureIds(a: string[], b: string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

export function withProductStructureIds<T extends Pick<Product, 'structureId' | 'structureIds'>>(
  product: T,
  ids: string[],
): T {
  const structureIds = uniqueIds(ids);
  return {
    ...product,
    structureIds,
    structureId: structureIds[0],
  };
}

export function parseStoredStructureIds(
  structureIdsJson: string | null | undefined,
  structureId: string | null | undefined,
): string[] {
  if (typeof structureIdsJson === 'string' && structureIdsJson.trim()) {
    try {
      const parsed = JSON.parse(structureIdsJson) as unknown;
      if (Array.isArray(parsed)) {
        return uniqueIds(parsed.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      /* vanha tai rikkinäinen JSON */
    }
  }
  return uniqueIds([structureId]);
}
