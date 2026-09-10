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

/** Hakee tuotteen id:llä tai nimellä (nimihaku ei erota kirjainkokoa). */
export function findProductById(products: Product[], productId: string | null | undefined): Product | null {
  if (!productId) return null;
  const needle = productId.trim();
  if (!needle) return null;
  const byId = products.find((product) => product.id === needle);
  if (byId) return byId;
  const lowered = needle.toLowerCase();
  return products.find((product) => product.name.trim().toLowerCase() === lowered) ?? null;
}

/** Pickerin arvo on aina tuote-id, vaikka oletus olisi tuotteen nimi. */
export function selectedProductPickerValue(
  products: Product[],
  productIdOrName: string | null | undefined,
): string {
  return findProductById(products, productIdOrName)?.id ?? '';
}
