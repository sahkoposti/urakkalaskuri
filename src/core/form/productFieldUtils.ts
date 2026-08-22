import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';

export function isProductField(field: Pick<FormField, 'type'>): boolean {
  return field.type === 'product_select';
}

export function getSelectedProductId(fieldValues: Record<string, string>, fieldKey: string): string | null {
  const productId = fieldValues[fieldKey]?.trim();
  return productId || null;
}

export function findProductById(products: Product[], productId: string | null | undefined): Product | null {
  if (!productId) return null;
  return products.find((product) => product.id === productId) ?? null;
}
