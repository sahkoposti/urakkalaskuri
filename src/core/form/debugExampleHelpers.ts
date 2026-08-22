import { findProductById } from '@/src/core/form/productFieldUtils';
import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';

/** Näyttökelpoinen debug-esimerkkiarvo asetusten listoissa (ei raakaa id:tä). */
export function formatDebugExampleDisplay(
  field: FormField,
  products: Product[] = [],
): string {
  const raw = field.debugExampleValue?.trim();
  if (!raw) return '';

  if (field.type === 'product_select') {
    return findProductById(products, raw)?.name ?? raw;
  }

  if (field.type === 'select') {
    return field.options?.find((option) => option.value === raw)?.label ?? raw;
  }

  if (field.type === 'boolean') {
    return raw === 'true' ? 'Kyllä' : 'Ei';
  }

  return raw;
}
