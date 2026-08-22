import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';

export const PRODUCT_QUANTITY_SUFFIX = '__qty';

export function isProductField(field: Pick<FormField, 'type'>): boolean {
  return field.type === 'product_select' || field.type === 'product_quantity';
}

export function productQuantityValueKey(fieldKey: string): string {
  return `${fieldKey}${PRODUCT_QUANTITY_SUFFIX}`;
}

export function getSelectedProductId(fieldValues: Record<string, string>, fieldKey: string): string | null {
  const productId = fieldValues[fieldKey]?.trim();
  return productId || null;
}

export function getFieldProductQuantity(fieldValues: Record<string, string>, fieldKey: string): number | null {
  const raw = fieldValues[productQuantityValueKey(fieldKey)]?.trim();
  if (!raw) return null;
  const parsed = parseNumber(raw);
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

export function findProductById(products: Product[], productId: string | null | undefined): Product | null {
  if (!productId) return null;
  return products.find((product) => product.id === productId) ?? null;
}
