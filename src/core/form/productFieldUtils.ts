import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';

import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';

export function isProductField(field: Pick<FormField, 'type'>): boolean {
  return field.type === 'product_select';
}

export function getSelectedProductId(
  fieldValues: Record<string, string>,
  fieldKey: string,
  field?: Pick<FormField, 'key' | 'defaultValue'>,
): string | null {
  const raw = field
    ? resolveFieldRawValue({ key: fieldKey, defaultValue: field.defaultValue }, fieldValues)
    : fieldValues[fieldKey];
  const productId = raw?.trim();
  return productId || null;
}

export function findProductById(products: Product[], productId: string | null | undefined): Product | null {
  if (!productId) return null;
  return products.find((product) => product.id === productId) ?? null;
}
