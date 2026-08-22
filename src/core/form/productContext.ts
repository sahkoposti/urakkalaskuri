import type { Product } from '@/src/core/models/types';

/** Täyttää kaavakontekstiin `{key}.unit_price`, `{key}.consumption` jne. */
export function exportProductToContext(
  fieldKey: string,
  product: Product,
  context: Record<string, number>,
  options?: { quantity?: number },
): void {
  context[`${fieldKey}.unit_price`] = product.unitPriceVat0;

  for (const [attribute, value] of Object.entries(product.attributes ?? {})) {
    if (Number.isFinite(value)) {
      context[`${fieldKey}.${attribute}`] = value;
    }
  }

  if (options?.quantity !== undefined && Number.isFinite(options.quantity)) {
    context[`${fieldKey}.quantity`] = options.quantity;
  }
}
